/**
 * JSON 备份导出 / 恢复（TC-017 / FR-SEC-005、FR-DOC-002）
 * 契约 §6：`exportJSON(id)` / `importJSON(file)` 的核心实现。
 *
 * 职责边界：
 *  - 本文件只负责「文档 ⇄ JSON 备份文本」的格式与安全；
 *    落库由 StorageAdapter（memory/idb）完成，两者共用这里的解析入口。
 *  - 序列化走 src/model/serialize（契约 §2 四入口），本模块不自己 JSON.parse 文档结构。
 *  - 恢复路径统一过 SecurityCheck（FR-SEC-003），再 deserialize + migrate。
 */

import { migrate } from '../model/migrate'
import { deserialize, serialize } from '../model/serialize'
import type { Result, ResumeDocument } from '../model/types'
import { fail } from '../model/types'
import { securityCheck } from './security'
import type { SecurityPolicy } from './security'
import { STORAGE_ERROR_CODES, storageIssue, utf8ByteLength } from './types'
import type { FileLike } from './types'

/**
 * 导出可读 JSON 备份（缩进 2）。用于「导出 JSON 备份」入口与写回/下载。
 * 往返保证：deserialize(exportBackupJson(doc)) 与 doc 深等（契约 §2 不变量 5）。
 */
export function exportBackupJson(document: ResumeDocument): string {
  return serialize(document, 2)
}

/**
 * 解析备份 JSON 文本 → 文档。失败不抛异常，返回 Result。
 * 解析后统一走 migrate（当前无历史版本，等价于幂等校验），为将来升版留好路径。
 */
export function parseBackup(json: string): Result<ResumeDocument> {
  const parsed = deserialize(json)
  if (!parsed.ok) return parsed
  const migrated = migrate(parsed.value)
  if (!migrated.ok) return migrated
  return { ok: true, value: migrated.value.document }
}

/**
 * 从导入文件恢复备份文档（不含落库）。
 * 顺序：SecurityCheck（类型/大小/含宏）→ 读文本 → parseBackup。
 * 文件读取失败 / 校验失败都返回 Result，绝不抛异常。
 */
export async function importBackupFile(
  file: FileLike,
  policy: SecurityPolicy | undefined = undefined,
): Promise<Result<ResumeDocument>> {
  const check = await securityCheck(file, policy)
  if (!check.ok) {
    return fail([storageIssue('importJSON', STORAGE_ERROR_CODES.securityBlocked, '', undefined)])
  }

  let text: string
  try {
    text = await file.text()
  } catch (cause) {
    return fail([storageIssue('importJSON', STORAGE_ERROR_CODES.ioError, '', cause)])
  }

  const parsed = parseBackup(text)
  if (!parsed.ok) {
    // 直接透传模型层校验错误（结构化、不含正文）；再包一层脱敏标记便于日志归类
    return fail([
      storageIssue('importJSON', STORAGE_ERROR_CODES.invalidRecord, '', undefined),
      ...parsed.errors,
    ])
  }
  return parsed
}

/**
 * 生成备份文件名。硬编码部分全 ASCII（项目约定：不硬编码中文路径），
 * 形如 `resumecraft-backup-doc_fixed-20261027.json`。
 */
export function buildBackupFileName(document: ResumeDocument, nowIso: string = ''): string {
  const stampSource = nowIso !== '' ? nowIso : document.meta.updatedAt
  const day = stampSource.slice(0, 10).replace(/-/g, '')
  const safeDay = /^[0-9]{8}$/.test(day) ? day : 'backup'
  const safeId = document.documentId.replace(/[^A-Za-z0-9._-]/g, '-')
  return `resumecraft-backup-${safeId}-${safeDay}.json`
}

/** 备份文本字节数（下载回执用）。 */
export function backupByteLength(json: string): number {
  return utf8ByteLength(json)
}
