/**
 * DOCX 结构标记（TC-011 / FR-EXP-005）
 * 契约：docs/contract/CONTRACT.md §7 不变量 5 —— 标记命名与版本规则见
 * `docs/docx-mark-protocol.md`，协议变更必须升版本号。
 *
 * 载体（双通道冗余，互为校验）：
 *  1. docProps/custom.xml 自定义文档属性：
 *     - `data-rc-mark-version` —— 协议版本号
 *     - `data-rc-marks`        —— MarkManifest 的 JSON 字符串（权威数据）
 *  2. word/document.xml 书签：每个已渲染组件的首段到末段包一对
 *     BookmarkStart/BookmarkEnd，书签名 `rc{version}_{safeId}`。
 *
 * 本模块是纯数据层：不依赖 docx 库、不抛异常，导入侧（TC-012）直接复用。
 */

import type { AnyComponent, ResumeDocument, UnknownComponent } from '../model/types'

// ─── 常量 ────────────────────────────────────────────────

/** 当前标记协议版本。协议任何语义变更必须升此版本号（契约 §7 不变量 5）。 */
export const MARK_VERSION = 1

/** 自定义文档属性名：协议版本号 */
export const MARK_VERSION_PROPERTY = 'data-rc-mark-version'

/** 自定义文档属性名：组件标记清单（JSON） */
export const MARKS_PROPERTY = 'data-rc-marks'

/** 书签名前缀 `rc{version}_`。同时兼作版本嗅探（书签名以 `rc1_` 开头即 v1）。 */
export const BOOKMARK_PREFIX = `rc${MARK_VERSION}_`

/** 书签名中组件 id 的最大保留长度（Word 书签名上限 40 字符，前缀 4 + 哈希 9 = 13） */
const BOOKMARK_SAFE_MAX = 24

// ─── 类型 ────────────────────────────────────────────────

/** 单个组件的标记。键名即协议规定的 `data-rc-*` 标记名。 */
export interface ComponentMark {
  /** 组件 UUID（契约要求的 data-rc-component-id 标记） */
  'data-rc-component-id': string
  /** 模型 style 字段原文（data-rc-style 标记，无样式时为 {}） */
  'data-rc-style': Record<string, unknown>
  /** 写入该组件的协议版本（data-rc-mark-version 标记） */
  'data-rc-mark-version': number
  /** 对应的书签名（未渲染的组件为 ''） */
  bookmark: string
  /** 排序权重，与模型 order 一致 */
  order: number
  /** 组件类型 */
  type: string
  /** 是否可见（不可见组件只留标记不渲染） */
  visible: boolean
}

/** 标记清单（写入 `data-rc-marks` 属性的 JSON 结构）。 */
export interface MarkManifest {
  'data-rc-mark-version': number
  components: ComponentMark[]
}

/** 自定义文档属性条目（docx customProperties 的最小结构）。 */
export interface CustomPropertyEntry {
  name: string
  value: string
}

/** 标记读取结果。受损时 mode 降级为 'third-party'（FR-IMP-009）。 */
export interface MarksReadResult {
  ok: boolean
  /** 'self-docx' 走结构标记无损路径；'third-party' 降级为第三方导入路径 */
  mode: 'self-docx' | 'third-party'
  /** 解析成功的标记清单；降级时为 null */
  manifest: MarkManifest | null
  /** 非阻断性问题（如个别书签缺失） */
  warnings: string[]
  /** 降级原因 */
  error?: string
}

// ─── 内部工具 ────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownComponent(component: AnyComponent): component is UnknownComponent {
  return 'unknown' in component && component.unknown === true
}

/** FNV-1a 32 位哈希（十进制 8 位十六进制），用于长 id 的书签名防碰撞。 */
function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

// ─── 书签命名 ────────────────────────────────────────────

/**
 * 组件 id → 书签名。Word 书签名约束：字母开头、无空格、≤40 字符。
 * 规则：非 [A-Za-z0-9_] 字符替换为 `_`；超过 24 字符时截断并追加 FNV-1a 哈希。
 */
export function bookmarkNameFor(componentId: string): string {
  const safe = componentId.replace(/[^A-Za-z0-9_]/g, '_')
  const body =
    safe.length > BOOKMARK_SAFE_MAX
      ? `${safe.slice(0, BOOKMARK_SAFE_MAX)}_${fnv1a32Hex(componentId)}`
      : safe
  return `${BOOKMARK_PREFIX}${body}`
}

/** 书签名是否形如本协议产物（前缀 `rc{version}_`）。 */
export function isMarkBookmark(name: string): boolean {
  return name.startsWith(BOOKMARK_PREFIX)
}

// ─── 标记构建 ────────────────────────────────────────────

/** 由文档模型构建标记清单。组件按 order 升序，顺序确定。 */
export function buildMarks(doc: ResumeDocument): MarkManifest {
  const sorted = [...doc.components].sort((a, b) => a.order - b.order)

  const components: ComponentMark[] = sorted.map((component: AnyComponent) => {
    const style = isUnknownComponent(component)
      ? {}
      : component.style === undefined
        ? {}
        : (JSON.parse(JSON.stringify(component.style)) as Record<string, unknown>)

    return {
      'data-rc-component-id': component.id,
      'data-rc-style': style,
      'data-rc-mark-version': MARK_VERSION,
      bookmark: component.visible ? bookmarkNameFor(component.id) : '',
      order: component.order,
      type: component.type,
      visible: component.visible,
    }
  })

  return { 'data-rc-mark-version': MARK_VERSION, components }
}

/** 标记清单 → 自定义文档属性条目（写入 docProps/custom.xml）。 */
export function marksToCustomProperties(manifest: MarkManifest): CustomPropertyEntry[] {
  return [
    { name: MARK_VERSION_PROPERTY, value: String(manifest['data-rc-mark-version']) },
    { name: MARKS_PROPERTY, value: JSON.stringify(manifest) },
  ]
}

// ─── 标记解析（导入侧复用） ──────────────────────────────

/** 从 docProps/custom.xml 原文解析自定义文档属性条目。 */
export function parsePropertiesFromXml(xml: string): CustomPropertyEntry[] {
  const entries: CustomPropertyEntry[] = []
  const propertyRe =
    /<property\b[^>]*\bname="([^"]*)"[^>]*>[\s\S]*?<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>\s*<\/property>/g

  let match = propertyRe.exec(xml)
  while (match !== null) {
    entries.push({ name: unescapeXml(match[1]), value: unescapeXml(match[2]) })
    match = propertyRe.exec(xml)
  }
  return entries
}

/** 从 word/document.xml 原文提取全部书签名（按出现顺序）。 */
export function extractBookmarkNames(documentXml: string): string[] {
  const names: string[] = []
  const bookmarkRe = /<w:bookmarkStart\b[^>]*\bw:name="([^"]*)"/g

  let match = bookmarkRe.exec(documentXml)
  while (match !== null) {
    names.push(unescapeXml(match[1]))
    match = bookmarkRe.exec(documentXml)
  }
  return names
}

/**
 * 从自定义属性条目解析标记清单。
 * 版本缺失/非法/不等于 MARK_VERSION、JSON 损坏 → ok=false + mode='third-party'（降级）。
 */
export function parseMarksFromProperties(entries: readonly CustomPropertyEntry[]): MarksReadResult {
  const degraded = (error: string): MarksReadResult => ({
    ok: false,
    mode: 'third-party',
    manifest: null,
    warnings: [],
    error,
  })

  const versionEntry = entries.find((e) => e.name === MARK_VERSION_PROPERTY)
  if (!versionEntry) {
    return degraded(`缺少 ${MARK_VERSION_PROPERTY} 属性，无法判定标记版本，降级为第三方导入路径`)
  }

  const version = Number(versionEntry.value)
  if (!Number.isInteger(version)) {
    return degraded(`${MARK_VERSION_PROPERTY} 非法（${versionEntry.value}），降级为第三方导入路径`)
  }
  if (version !== MARK_VERSION) {
    return degraded(
      `标记版本 ${version} 与当前实现 ${MARK_VERSION} 不一致，降级为第三方导入路径`,
    )
  }

  const marksEntry = entries.find((e) => e.name === MARKS_PROPERTY)
  if (!marksEntry) {
    return degraded(`缺少 ${MARKS_PROPERTY} 属性，降级为第三方导入路径`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(marksEntry.value)
  } catch {
    return degraded(`${MARKS_PROPERTY} 不是合法 JSON，降级为第三方导入路径`)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.components)) {
    return degraded(`${MARKS_PROPERTY} 结构非法（缺 components 数组），降级为第三方导入路径`)
  }

  const components: ComponentMark[] = []
  for (const raw of parsed.components) {
    if (!isRecord(raw) || typeof raw['data-rc-component-id'] !== 'string') {
      return degraded(`${MARKS_PROPERTY} 中存在缺少 data-rc-component-id 的条目，降级为第三方导入路径`)
    }
    if (!isRecord(raw['data-rc-style'])) {
      return degraded(`${MARKS_PROPERTY} 中 data-rc-style 非法，降级为第三方导入路径`)
    }
    components.push({
      'data-rc-component-id': raw['data-rc-component-id'],
      'data-rc-style': { ...(raw['data-rc-style'] as Record<string, unknown>) },
      'data-rc-mark-version':
        typeof raw['data-rc-mark-version'] === 'number' ? raw['data-rc-mark-version'] : version,
      bookmark: typeof raw.bookmark === 'string' ? raw.bookmark : '',
      order: typeof raw.order === 'number' ? raw.order : 0,
      type: typeof raw.type === 'string' ? raw.type : '',
      visible: raw.visible !== false,
    })
  }

  return {
    ok: true,
    mode: 'self-docx',
    manifest: { 'data-rc-mark-version': version, components },
    warnings: [],
  }
}

/**
 * 读取一份 DOCX 的结构标记（导入侧唯一入口）。
 * @param input customPropertiesXml 为 docProps/custom.xml 原文；documentXml 为 word/document.xml 原文（可选，用于书签交叉校验）
 */
export function readMarks(input: {
  customPropertiesXml?: string
  documentXml?: string
}): MarksReadResult {
  const { customPropertiesXml, documentXml } = input

  if (customPropertiesXml === undefined) {
    return {
      ok: false,
      mode: 'third-party',
      manifest: null,
      warnings: [],
      error: '未找到 docProps/custom.xml（标记载体缺失），降级为第三方导入路径',
    }
  }

  const result = parseMarksFromProperties(parsePropertiesFromXml(customPropertiesXml))
  if (!result.ok || result.manifest === null) return result

  // 书签交叉校验：manifest 是权威数据，书签缺失只降级单组件定位，不整体降级
  const warnings = [...result.warnings]
  if (documentXml !== undefined) {
    const names = new Set(extractBookmarkNames(documentXml))
    for (const component of result.manifest.components) {
      if (component.bookmark === '') continue
      if (!names.has(component.bookmark)) {
        warnings.push(
          `组件「${component['data-rc-component-id']}」的书签 ${component.bookmark} 缺失，该组件降级为按文本顺序匹配`,
        )
      }
    }
  }

  return { ...result, warnings }
}
