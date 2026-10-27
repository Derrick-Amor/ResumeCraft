/**
 * 序列化与反序列化（TC-003）
 * 契约 §2 四入口之二、之三：`serialize(doc)` / `deserialize(json)`。
 *
 * 不变量 5：`deserialize(serialize(doc))` 必须与 doc 深等。
 * 为此定两条规矩：
 *  1. `extra` 为空时**不写这个键**（否则往返会多出一个空对象）
 *  2. 未知组件按 `raw` 原样写回（否则往返会丢字段）
 */

import { validate } from './validate'
import {
  ISSUE_CODES,
  fail,
  issue,
  type AnyComponent,
  type ResumeComponent,
  type ResumeDocument,
  type Result,
  type UnknownComponent,
} from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownComponent(component: AnyComponent): component is UnknownComponent {
  return 'unknown' in component && component.unknown === true
}

/** 已知组件：只写模型定义的字段，顺序固定，便于 diff。 */
function knownComponentToPlain(component: ResumeComponent): Record<string, unknown> {
  const plain: Record<string, unknown> = {
    id: component.id,
    type: component.type,
    order: component.order,
    visible: component.visible,
    fields: component.fields,
  }
  if (component.style !== undefined) plain.style = component.style
  return plain
}

function componentToPlain(component: AnyComponent): Record<string, unknown> {
  if (isUnknownComponent(component)) {
    // 未知组件：整个原始对象写回，一个字段都不动
    return { ...component.raw }
  }
  return knownComponentToPlain(component)
}

function toPlain(document: ResumeDocument): Record<string, unknown> {
  const plain: Record<string, unknown> = {
    schemaVersion: document.schemaVersion,
    documentId: document.documentId,
    languageTrack: document.languageTrack,
    pageSettings: {
      paper: document.pageSettings.paper,
      orientation: document.pageSettings.orientation,
      widthMm: document.pageSettings.widthMm,
      heightMm: document.pageSettings.heightMm,
      marginTopMm: document.pageSettings.marginTopMm,
      marginRightMm: document.pageSettings.marginRightMm,
      marginBottomMm: document.pageSettings.marginBottomMm,
      marginLeftMm: document.pageSettings.marginLeftMm,
    },
    components: document.components.map(componentToPlain),
    meta: {
      title: document.meta.title,
      createdAt: document.meta.createdAt,
      updatedAt: document.meta.updatedAt,
    },
  }

  // 未知顶层字段原样补回，键顺序追加在末尾，保证确定性
  if (document.extra && Object.keys(document.extra).length > 0) {
    for (const [key, value] of Object.entries(document.extra)) {
      plain[key] = value
    }
  }

  return plain
}

/** 序列化为 JSON 字符串。`space` 只影响可读性，不影响往返。 */
export function serialize(document: ResumeDocument, space?: number): string {
  return JSON.stringify(toPlain(document), null, space)
}

/**
 * 反序列化。**不抛异常**：非法 JSON、结构不合法都返回 Result。
 * 成功时返回的是 validate 规范化后的文档，可直接当作事实源使用。
 */
export function deserialize(json: string): Result<ResumeDocument> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (cause) {
    return fail([
      issue('', ISSUE_CODES.invalidJson, '不是合法的 JSON 文本', cause),
    ])
  }
  return validate(parsed)
}

/** 仅用于需要"可读 JSON"导出的场景（JSON 备份、调试面板）。 */
export function toJSON(document: ResumeDocument): Record<string, unknown> {
  return toPlain(document)
}

/** 深拷贝文档。用于迁移前备份、undo 快照。 */
export function cloneDocument(document: ResumeDocument): ResumeDocument {
  const structured = globalThis.structuredClone
  if (typeof structured === 'function') return structured(document) as ResumeDocument
  return JSON.parse(JSON.stringify(document)) as ResumeDocument
}

/** 两个文档是否等价（按序列化结果比较，避开键顺序与引用差异）。 */
export function documentsEqual(a: ResumeDocument, b: ResumeDocument): boolean {
  return serialize(a) === serialize(b)
}

/** 供 UI 做"是否有未保存改动"的轻量指纹。 */
export function documentFingerprint(document: ResumeDocument): string {
  const json = serialize(document)
  let hash = 2166136261
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 内部工具：是否带有未知顶层字段 */
export function hasExtra(document: ResumeDocument): boolean {
  return isPlainObject(document.extra) && Object.keys(document.extra).length > 0
}
