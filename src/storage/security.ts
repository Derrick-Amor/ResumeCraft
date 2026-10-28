/**
 * 安全的文件处理（TC-017 / FR-SEC-003）
 * 契约 §6：`SecurityCheck(file) → { ok, reason }` —— 类型 / 大小 / 含宏。
 *
 * 三道闸门，顺序固定（便宜的检查先做）：
 *  1. 大小限制：超过 maxBytes 一律拒绝
 *  2. 类型检查：扩展名 + MIME 双白名单（浏览器常给空 MIME，因此 '' 可配置放行）
 *  3. 内容嗅探：拒绝宏容器 / 宏签名 / 脚本内容 —— 导入永不执行任何字节
 *
 * 脱敏：reason 只描述大小 / 扩展名 / MIME / 错误码，不含文件名与文件内容
 * （文件名可能带电话邮箱，FR-SEC-004）。
 */

import type { FileLike, SecurityCheckResult, SecurityIssueCode } from './types'

/** 默认允许的文件大小上限：10 MiB。 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export interface SecurityPolicy {
  /** 文件大小上限（字节） */
  maxBytes: number
  /** 允许的扩展名（小写、含点，如 '.json'） */
  allowedExtensions: readonly string[]
  /** 允许的 MIME（小写；'' 表示浏览器未识别） */
  allowedMimeTypes: readonly string[]
}

/** JSON 备份导入的默认策略（存储模块主路径）。 */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxBytes: MAX_FILE_BYTES,
  allowedExtensions: ['.json'],
  allowedMimeTypes: ['application/json', 'text/json', 'text/plain', ''],
}

/** OLE2 复合文档魔数（老 .doc/.xls 容器，天然可携带 VBA 宏）。 */
export const OLE2_MAGIC: readonly number[] = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** OOXML 宏工程签名（zip 包内 vbaProject.bin 的文件名会出现在字节流中）。 */
export const VBA_PROJECT_SIGNATURE = 'vbaProject.bin'

/** 脚本起始签名（导入永不执行脚本，检出即拒）。 */
export const SCRIPT_SIGNATURES: readonly string[] = ['<script', '<?php', '<%']

/** 取小写扩展名（含点）。无扩展名返回 ''。 */
export function extensionOf(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const slash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  const base = slash >= 0 ? normalized.slice(slash + 1) : normalized
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot)
}

function hasPrefixAt(bytes: Uint8Array, offset: number, prefix: readonly number[]): boolean {
  if (offset + prefix.length > bytes.length) return false
  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[offset + i] !== prefix[i]) return false
  }
  return true
}

/** 字节流里是否出现给定 ASCII 串。 */
function containsAscii(bytes: Uint8Array, needle: string): boolean {
  if (needle.length === 0) return true
  if (bytes.length < needle.length) return false
  const first = needle.charCodeAt(0)
  const limit = bytes.length - needle.length
  for (let i = 0; i <= limit; i += 1) {
    if (bytes[i] !== first) continue
    let matched = true
    for (let j = 1; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

/** 字节流里是否出现给定 ASCII 串（忽略大小写）。 */
function containsAsciiFold(bytes: Uint8Array, needle: string): boolean {
  const lower = needle.toLowerCase()
  const upper = needle.toUpperCase()
  return containsAscii(bytes, lower) || containsAscii(bytes, upper)
}

/**
 * 威胁嗅探：只看字节签名，不做任何执行。
 * 返回 'macro-detected' / 'script-detected' / null。
 */
export function detectThreat(bytes: Uint8Array): SecurityIssueCode | null {
  if (hasPrefixAt(bytes, 0, OLE2_MAGIC)) return 'macro-detected'
  if (containsAscii(bytes, VBA_PROJECT_SIGNATURE)) return 'macro-detected'
  for (const signature of SCRIPT_SIGNATURES) {
    if (signature === '<script') {
      if (containsAsciiFold(bytes, signature)) return 'script-detected'
    } else if (containsAscii(bytes, signature)) {
      return 'script-detected'
    }
  }
  return null
}

function threatReason(code: SecurityIssueCode): string {
  if (code === 'macro-detected') {
    return `检测到宏容器/宏签名，已拒绝导入（code=${code}）`
  }
  return `检测到脚本内容，已拒绝导入（code=${code}）`
}

/**
 * 契约 §6 SecurityCheck。类型 / 大小 / 含宏三道闸门，全过才 ok。
 * 不抛异常：文件读不出来也返回 `{ ok: false, reason, code: 'unreadable' }`。
 */
export async function securityCheck(
  file: FileLike,
  policy: SecurityPolicy = DEFAULT_SECURITY_POLICY,
): Promise<SecurityCheckResult> {
  // 1. 大小（先看 size，避免为超大文件读内容）
  if (typeof file.size === 'number' && file.size > policy.maxBytes) {
    return {
      ok: false,
      reason: `文件超过大小限制（limit=${policy.maxBytes} 字节，code=file-too-large）`,
      code: 'file-too-large',
    }
  }

  // 2. 类型：扩展名 + MIME 双白名单
  const ext = extensionOf(file.name)
  if (!policy.allowedExtensions.includes(ext)) {
    return {
      ok: false,
      reason: `文件扩展名 ${ext === '' ? '(无)' : ext} 不在允许列表（code=bad-extension）`,
      code: 'bad-extension',
    }
  }
  const mime = (file.type ?? '').toLowerCase()
  if (!policy.allowedMimeTypes.includes(mime)) {
    return {
      ok: false,
      reason: `MIME 类型 ${mime === '' ? '(空)' : mime} 不在允许列表（code=bad-mime）`,
      code: 'bad-mime',
    }
  }

  // 3. 内容嗅探：宏 / 脚本（读字节但绝不执行）
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, reason: '文件无法读取（code=unreadable）', code: 'unreadable' }
  }
  if (bytes.byteLength > policy.maxBytes) {
    return {
      ok: false,
      reason: `文件超过大小限制（limit=${policy.maxBytes} 字节，code=file-too-large）`,
      code: 'file-too-large',
    }
  }

  const threat = detectThreat(bytes)
  if (threat !== null) {
    return { ok: false, reason: threatReason(threat), code: threat }
  }

  return { ok: true, reason: null }
}
