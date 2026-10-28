/**
 * 存储配额查询与监控（TC-017 / FR-DOC-003 配套、12 章错误处理）
 * 契约 §6：`QuotaInfo{ usage, quota, percent }`。
 *
 * 设计要点：
 *  - QuotaProvider 可注入：生产用 navigator.storage.estimate，测试用固定值
 *  - 配额满/告警时给出明确引导（导出 JSON 备份 / 清理文档），消息不含简历正文
 *  - 查询失败不抛异常，返回 Result
 */

import { fail, ok, type Result } from '../model/types'
import { STORAGE_ERROR_CODES, storageIssue } from './types'
import type { QuotaInfo } from './types'

/** estimate() 返回 null 表示当前环境无法查询配额。 */
export interface QuotaEstimate {
  usage: number
  quota: number
}

export interface QuotaProvider {
  estimate(): Promise<QuotaEstimate | null>
}

/** navigator.storage.estimate 的结构子集（便于注入测试）。 */
export interface StorageEstimateLike {
  estimate?: () => Promise<{ usage?: number; quota?: number }>
}

export interface NavigatorLike {
  storage?: StorageEstimateLike
}

/** 配额健康度分档。 */
export type QuotaLevel = 'ok' | 'warning' | 'critical' | 'full'

export interface QuotaThresholds {
  /** 达到该百分比进入 warning（默认 70） */
  warningPercent: number
  /** 达到该百分比进入 critical（默认 90） */
  criticalPercent: number
}

export const DEFAULT_QUOTA_THRESHOLDS: QuotaThresholds = {
  warningPercent: 70,
  criticalPercent: 90,
}

/** 保留一位小数的百分比；quota=0 时 usage>0 记 100，否则 0。 */
export function computePercent(usage: number, quota: number): number {
  if (quota <= 0) return usage > 0 ? 100 : 0
  return Math.round((usage / quota) * 1000) / 10
}

/**
 * 生产 QuotaProvider：走 navigator.storage.estimate。
 * 环境缺失或缺少 estimate 方法时返回 null（由 queryQuota 报 unavailable）。
 */
export function createNavigatorQuotaProvider(
  getNavigator: () => NavigatorLike | null = () => {
    const nav = (globalThis as { navigator?: NavigatorLike }).navigator
    return nav ?? null
  },
): QuotaProvider {
  return {
    async estimate(): Promise<QuotaEstimate | null> {
      try {
        const nav = getNavigator()
        const estimate = nav?.storage?.estimate
        if (typeof estimate !== 'function') return null
        const raw = await estimate.call(nav?.storage)
        const usage = typeof raw?.usage === 'number' ? raw.usage : 0
        const quota = typeof raw?.quota === 'number' ? raw.quota : 0
        return { usage, quota }
      } catch {
        return null
      }
    },
  }
}

/** 测试/降级 QuotaProvider：固定返回注入的估计值。 */
export function createFixedQuotaProvider(
  estimate: QuotaEstimate | null,
  shouldThrow: boolean = false,
): QuotaProvider {
  return {
    async estimate(): Promise<QuotaEstimate | null> {
      if (shouldThrow) throw new Error('quota provider failure')
      return estimate
    },
  }
}

/**
 * 查询配额。契约 §6 QuotaInfo。
 * 失败场景：环境不支持（unavailable）、数据非法（invalid-record）、provider 抛错（io-error）。
 */
export async function queryQuota(provider: QuotaProvider): Promise<Result<QuotaInfo>> {
  let estimate: QuotaEstimate | null
  try {
    estimate = await provider.estimate()
  } catch (cause) {
    return fail([storageIssue('quota', STORAGE_ERROR_CODES.ioError, '', cause)])
  }

  if (estimate === null) {
    return fail([storageIssue('quota', STORAGE_ERROR_CODES.unavailable, '')])
  }

  const { usage, quota } = estimate
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota < 0) {
    return fail([storageIssue('quota', STORAGE_ERROR_CODES.invalidRecord, '')])
  }

  return ok({
    usage,
    quota,
    percent: computePercent(usage, quota),
  })
}

/** 按阈值分档。usage ≥ quota 一律 'full'。 */
export function quotaLevel(
  info: QuotaInfo,
  thresholds: QuotaThresholds = DEFAULT_QUOTA_THRESHOLDS,
): QuotaLevel {
  if (info.quota > 0 && info.usage >= info.quota) return 'full'
  if (info.percent >= 100) return 'full'
  if (info.percent >= thresholds.criticalPercent) return 'critical'
  if (info.percent >= thresholds.warningPercent) return 'warning'
  return 'ok'
}

/**
 * 配额告警文案（FR-DOC-003 / 12 章）：明确提示并引导备份/清理。
 * 消息只含百分比数字，不含任何简历内容。健康时返回空串。
 */
export function quotaGuidance(info: QuotaInfo): string {
  const level = quotaLevel(info)
  if (level === 'ok') return ''
  if (level === 'full') {
    return `存储空间已满（${info.percent}%），请导出 JSON 备份或清理不需要的文档后重试`
  }
  if (level === 'critical') {
    return `存储空间即将用尽（${info.percent}%），请导出 JSON 备份并清理文档`
  }
  return `存储空间偏高（${info.percent}%），建议导出 JSON 备份并清理文档`
}
