/**
 * 迁移（TC-003）
 * 契约 §2 四入口之四：`migrate(doc)`。
 *
 * 不变量 4：迁移前必须留有可恢复副本；迁移函数**幂等**（同版本重复执行结果不变）。
 *
 * 规则：
 *  - 每个 Migration 只负责把 n 升到 n+1，不做跳级
 *  - 目标版本 = SUPPORTED_SCHEMA_VERSION；缺任何一步都整体失败，不产出半残文档
 *  - 已是最新版本时返回 migrated=false 且文档原样（引用相同）
 */

import { cloneDocument, serialize } from './serialize'
import {
  ISSUE_CODES,
  SUPPORTED_SCHEMA_VERSION,
  fail,
  issue,
  ok,
  type ResumeDocument,
  type Result,
} from './types'

/** 一次单步升级：入参是 n 版文档，返回 n+1 版文档。必须是纯函数。 */
export type Migration = (document: ResumeDocument) => ResumeDocument

/**
 * 版本 n → n+1 的升级函数表。
 * 目前只有 v1，没有任何历史版本需要升级，因此为空。
 * 加版本时：改成 2、在这里补 `1: (doc) => ...`、同步更新 SUPPORTED_SCHEMA_VERSION。
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({})

export interface MigrateResult {
  document: ResumeDocument
  /** 是否真的发生了升级 */
  migrated: boolean
  from: number
  to: number
  /** 迁移前的可恢复副本；未发生迁移时为 null */
  backup: ResumeDocument | null
}

export function migrate(input: ResumeDocument): Result<MigrateResult> {
  const from = input.schemaVersion
  const to = SUPPORTED_SCHEMA_VERSION

  if (!Number.isInteger(from) || from < 1) {
    return fail([
      issue('schemaVersion', ISSUE_CODES.notInteger, 'schemaVersion 必须是 ≥1 的整数', from),
    ])
  }

  if (from > to) {
    return fail([
      issue(
        'schemaVersion',
        ISSUE_CODES.unsupportedVersion,
        `文档版本 ${from} 高于本版本支持的 ${to}，请升级应用后再打开`,
        from,
      ),
    ])
  }

  if (from === to) {
    // 幂等：同版本再跑一次，结果必须一模一样
    return ok({ document: input, migrated: false, from, to, backup: null })
  }

  // 迁移前先留副本（契约不变量 4）
  const backup = cloneDocument(input)

  let current = input
  for (let version = from; version < to; version += 1) {
    const step = MIGRATIONS[version]
    if (!step) {
      return fail([
        issue(
          'schemaVersion',
          ISSUE_CODES.migrationUnavailable,
          `缺少 v${version} → v${version + 1} 的迁移步骤，无法打开该文档`,
          version,
        ),
      ])
    }
    const next = step(current)
    // 防呆：单步迁移只能升一级，写错版本号立刻暴露
    if (next.schemaVersion !== version + 1) {
      return fail([
        issue(
          'schemaVersion',
          ISSUE_CODES.migrationUnavailable,
          `v${version} → v${version + 1} 的迁移没有把版本号写对（得到 ${next.schemaVersion}）`,
          next.schemaVersion,
        ),
      ])
    }
    current = next
  }

  return ok({ document: current, migrated: true, from, to, backup })
}

/** 幂等自检：同一输入连跑两次，序列化结果必须一致。给测试与启动期自检用。 */
export function isMigrateIdempotent(document: ResumeDocument): boolean {
  const first = migrate(document)
  if (!first.ok) return false
  const second = migrate(first.value.document)
  if (!second.ok) return false
  return serialize(first.value.document) === serialize(second.value.document)
}
