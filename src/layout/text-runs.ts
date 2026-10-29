/**
 * 文本段提取（接线层，TC-006 / TC-007 的共用输入）
 *
 * 职责边界（刻意收窄）：
 *   只回答一个问题 ——「一个组件在给定语言轨下，会产生哪几段文字，各自多大字号、什么角色」。
 *   **不测量、不换行、不排版、不渲染**。测量归 measure.ts，翻页归 pagination.ts。
 *
 * 为什么必须收成独立模块：
 *   PDF 导出与 DOCX 导出此前各写了一套启发式提取器，画布渲染又要再来一套，
 *   三处一旦对不上，就会出现「屏幕上三行、导出两行」。三方改为共用本模块后，
 *   语言轨裁剪、日期合并、要点拆行只有一份实现。
 *
 * 三条不变量：
 *  1. **语言轨裁剪只走注册表**（`componentRegistry.fieldsFor`）。本文件与布局层
 *     不许出现 `if (track === 'en')`（契约 §3 不变量 2）。
 *  2. **未知组件一个字节都不丢**：`unknown: true` 的组件从 `raw` 递归收集文本叶子。
 *  3. 纯函数：不读 store / DOM / 时钟 / 随机数。同输入必同输出（顺序也一致）。
 */

import { componentRegistry } from '../components/runtime'
import { fieldLabel } from '../components/registry'
import type { AnyComponent, LanguageTrack, ResumeDocument, UnknownComponent } from '../model/types'

/**
 * 文本段角色。决定默认字号、字重、以及"在纸面上长成什么样"。
 *
 * 2026-10-29 E 段：由 v1 的三角色（title/body/bullet）升级为八角色，
 * 与设计稿纸面的排版结构一一对应（`docs/design/mockups/figma/app.css` §8）：
 *
 *   name      → .p-name       30px/22.5pt   姓名
 *   intent    → .p-intent     13px/9.75pt   求职意向（带标签前缀）
 *   contact   → .p-contact    11px/8.25pt   联系方式行
 *   section   → .p-sec__title 17px/12.75pt  小节标题（组件 displayName）
 *   item-title→ .p-item__name 14px/10.5pt   条目标题（右对齐日期走 trailing）
 *   item-role → .p-item__role 11.5px/8.625pt 角色/学历行
 *   bullet    → .p-bullets li 14px/10.5pt   要点
 *   plain     → .p-plain      14px/10.5pt   普通段落
 *
 * **UI 只认 role，不认 component.type**：画布/导出按 role 分支渲染，
 * "哪个组件是小节、哪个是抬头"的知识只存在于本文件。
 * 否则 UI 里会写出第二份语义，将来 text-runs 一改，画布与导出就分叉。
 */
export type TextRunRole =
  | 'name'
  | 'intent'
  | 'contact'
  | 'section'
  | 'item-title'
  | 'item-role'
  | 'bullet'
  | 'plain'

export interface TextRunSpec {
  text: string
  role: TextRunRole
  fontSizePt: number
  /** 行高倍数 */
  lineHeight: number
  bold: boolean
  /**
   * 同行右对齐的补充文本，目前只有 item-title 用（起止日期）。
   * 设计稿的 `.p-item__head` 是「名称 + 日期」两端对齐一行，
   * 测量时正文按「内容宽 − trailing 宽 − 间距」折行。
   */
  trailing?: string
}

/** 设计稿纸面字号（px）→ pt 的换算结果，1px = 0.75pt。见 ui-restore-plan.md §6.2。 */
const ROLE_STYLE: Record<TextRunRole, RunStyle> = {
  name: { fontSizePt: 22.5, lineHeight: 1.15, bold: true },
  intent: { fontSizePt: 9.75, lineHeight: 1.5, bold: false },
  contact: { fontSizePt: 8.25, lineHeight: 1.75, bold: false },
  section: { fontSizePt: 12.75, lineHeight: 1.5, bold: true },
  'item-title': { fontSizePt: 10.5, lineHeight: 1.35, bold: true },
  'item-role': { fontSizePt: 8.625, lineHeight: 1.5, bold: false },
  bullet: { fontSizePt: 10.5, lineHeight: 1.62, bold: false },
  plain: { fontSizePt: 10.5, lineHeight: 1.62, bold: false },
}

/** item-title 与其 trailing 之间的水平间距（px），与设计稿 `.p-item__head` 的 gap:12px 一致 */
export const TRAILING_GAP_PX = 12

/**
 * 八角色 → 导出层三档的降级映射。
 * PDF / DOCX 的 `TextRun.role` / `DocxLine.role` 只认 `title | body | bullet`
 * （那是导出格式的档位，不是纸面语义），所以这里显式降级，不要在导出层再判一次。
 */
export function toExportRole(role: TextRunRole): 'title' | 'body' | 'bullet' {
  if (role === 'name' || role === 'section') return 'title'
  if (role === 'bullet') return 'bullet'
  return 'body'
}

export interface ComponentTextBlock {
  componentId: string
  /** 组件类型；未知组件为 originalType */
  type: string
  runs: TextRunSpec[]
  /** 组件内上下留白（mm），参与块高计算 */
  paddingTopMm: number
  paddingBottomMm: number
}

/**
 * 起止时间的连接符。设计稿 `01-editor.html` 的 `.p-item__date` 写的是
 * `2022.09-2026.06`（无空格短横），照抄；不要改回长横，否则与稿子不一致。
 */
const DATE_RANGE_SEPARATOR = '-'

/** 非表头组件的默认段后留白（mm）。段前默认 0：组件间距由 compose 的 gap 统一负责。 */
const DEFAULT_PADDING_BOTTOM_MM = 2

/**
 * 表头类组件：整份简历的抬头（姓名、联系方式），不是小节，因此不占段前段后留白。
 * P0 只有 basics 一个。这里是**布局语义常量**，与语言轨无关，所以放在本文件不违反不变量 1。
 */
const HEADER_COMPONENT_TYPES: ReadonlySet<string> = new Set(['basics'])

/**
 * 字段 → 行角色映射（**纸面语义的唯一所在地**）。
 * UI 不得再写一份，否则画布与导出会分叉。
 *
 * 说明：`skip` 是"这个字段的文本并进别的行"（日期进 trailing、照片不渲染），
 * 不是"忽略该字段"——它的值仍会被别的行消费。
 */
type FieldRole =
  | 'name'
  | 'intent'
  | 'contact-part'
  | 'title-part'
  | 'role-part'
  | 'plain-part'
  | 'bullet'
  | 'skip'

const FIELD_ROLE_BY_TYPE: Record<string, Record<string, FieldRole>> = {
  basics: {
    name: 'name',
    objective: 'intent',
    phone: 'contact-part',
    email: 'contact-part',
    location: 'contact-part',
    // 照片是 zh 轨专有字段。设计稿把它画成 .p-photo 占位框（不承载文字），
    // 但用户填的值不能丢，所以降级成一行 plain 渲染出来。
    photo: 'plain-part',
  },
  education: {
    school: 'title-part',
    major: 'title-part',
    degree: 'role-part',
    gpa: 'role-part',
    courses: 'bullet',
    start: 'skip',
    end: 'skip',
  },
  experience: {
    company: 'title-part',
    role: 'title-part',
    bullets: 'bullet',
    start: 'skip',
    end: 'skip',
  },
  projects: {
    name: 'title-part',
    role: 'role-part',
    tech: 'role-part',
    bullets: 'bullet',
    start: 'skip',
    end: 'skip',
  },
  skills: {
    name: 'plain-part',
    level: 'plain-part',
    evidence: 'plain-part',
  },
  awards: {
    name: 'title-part',
    note: 'plain-part',
    date: 'skip',
  },
}

/** 未知组件（含将来新增类型）一律走 plain，不臆造小节结构 */
const FALLBACK_FIELD_ROLE: FieldRole = 'plain-part'

function fieldRoleFor(type: string, key: string): FieldRole {
  return FIELD_ROLE_BY_TYPE[type]?.[key] ?? FALLBACK_FIELD_ROLE
}

/** 未知组件 raw 的递归深度上限：外部 JSON 可能有自引用，宁可截断也不栈溢出。 */
const MAX_RAW_DEPTH = 8

interface RunStyle {
  fontSizePt: number
  lineHeight: number
  bold: boolean
}

interface BlockPaddings {
  paddingTopMm: number
  paddingBottomMm: number
}

function isUnknownComponent(component: AnyComponent): component is UnknownComponent {
  return 'unknown' in component && component.unknown === true
}

/** 取非空文本。空串与纯空白一律视为「没填」，不产生文本段。 */
function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** 列表字段里只保留非空字符串项 */
function listItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    const text = asText(item)
    if (text !== null) items.push(text)
  }
  return items
}

/** 正数覆盖才生效，避免 style 里的 0 / NaN 把字号压没 */
function positiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

/** 角色默认档 + 组件级样式覆盖（只认 number / boolean，类型不对就忽略，不抛） */
function resolveRunStyle(role: TextRunRole, style?: Record<string, unknown>): RunStyle {
  const base = ROLE_STYLE[role]
  const resolved: RunStyle = {
    fontSizePt: base.fontSizePt,
    lineHeight: base.lineHeight,
    bold: base.bold,
  }
  if (!style) return resolved

  const size = positiveNumber(style.fontSizePt)
  if (size !== null) resolved.fontSizePt = size

  const lineHeight = positiveNumber(style.lineHeight)
  if (lineHeight !== null) resolved.lineHeight = lineHeight

  if (typeof style.bold === 'boolean') resolved.bold = style.bold

  return resolved
}

/** 组件内留白。style 的 spacingBeforeMm / spacingAfterMm 优先于类型默认值。 */
function resolvePaddings(type: string, style?: Record<string, unknown>): BlockPaddings {
  const isHeader = HEADER_COMPONENT_TYPES.has(type)
  let paddingTopMm = 0
  let paddingBottomMm = isHeader ? 0 : DEFAULT_PADDING_BOTTOM_MM

  if (style) {
    const before = nonNegativeNumber(style.spacingBeforeMm)
    if (before !== null) paddingTopMm = before
    const after = nonNegativeNumber(style.spacingAfterMm)
    if (after !== null) paddingBottomMm = after
  }

  return { paddingTopMm, paddingBottomMm }
}

function makeRun(
  text: string,
  role: TextRunRole,
  style?: Record<string, unknown>,
  trailing?: string,
): TextRunSpec {
  const resolved = resolveRunStyle(role, style)
  const run: TextRunSpec = {
    text,
    role,
    fontSizePt: resolved.fontSizePt,
    lineHeight: resolved.lineHeight,
    bold: resolved.bold,
  }
  if (trailing !== undefined && trailing !== '') run.trailing = trailing
  return run
}

/** 同类片段拼成一行：丢掉空值，用「空格 · 空格」连接（与设计稿一致） */
function joinParts(parts: readonly string[]): string | null {
  const kept = parts.filter((part) => part !== '')
  return kept.length === 0 ? null : kept.join(' · ')
}

/**
 * 从未知组件的 raw 里递归收集文本叶子。
 * 保持对象键的插入顺序（JSON 反序列化的自然顺序），保证同一份数据每次收集结果一致。
 */
function collectRawText(value: unknown, depth: number, out: string[]): void {
  if (depth > MAX_RAW_DEPTH) return

  if (typeof value === 'string') {
    const text = asText(value)
    if (text !== null) out.push(text)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectRawText(item, depth + 1, out)
    return
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      collectRawText(record[key], depth + 1, out)
    }
  }
}

/**
 * 单个组件的文本块。
 * @param component 任意组件（含未知组件）
 * @param track 语言轨，只用于向注册表要字段清单
 * @param style 覆盖样式（模板的 ComponentStyle 形状）；不传则用组件自带的 style
 * @param options.emitSection 是否在正文前补一行小节标题（组件 displayName）。
 *        抬头组件永远不补；同类型连续组件只有首个补（见 documentTextBlocks）。
 */
export function componentTextBlock(
  component: AnyComponent,
  track: LanguageTrack,
  style?: Record<string, unknown>,
  options: { emitSection?: boolean } = {},
): ComponentTextBlock {
  const unknown = isUnknownComponent(component)
  const type = unknown ? component.originalType : component.type
  const styleRecord = style ?? (unknown ? undefined : component.style)
  const paddings = resolvePaddings(type, styleRecord)
  const isHeader = HEADER_COMPONENT_TYPES.has(type)

  if (unknown) {
    const texts: string[] = []
    collectRawText(component.raw, 0, texts)
    const content: TextRunSpec[] = texts.map((text) => makeRun(text, 'plain', styleRecord))
    return {
      componentId: component.id,
      type,
      runs: prependSection(content, type, options, styleRecord),
      paddingTopMm: paddings.paddingTopMm,
      paddingBottomMm: paddings.paddingBottomMm,
    }
  }

  const fields = componentRegistry.fieldsFor(component.type, track)
  const values = component.fields

  // 按角色分桶；日期单独收，最后折成 trailing
  const nameParts: string[] = []
  const intentParts: string[] = []
  const contactParts: string[] = []
  const titleParts: string[] = []
  const roleParts: string[] = []
  const plainParts: string[] = []
  const bullets: string[] = []
  const dateValues: string[] = []

  for (const field of fields) {
    if (field.kind === 'date') {
      const dateText = asText(values[field.key])
      if (dateText !== null) dateValues.push(dateText)
      continue
    }

    const role = fieldRoleFor(type, field.key)
    if (role === 'bullet') {
      bullets.push(...listItems(values[field.key]))
      continue
    }

    const text = asText(values[field.key])
    if (text === null) continue

    switch (role) {
      case 'name':
        nameParts.push(text)
        break
      case 'intent':
        // 设计稿 `.p-intent` 是「求职意向 · 前端开发工程师」，标签前缀一起进正文
        intentParts.push(`${fieldLabel(field, track)} · ${text}`)
        break
      case 'contact-part':
        contactParts.push(text)
        break
      case 'title-part':
        titleParts.push(text)
        break
      case 'role-part':
        roleParts.push(text)
        break
      case 'plain-part':
      default:
        plainParts.push(text)
        break
    }
  }

  const trailing = dateValues.length >= 1 ? dateValues.join(DATE_RANGE_SEPARATOR) : undefined
  const content: TextRunSpec[] = []

  if (isHeader) {
    // 抬头组件：姓名 / 求职意向 / 联系方式。联系方式在设计稿里是两行
    // 「城市 · 电话」+「邮箱」，所以邮箱单独成行，其余拼一行。
    const name = joinParts(nameParts)
    if (name !== null) content.push(makeRun(name, 'name', styleRecord))
    for (const intent of intentParts) content.push(makeRun(intent, 'intent', styleRecord))

    const emailParts = contactParts.filter((part) => part.includes('@'))
    const otherParts = contactParts.filter((part) => !part.includes('@'))
    const headLine = joinParts(otherParts)
    if (headLine !== null) content.push(makeRun(headLine, 'contact', styleRecord))
    for (const email of emailParts) content.push(makeRun(email, 'contact', styleRecord))

    // 抬头里的其余文本（目前只有 zh 轨的 photo）不能丢
    for (const part of plainParts) content.push(makeRun(part, 'plain', styleRecord))
  } else {
    const title = joinParts(titleParts)
    if (title !== null) content.push(makeRun(title, 'item-title', styleRecord, trailing))
    else if (trailing !== undefined) {
      // 标题没填但有日期：日期不该凭空消失，降级成一行 meta
      content.push(makeRun(trailing, 'item-role', styleRecord))
    }

    const roleLine = joinParts(roleParts)
    if (roleLine !== null) content.push(makeRun(roleLine, 'item-role', styleRecord))

    const plainLine = joinParts(plainParts)
    if (plainLine !== null) content.push(makeRun(plainLine, 'plain', styleRecord))

    for (const bullet of bullets) content.push(makeRun(bullet, 'bullet', styleRecord))
  }

  return {
    componentId: component.id,
    type,
    runs: prependSection(content, type, options, styleRecord),
    paddingTopMm: paddings.paddingTopMm,
    paddingBottomMm: paddings.paddingBottomMm,
  }
}

/**
 * 小节标题：只有非抬头组件、且同类型分组的首个组件才出。
 * 判定放在 `documentTextBlocks`（它知道文档全局顺序），本函数只按指令办事。
 */
function prependSection(
  content: TextRunSpec[],
  type: string,
  options: { emitSection?: boolean },
  style?: Record<string, unknown>,
): TextRunSpec[] {
  if (options.emitSection !== true) return content
  if (content.length === 0) return content
  const def = componentRegistry.get(type)
  const label = def?.displayName ?? type
  return [makeRun(label, 'section', style), ...content]
}

/**
 * 文档内全部可见组件的文本块，按 order 升序。
 * **可见性过滤只在这里做一次**，布局与渲染都拿这份结果，避免两处各判一次 `visible`。
 *
 * 小节标题的归属规则：同类型的**连续**可见组件共用一个小节标题
 * （两条项目经历 → 一个「项目经历」小节 + 两个条目），
 * 中间隔了别的类型就再起一个（A B A → 两个 A 小节）。
 * 抬头组件（basics）永远不带小节标题。
 */
export function documentTextBlocks(doc: ResumeDocument): ComponentTextBlock[] {
  const visible = doc.components.filter((component) => component.visible)
  visible.sort((a, b) => a.order - b.order)

  const blocks: ComponentTextBlock[] = []
  let previousType: string | null = null
  for (const component of visible) {
    const type = isUnknownComponent(component) ? component.originalType : component.type
    const isHeader = HEADER_COMPONENT_TYPES.has(type)
    const emitSection = !isHeader && type !== previousType
    blocks.push(componentTextBlock(component, doc.languageTrack, undefined, { emitSection }))
    previousType = type
  }
  return blocks
}
