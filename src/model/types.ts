/**
 * 文档模型类型（TC-003）
 * 契约：docs/contract/CONTRACT.md §2「MVP-1 文档模型」，本模块是定义方。
 *
 * 硬约束（改动前先读契约）：
 *  1. ResumeDocument 必带 schemaVersion（整数）与 documentId（唯一）
 *  2. 未知组件类型必须原样保留并标记 unknown，禁止静默丢弃
 *  3. languageTrack 决定字段可选性；未知字段保留不删
 *  4. 迁移幂等，且迁移前留有可恢复副本
 *  5. serialize / deserialize 往返深等
 *
 * 本模块不依赖任何第三方库：`erasableSyntaxOnly` 下不能用 enum，一律 const + union。
 */

/** 文档结构版本。加字段不改语义 → 不升版本；改语义或删改字段 → 必须升。 */
export type SchemaVersion = number

/** 当前代码能直接读写的版本。高于此值一律拒绝（见 validate）。 */
export const SUPPORTED_SCHEMA_VERSION = 1

/** 语言轨：中文 / 英文。字段可选性由它决定，但模型层不解释语义。 */
export type LanguageTrack = 'zh' | 'en'

export const LANGUAGE_TRACKS: readonly LanguageTrack[] = ['zh', 'en']

export type PaperKind = 'A4'
export type Orientation = 'portrait' | 'landscape'

/** 页面设置。长度单位统一 mm，换算归 src/layout/（TC-006）。 */
export interface PageSettings {
  paper: PaperKind
  orientation: Orientation
  widthMm: number
  heightMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
}

/** 已知组件：字段由组件注册表（src/components，TC-005）按 type 解释。 */
export interface ResumeComponent {
  id: string
  type: string
  /** 文档内排序权重，整数，越小越靠前。 */
  order: number
  visible: boolean
  /** 内容字段。模型层只保证是对象，不校验语义。 */
  fields: Record<string, unknown>
  /** L1/L2 样式档，随文档往返（契约 §3 不变量 3）。 */
  style?: Record<string, unknown>
}

/**
 * 未知组件：本运行时不认识其 type，但**一个字节都不能丢**。
 * raw 保存反序列化时的原始对象，serialize 时原样写回。
 */
export interface UnknownComponent {
  id: string
  type: string
  order: number
  visible: boolean
  unknown: true
  /** 原始 type，便于将来升级后回填。 */
  originalType: string
  /** 反序列化时的原始对象（含全部未识别字段）。 */
  raw: Record<string, unknown>
}

export type AnyComponent = ResumeComponent | UnknownComponent

export interface DocumentMeta {
  title: string
  /** ISO 8601 字符串。模型不读时钟，只存。 */
  createdAt: string
  updatedAt: string
}

export interface ResumeDocument {
  schemaVersion: SchemaVersion
  documentId: string
  languageTrack: LanguageTrack
  pageSettings: PageSettings
  components: AnyComponent[]
  meta: DocumentMeta
  /** 未知顶层字段。为空时不写这个键，保证序列化往返不加噪。 */
  extra?: Record<string, unknown>
}

/** 校验/解析失败的最小单元。code 稳定，message 面向用户，cause 面向开发者。 */
export interface ModelIssue {
  /** 定位路径，如 `components[2].order` */
  path: string
  /** 稳定错误码，见 ISSUE_CODES */
  code: ModelIssueCode
  message: string
  cause?: unknown
}

export const ISSUE_CODES = {
  notObject: 'not-object',
  notArray: 'not-array',
  missing: 'missing',
  wrongType: 'wrong-type',
  emptyString: 'empty-string',
  notInteger: 'not-integer',
  negative: 'negative',
  unexpected: 'unexpected',
  unsupportedVersion: 'unsupported-version',
  duplicateId: 'duplicate-id',
  invalidJson: 'invalid-json',
  migrationUnavailable: 'migration-unavailable',
} as const

export type ModelIssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES]

/** 结果对象。跨模块调用返回结果，不抛异常（契约 §11）。 */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: ModelIssue[] }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T>(errors: ModelIssue[]): Result<T> {
  return { ok: false, errors }
}

export function issue(
  path: string,
  code: ModelIssueCode,
  message: string,
  cause?: unknown,
): ModelIssue {
  return cause === undefined ? { path, code, message } : { path, code, message, cause }
}
