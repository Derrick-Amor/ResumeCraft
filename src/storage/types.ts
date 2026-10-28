/**
 * 持久化与数据安全 —— 类型、错误构造与共享纯函数（TC-017）
 * 契约：docs/contract/CONTRACT.md §6「MVP-5 持久化」，本模块是定义方。
 *
 * 硬约束（改动前先读契约）：
 *  1. 业务核心禁止直接调用 IndexedDB / File System Access API；只经本接口（不变量 1）
 *  2. 接口签名与云存二期 CloudStorageAdapter 完全一致，新增实现不改调用方（不变量 2）
 *  3. "保存到原文件"（writeBack）与"下载副本"（download）是两个独立方法（不变量 3）
 *  4. 日志不得包含简历正文/电话/邮箱（FR-SEC-004）：
 *     错误消息只含 documentId / 操作名 / 错误码，见 storageIssue()
 *
 * 工程约定：
 *  - 零新依赖：原生 IndexedDB / File System Access 直接封装
 *  - 不抛异常：跨模块一律返回 Result<T>（复用 src/model/types.ts）
 *  - erasableSyntaxOnly：禁用 enum，一律 const + union
 *  - 本文件除类型外只放无副作用纯函数，便于两个适配器复用
 */

import { serialize } from '../model/serialize'
import {
  ISSUE_CODES,
  issue,
  type ModelIssue,
  type ModelIssueCode,
  type Result,
  type ResumeDocument,
} from '../model/types'

// ---------------------------------------------------------------------------
// 文件抽象：浏览器 File / 测试内存对象都满足此结构
// ---------------------------------------------------------------------------

/** 导入文件的最小结构。浏览器 File 天然满足；测试可传轻量对象。 */
export interface FileLike {
  readonly name: string
  readonly size: number
  readonly type: string
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

// ---------------------------------------------------------------------------
// 存储记录
// ---------------------------------------------------------------------------

/** list() 返回的轻量元数据。**不含正文**，避免列表接口泄漏简历内容。 */
export interface StorageRecord {
  documentId: string
  title: string
  createdAt: string
  updatedAt: string
  schemaVersion: number
  /** 序列化后的字节数，便于"清理文档"引导 */
  sizeBytes: number
}

/** 适配器内部持久化单元：元数据 + 文档 JSON（事实源）。 */
export interface StoredRecord {
  documentId: string
  title: string
  createdAt: string
  updatedAt: string
  schemaVersion: number
  sizeBytes: number
  /** serialize(document) 的产物，load 时走 deserialize 还原文档 */
  json: string
}

// ---------------------------------------------------------------------------
// 契约 §6 接口
// ---------------------------------------------------------------------------

/**
 * 存储适配器。契约 §6 原文：
 * `StorageAdapter{ save(doc), load(id), list(), remove(id), exportJSON(id), importJSON(file) }`
 *
 * 语义约定：
 *  - save：按 documentId 覆盖写入（幂等）
 *  - load / exportJSON / remove：目标不存在 → not-found 失败
 *  - exportJSON：返回存储中的权威 JSON 文本（备份入口，FR-DOC-002）
 *  - importJSON：安全检查 → 解析 → 落库 → 返回还原后的文档（恢复，FR-SEC-005）
 */
export interface StorageAdapter {
  save(doc: ResumeDocument): Promise<Result<void>>
  load(id: string): Promise<Result<ResumeDocument>>
  list(): Promise<Result<StorageRecord[]>>
  remove(id: string): Promise<Result<void>>
  exportJSON(id: string): Promise<Result<string>>
  importJSON(file: FileLike): Promise<Result<ResumeDocument>>
}

/** writeBack 成功回执。 */
export interface WriteBackResult {
  documentId: string
  fileName: string
  sizeBytes: number
}

/** download 成功回执。 */
export interface DownloadResult {
  documentId: string
  fileName: string
  sizeBytes: number
}

/**
 * 文件写入适配器。契约 §6 原文：
 * `FileAccessAdapter{ canWriteBack(), writeBack(doc), download(doc) }`
 *
 * 两个保存动作在接口层严格分离（不变量 3）：
 *  - writeBack：File System Access `createWritable` 原子写回原文件（仅 Chromium）
 *  - download：生成文件下载副本（其他浏览器的等价行为）
 */
export interface FileAccessAdapter {
  /** 是否已绑定可写回的原文件句柄（false 时调用方应降级为 download）。 */
  canWriteBack(): boolean
  writeBack(doc: ResumeDocument): Promise<Result<WriteBackResult>>
  download(doc: ResumeDocument): Promise<Result<DownloadResult>>
}

/** 存储配额信息。契约 §6 原文：`QuotaInfo{ usage, quota, percent }`。 */
export interface QuotaInfo {
  /** 已用字节数 */
  usage: number
  /** 配额字节数 */
  quota: number
  /** 使用率百分比（0 起，保留一位小数；quota=0 且 usage>0 时记 100） */
  percent: number
}

// ---------------------------------------------------------------------------
// 安全检查结果（契约 §6 原文形状：`SecurityCheck(file) → { ok, reason }`）
// ---------------------------------------------------------------------------

/** 安全检查拒绝原因的稳定错误码。 */
export type SecurityIssueCode =
  | 'file-too-large'
  | 'bad-extension'
  | 'bad-mime'
  | 'macro-detected'
  | 'script-detected'
  | 'unreadable'

/**
 * 安全检查结果。契约 §6 把 SecurityCheck 定为扁平的 `{ ok, reason }`，
 * 与 Result<T> 不同，这里按契约原文实现（原因文本已脱敏，不含文件名/正文）。
 */
export type SecurityCheckResult =
  | { ok: true; reason: null }
  | { ok: false; reason: string; code: SecurityIssueCode }

// ---------------------------------------------------------------------------
// 存储错误：稳定错误码 + 脱敏消息（FR-SEC-004）
// ---------------------------------------------------------------------------

export const STORAGE_ERROR_CODES = {
  notFound: 'not-found',
  quotaExceeded: 'quota-exceeded',
  ioError: 'io-error',
  invalidRecord: 'invalid-record',
  securityBlocked: 'security-blocked',
  permissionDenied: 'permission-denied',
  downloadBlocked: 'download-blocked',
  unavailable: 'unavailable',
} as const

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[keyof typeof STORAGE_ERROR_CODES]

/** 存储层操作名。错误消息里允许出现的三要素之一。 */
export type StorageOperation =
  | 'save'
  | 'load'
  | 'list'
  | 'remove'
  | 'exportJSON'
  | 'importJSON'
  | 'writeBack'
  | 'download'
  | 'quota'
  | 'autosave'

/** 存储错误码 → 模型层稳定错误码（Result/ModelIssue 体系）。 */
export function modelIssueCodeOf(code: StorageErrorCode): ModelIssueCode {
  switch (code) {
    case STORAGE_ERROR_CODES.notFound:
      return ISSUE_CODES.missing
    case STORAGE_ERROR_CODES.invalidRecord:
      return ISSUE_CODES.invalidJson
    case STORAGE_ERROR_CODES.securityBlocked:
      return ISSUE_CODES.wrongType
    default:
      return ISSUE_CODES.unexpected
  }
}

/**
 * 构造脱敏存储错误。消息**只含** documentId / 操作名 / 错误码（FR-SEC-004），
 * 严禁把简历正文、电话、邮箱写进 message。cause 面向开发者，不得直接落日志。
 */
export function storageIssue(
  operation: StorageOperation,
  code: StorageErrorCode,
  documentId: string = '',
  cause?: unknown,
): ModelIssue {
  const target = documentId === '' ? '-' : documentId
  return issue(
    operation,
    modelIssueCodeOf(code),
    `${operation} 失败（documentId=${target}，code=${code}）`,
    cause,
  )
}

/** 把任意异常映射为稳定存储错误码（只看异常名，不读消息内容）。 */
export function mapUnknownError(error: unknown): StorageErrorCode {
  let name = ''
  if (typeof error === 'object' && error !== null && 'name' in error) {
    name = String((error as { name: unknown }).name)
  }
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return STORAGE_ERROR_CODES.quotaExceeded
  }
  if (name === 'IdbUnavailableError') {
    return STORAGE_ERROR_CODES.unavailable
  }
  return STORAGE_ERROR_CODES.ioError
}

// ---------------------------------------------------------------------------
// 记录映射纯函数
// ---------------------------------------------------------------------------

/** UTF-8 字节数。TextEncoder 在 Node 22 与现代浏览器均为全局对象。 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

/** 文档 → 持久化单元。JSON 只序列化一次，元数据从文档派生。 */
export function toStoredRecord(document: ResumeDocument): StoredRecord {
  const json = serialize(document)
  return {
    documentId: document.documentId,
    title: document.meta.title,
    createdAt: document.meta.createdAt,
    updatedAt: document.meta.updatedAt,
    schemaVersion: document.schemaVersion,
    sizeBytes: utf8ByteLength(json),
    json,
  }
}

/** 持久化单元 → 列表元数据（剥离 json，防止正文随 list 泄漏）。 */
export function toStorageRecord(record: StoredRecord): StorageRecord {
  return {
    documentId: record.documentId,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    schemaVersion: record.schemaVersion,
    sizeBytes: record.sizeBytes,
  }
}

/** list 排序：updatedAt 倒序，同刻按 documentId 升序，保证确定性。 */
export function sortRecords(records: readonly StorageRecord[]): StorageRecord[] {
  return [...records].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1
    return a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0
  })
}
