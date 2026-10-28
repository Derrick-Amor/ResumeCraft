/**
 * TC-017 存储配额回归测试
 * 对照：CONTRACT §6 `QuotaInfo{ usage, quota, percent }` + 12 章错误处理
 * （配额满时明确提示，引导导出 JSON 备份 / 清理文档）。
 *
 * 策略：QuotaProvider 全程注入（mock navigator.storage.estimate 等价物），
 * 不依赖真实浏览器配额。
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_QUOTA_THRESHOLDS,
  computePercent,
  createFixedQuotaProvider,
  createNavigatorQuotaProvider,
  quotaGuidance,
  quotaLevel,
  queryQuota,
} from '../../src/storage/quota'
import type { NavigatorLike } from '../../src/storage/quota'

describe('queryQuota：正常查询与百分比', () => {
  it('返回 usage / quota / percent（保留一位小数）', async () => {
    const provider = createFixedQuotaProvider({ usage: 250, quota: 1000 })
    const result = await queryQuota(provider)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.usage).toBe(250)
      expect(result.value.quota).toBe(1000)
      expect(result.value.percent).toBe(25)
    }
  })

  it('非整除比例时 percent 保留一位小数', () => {
    expect(computePercent(1, 3)).toBe(33.3)
    expect(computePercent(2, 3)).toBe(66.7)
    expect(computePercent(0, 0)).toBe(0)
    expect(computePercent(5, 0)).toBe(100)
  })

  it('provider 返回 null 时返回 unavailable', async () => {
    const result = await queryQuota(createFixedQuotaProvider(null))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=unavailable')
      expect(result.errors[0].message).toContain('quota')
    }
  })
})

describe('queryQuota：异常数据与 provider 抛错', () => {
  it('provider 抛错返回 io-error，不抛异常', async () => {
    const result = await queryQuota(createFixedQuotaProvider(null, true))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=io-error')
    }
  })

  it('NaN / 负数配额返回 invalid-record', async () => {
    const nanResult = await queryQuota(createFixedQuotaProvider({ usage: Number.NaN, quota: 100 }))
    expect(nanResult.ok).toBe(false)
    if (!nanResult.ok) {
      expect(nanResult.errors[0].message).toContain('code=invalid-record')
    }

    const negative = await queryQuota(createFixedQuotaProvider({ usage: -1, quota: 100 }))
    expect(negative.ok).toBe(false)
  })
})

describe('quotaLevel：健康度分档', () => {
  it('按阈值划分 ok / warning / critical / full', () => {
    expect(quotaLevel({ usage: 10, quota: 100, percent: 10 })).toBe('ok')
    expect(quotaLevel({ usage: 70, quota: 100, percent: 70 })).toBe('warning')
    expect(quotaLevel({ usage: 90, quota: 100, percent: 90 })).toBe('critical')
    expect(quotaLevel({ usage: 100, quota: 100, percent: 100 })).toBe('full')
    expect(quotaLevel({ usage: 120, quota: 100, percent: 120 })).toBe('full')
  })

  it('自定义阈值生效', () => {
    const thresholds = { warningPercent: 50, criticalPercent: 60 }
    expect(quotaLevel({ usage: 55, quota: 100, percent: 55 }, thresholds)).toBe('warning')
    expect(quotaLevel({ usage: 61, quota: 100, percent: 61 }, thresholds)).toBe('critical')
    expect(DEFAULT_QUOTA_THRESHOLDS.warningPercent).toBe(70)
  })
})

describe('quotaGuidance：配额满引导备份/清理', () => {
  it('配额满明确提示导出 JSON 备份或清理文档', () => {
    const message = quotaGuidance({ usage: 100, quota: 100, percent: 100 })
    expect(message).toContain('存储空间已满')
    expect(message).toContain('JSON 备份')
    expect(message).toMatch(/清理|删除/)
  })

  it('critical/warning 给出建议文案，ok 时不打扰', () => {
    expect(quotaGuidance({ usage: 95, quota: 100, percent: 95 })).toContain('即将用尽')
    expect(quotaGuidance({ usage: 71, quota: 100, percent: 71 })).toContain('偏高')
    expect(quotaGuidance({ usage: 1, quota: 100, percent: 1 })).toBe('')
  })

  it('提示文案只含百分比数字，不含任何简历内容', () => {
    const message = quotaGuidance({ usage: 1024, quota: 1024, percent: 100 })
    expect(message).not.toContain('简历')
    expect(message).not.toContain('电话')
    expect(message).not.toContain('@')
  })
})

describe('createNavigatorQuotaProvider：环境探测', () => {
  it('从 navigator.storage.estimate 提取 usage/quota', async () => {
    const nav: NavigatorLike = {
      storage: {
        estimate: async () => ({ usage: 100, quota: 200 }),
      },
    }
    const provider = createNavigatorQuotaProvider(() => nav)
    const estimate = await provider.estimate()
    expect(estimate).toEqual({ usage: 100, quota: 200 })
  })

  it('缺少 estimate 方法或抛错时返回 null', async () => {
    const noEstimate = createNavigatorQuotaProvider(() => ({ storage: {} }))
    expect(await noEstimate.estimate()).toBe(null)

    const throwing = createNavigatorQuotaProvider(() => ({
      storage: {
        estimate: async () => {
          throw new Error('denied')
        },
      },
    }))
    expect(await throwing.estimate()).toBe(null)
  })
})
