/**
 * DOCX 导出（TC-011 / fe-io）
 * 契约：docs/contract/CONTRACT.md §7
 * `exportDocx(doc, opts) → ExportResult{ ok, pageCount, bytes, warnings }`
 *
 * 不变量（契约 §7 不变量 1）：
 *   导出前必须调用质量检查；阻断级问题默认拦截，需用户显式确认才可强制导出（FR-EXP-003）。
 *
 * 不变量（契约 §7 不变量 5）：
 *   结构标记的命名与版本规则见 `docs/docx-mark-protocol.md`，实现见 `src/io/docx-marks.ts`。
 *
 * FR-EXP-002：DOCX 是「可编辑副本」——主要文本、格式、段落与页面设置尽量保留，
 *   但复杂版式由 Word 重新分页，非像素级还原。导出前 UI 必须明示该边界（EDITABLE_COPY_NOTICE）。
 */

import {
  BorderStyle,
  BookmarkEnd,
  BookmarkStart,
  Document,
  LineRuleType,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  bookmarkUniqueNumericId,
  convertMillimetersToTwip,
} from 'docx'
import type { ParagraphChild } from 'docx'

import { runQualityChecks } from '../quality'
import type { AnyComponent, ResumeComponent, ResumeDocument, UnknownComponent } from '../model/types'
import type { LayoutResult } from '../layout/types'
import {
  MARK_VERSION,
  bookmarkNameFor,
  buildMarks,
  marksToCustomProperties,
} from './docx-marks'

export type { ExportResult } from './export-pdf'
import type { ExportResult } from './export-pdf'

// ─── 类型 ────────────────────────────────────────────────

/**
 * 可编辑副本边界声明（FR-EXP-002）。
 * UI 在导出前必须向用户明示这段文案；导出结果的 warnings 中也会带一份。
 */
export const EDITABLE_COPY_NOTICE =
  'DOCX 为可编辑副本：主要文本与格式保留，复杂版式由 Word 重新分页，非像素级还原。需要一致排版请导出 PDF。'

/** 一行文本。role 决定默认样式档，style 可按行覆盖（键见 docx-style-map.md）。 */
export interface DocxLine {
  text: string
  role?: 'title' | 'body' | 'bullet'
  style?: Record<string, unknown>
}

/** 一个内容块：若干行，或一张表（数组对象字段渲染为表）。 */
export type DocxBlock =
  | { kind: 'lines'; lines: DocxLine[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }

/** 组件文本提取器。默认实现见 defaultBlocks；组件语义字段由 components 注册表解释。 */
export type ExtractBlocks = (componentId: string, doc: ResumeDocument) => DocxBlock[]

/** 导出选项 */
export interface ExportDocxOptions {
  /**
   * 阻断级问题是否强制导出（FR-EXP-003：需用户显式确认）。
   * 默认 false —— blocking 非空时直接拒绝。
   */
  forceExport?: boolean
  /**
   * 布局结果（TC-007 产出），仅供质量检查使用（DOCX 由 Word 重排，不按盒绘制）。
   * 缺省时按文档组件合成单页布局，使质量检查仍然执行（契约 §7 不变量 1）。
   */
  layout?: LayoutResult
  /** 是否埋入结构标记（FR-EXP-005）。默认 true。 */
  includeMarks?: boolean
  /** 自定义内容提取。缺省用 defaultBlocks。 */
  extractBlocks?: ExtractBlocks
}

/** TextRun 属性子集（样式映射目标，见 src/io/docx-style-map.md） */
interface RunProps {
  bold?: boolean
  italics?: boolean
  underline?: { type: (typeof UnderlineType)[keyof typeof UnderlineType] }
  color?: string
  /** 半磅（half-points）：12pt = 24 */
  size?: number
  font?: string
}

/** 段落级属性子集 */
interface ParaProps {
  spacing?: {
    before?: number
    after?: number
    line?: number
    lineRule?: (typeof LineRuleType)[keyof typeof LineRuleType]
  }
  indent?: { left?: number }
  border?: {
    bottom?: {
      style: (typeof BorderStyle)[keyof typeof BorderStyle]
      size: number
      color: string
    }
  }
}

// ─── 常量 ────────────────────────────────────────────────

const PT_TO_TWIP = 20
const PT_TO_HALF_POINT = 2
/** 行距倍数 → OOXML line（1 倍 = 240 twips） */
const LINE_RATIO_TO_TWIP = 240

/** 字体逻辑名 → DOCX 字体名（模型只存逻辑名） */
const FONT_MAP: Record<string, string> = {
  'rc-sans': 'Microsoft YaHei',
  sans: 'Microsoft YaHei',
  'rc-serif': 'SimSun',
  serif: 'SimSun',
}

/** 角色默认字号（pt） */
const ROLE_FONT_PT: Record<NonNullable<DocxLine['role']>, number> = {
  title: 13,
  body: 11,
  bullet: 10,
}

/** 默认提取器里视为「标题」的字段名片段 */
const TITLE_KEYS = ['title', 'name', 'school', 'company', 'position']

// ─── 样式映射（契约：src/io/docx-style-map.md） ───────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** '#RRGGBB' / 'RRGGBB' → 'RRGGBB'；非法值返回 undefined（忽略该键） */
function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const hex = value.trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : undefined
}

/**
 * 模型 style 字段 → DOCX Run 属性。
 * 支持键：bold / italic / underline / color / fontSizePt / titleSizePt /
 * titleWeight / fontFamily / font（完整映射表见 src/io/docx-style-map.md）。
 */
export function styleToRunProps(
  style: Record<string, unknown> | undefined,
  role: NonNullable<DocxLine['role']> = 'body',
): RunProps {
  const props: RunProps = {}
  if (!style) return props

  if (style.bold === true) props.bold = true
  else if (style.bold === false) props.bold = false

  if (style.italic === true) props.italics = true
  else if (style.italic === false) props.italics = false

  if (style.underline === true) props.underline = { type: UnderlineType.SINGLE }

  const color = normalizeColor(style.color)
  if (color !== undefined) props.color = color

  const sizePt =
    num(style.fontSizePt) ?? (role === 'title' ? num(style.titleSizePt) : undefined)
  if (sizePt !== undefined && sizePt > 0) props.size = Math.round(sizePt * PT_TO_HALF_POINT)

  if (role === 'title') {
    const weight = num(style.titleWeight)
    if (weight !== undefined) props.bold = weight >= 600
    else if (style.bold === undefined) props.bold = true
  }

  const fontRaw = style.fontFamily ?? style.font
  if (typeof fontRaw === 'string' && fontRaw.trim() !== '') {
    props.font = FONT_MAP[fontRaw] ?? fontRaw
  }

  return props
}

/**
 * 模型 style 字段 → DOCX 段落属性。
 * 支持键：lineHeight / gapAbovePt / marginBottomPt / gapBelowPt /
 * bulletIndentPt / ruleWidthPt（完整映射表见 src/io/docx-style-map.md）。
 */
export function styleToParaProps(
  style: Record<string, unknown> | undefined,
  role: NonNullable<DocxLine['role']> = 'body',
): ParaProps {
  const props: ParaProps = {}
  if (!style) return props

  const lineHeight = num(style.lineHeight)
  if (lineHeight !== undefined && lineHeight > 0) {
    props.spacing = {
      ...(props.spacing ?? {}),
      line: Math.round(lineHeight * LINE_RATIO_TO_TWIP),
      lineRule: LineRuleType.AUTO,
    }
  }

  const before = num(style.gapAbovePt)
  if (before !== undefined && before > 0) {
    props.spacing = { ...(props.spacing ?? {}), before: Math.round(before * PT_TO_TWIP) }
  }

  const after = num(style.marginBottomPt) ?? num(style.gapBelowPt)
  if (after !== undefined && after > 0) {
    props.spacing = { ...(props.spacing ?? {}), after: Math.round(after * PT_TO_TWIP) }
  }

  if (role === 'bullet') {
    const indent = num(style.bulletIndentPt)
    if (indent !== undefined && indent > 0) {
      props.indent = { left: Math.round(indent * PT_TO_TWIP) }
    }
  }

  if (role === 'title') {
    const rule = num(style.ruleWidthPt)
    if (rule !== undefined && rule > 0) {
      props.border = {
        bottom: {
          style: BorderStyle.SINGLE,
          size: Math.round(rule * 8),
          color: '000000',
        },
      }
    }
  }

  return props
}

// ─── 默认内容提取 ────────────────────────────────────────

function isUnknownComponent(component: AnyComponent): component is UnknownComponent {
  return 'unknown' in component && component.unknown === true
}

function isKnownComponent(component: AnyComponent): component is ResumeComponent {
  return !isUnknownComponent(component)
}

/** 从任意值收集纯文本叶子（未知组件用） */
function collectTextLeaves(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.trim() !== '') out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTextLeaves(item, out)
    return
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) collectTextLeaves(item, out)
  }
}

function cellText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === undefined || value === null) return ''
  return JSON.stringify(value)
}

/**
 * 默认内容提取：按字段类型产出块。
 *  - 非空字符串字段 → 行（title 类字段为标题行）
 *  - 字符串数组 → 要点行
 *  - 对象数组 → 表（列 = 各对象键的并集，按首个对象的键序）
 *  - 未知组件 → 其 raw 的全部文本叶子
 */
export function defaultBlocks(componentId: string, doc: ResumeDocument): DocxBlock[] {
  const component = doc.components.find((c) => c.id === componentId)
  if (!component) return []

  const blocks: DocxBlock[] = []

  if (isUnknownComponent(component)) {
    const leaves: string[] = []
    collectTextLeaves(component.raw, leaves)
    if (leaves.length > 0) {
      blocks.push({ kind: 'lines', lines: leaves.map((text) => ({ text, role: 'body' })) })
    }
    return blocks
  }

  if (!isKnownComponent(component)) return blocks

  let pending: DocxLine[] = []
  const flush = (): void => {
    if (pending.length > 0) {
      blocks.push({ kind: 'lines', lines: pending })
      pending = []
    }
  }

  for (const [key, value] of Object.entries(component.fields)) {
    if (typeof value === 'string' && value.trim() !== '') {
      const role = TITLE_KEYS.some((k) => key.toLowerCase().includes(k)) ? 'title' : 'body'
      pending.push({ text: value, role })
      continue
    }

    if (Array.isArray(value)) {
      const strings = value.filter(
        (item): item is string => typeof item === 'string' && item.trim() !== '',
      )
      const objects = value.filter((item): item is Record<string, unknown> => isRecord(item))

      if (strings.length > 0 && objects.length === 0) {
        for (const item of strings) pending.push({ text: item, role: 'bullet' })
        continue
      }

      if (objects.length > 0) {
        flush()
        const columns: string[] = []
        for (const obj of objects) {
          for (const key2 of Object.keys(obj)) {
            if (!columns.includes(key2)) columns.push(key2)
          }
        }
        const rows = objects.map((obj) => columns.map((col) => cellText(obj[col])))
        blocks.push({ kind: 'table', columns, rows })
        if (strings.length > 0) {
          for (const item of strings) pending.push({ text: item, role: 'bullet' })
        }
      }
    }
  }

  flush()
  return blocks
}

// ─── 渲染 ────────────────────────────────────────────────

/**
 * docx 9.x 的 ParagraphChild 联合类型未列入 BookmarkStart/BookmarkEnd，
 * 但文档示例明确支持把它们放进段落 children（跨段书签）。
 * 这里以 as ParagraphChild 显式收窄，语义上安全。
 */
type RenderedItem =
  | { kind: 'p'; children: ParagraphChild[]; props: ParaProps }
  | { kind: 't'; table: Table }

function runFor(line: DocxLine, componentStyle: Record<string, unknown> | undefined): TextRun {
  const role = line.role ?? 'body'
  const base: RunProps = {
    size: Math.round(ROLE_FONT_PT[role] * PT_TO_HALF_POINT),
    bold: role === 'title' ? true : undefined,
  }
  const fromComponent = styleToRunProps(componentStyle, role)
  const fromLine = styleToRunProps(line.style, role)
  const merged: RunProps = { ...base, ...fromComponent, ...fromLine }
  return new TextRun({ text: line.text, ...merged })
}

function renderBlock(
  block: DocxBlock,
  componentStyle: Record<string, unknown> | undefined,
): RenderedItem[] {
  if (block.kind === 'table') {
    const header = new TableRow({
      children: block.columns.map(
        (col) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })],
          }),
      ),
    })
    const body = block.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({ children: [new Paragraph({ children: [new TextRun(cell)] })] }),
          ),
        }),
    )
    return [{ kind: 't', table: new Table({ rows: [header, ...body] }) }]
  }

  return block.lines.map((line) => {
    const role = line.role ?? 'body'
    const mergedStyle = { ...(componentStyle ?? {}), ...(line.style ?? {}) }
    return {
      kind: 'p' as const,
      children: [runFor(line, componentStyle)],
      props: styleToParaProps(mergedStyle, role),
    }
  })
}

/**
 * 把组件的块渲染为段落/表列表，并用书签包住整组（FR-EXP-005 载体二）。
 * 书签名 = `rc{version}_{safeId}`，锚点范围从组件首段到末段。
 */
function renderComponent(
  component: AnyComponent,
  blocks: DocxBlock[],
): Array<Paragraph | Table> {
  const componentStyle = isKnownComponent(component) ? component.style : undefined
  const items: RenderedItem[] = []
  for (const block of blocks) items.push(...renderBlock(block, componentStyle))

  if (items.length === 0) {
    items.push({ kind: 'p', children: [], props: {} })
  }

  const name = bookmarkNameFor(component.id)
  const linkId = bookmarkUniqueNumericId()

  const paraIndexes = items
    .map((item, index) => (item.kind === 'p' ? index : -1))
    .filter((index) => index >= 0)
  const firstPara = paraIndexes[0]
  const lastPara = paraIndexes[paraIndexes.length - 1]

  return items.map((item, index) => {
    if (item.kind === 't') return item.table

    const children = [...item.children]
    if (index === firstPara) {
      // 跨段书签：BookmarkStart/End 运行时合法（见 docx 文档示例），类型上缺声明
      children.unshift(new BookmarkStart(name, linkId) as unknown as ParagraphChild)
    }
    if (index === lastPara) {
      children.push(new BookmarkEnd(linkId) as unknown as ParagraphChild)
    }
    return new Paragraph({ children, ...item.props })
  })
}

// ─── 布局合成（质量检查兜底） ────────────────────────────

/**
 * 未提供 LayoutResult 时合成单页布局：所有可见组件均等地落在内容区内。
 * 使 runQualityChecks 仍然执行（契约 §7 不变量 1）且不产生误阻断。
 */
export function synthesizeLayout(doc: ResumeDocument): LayoutResult {
  const ps = doc.pageSettings
  const contentX = ps.marginLeftMm
  const contentY = ps.marginTopMm
  const contentWidth = ps.widthMm - ps.marginLeftMm - ps.marginRightMm
  const contentHeight = ps.heightMm - ps.marginTopMm - ps.marginBottomMm

  const visible = [...doc.components]
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order)

  const pageBox = {
    pageIndex: 0,
    width: ps.widthMm,
    height: ps.heightMm,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
  }

  if (visible.length === 0) {
    return {
      boxes: [],
      pages: [],
      warnings: [],
      engineVersion: 'docx-synth-1',
      inputHash: `${doc.documentId}:empty`,
    }
  }

  const slot = contentHeight / visible.length
  const boxes = visible.map((component, index) => ({
    componentId: component.id,
    pageIndex: 0,
    fragmentIndex: 0,
    x: contentX,
    y: contentY + index * slot,
    width: contentWidth,
    height: slot,
  }))

  return {
    boxes,
    pages: [pageBox],
    warnings: [],
    engineVersion: 'docx-synth-1',
    inputHash: `${doc.documentId}:${visible.length}`,
  }
}

function pageCountOf(layout: LayoutResult): number {
  if (layout.pages.length === 0) return 0
  return layout.pages.reduce((max, page) => Math.max(max, page.pageIndex), 0) + 1
}

// ─── 主入口 ──────────────────────────────────────────────

/**
 * 导出 DOCX（契约 §7）。
 *
 * 流程：质量检查 → 阻断判定 → 构建 Document（页面设置 + 内容 + 结构标记）→ 打包字节。
 *
 * @param doc 文档模型（事实源）
 * @param opts 导出选项（layout 供质量检查；forceExport 需用户显式确认）
 */
export async function exportDocx(
  doc: ResumeDocument,
  opts: ExportDocxOptions = {},
): Promise<ExportResult> {
  // 1. 导出前质量检查（契约 §7 不变量 1）。DOCX 不按盒绘制，布局仅用于检查。
  const layout = opts.layout ?? synthesizeLayout(doc)
  const qualityReport = runQualityChecks({ doc, layout })

  if (qualityReport.blocking.length > 0 && !opts.forceExport) {
    return {
      ok: false,
      pageCount: 0,
      bytes: 0,
      warnings: [],
      qualityReport,
      error: `存在 ${qualityReport.blocking.length} 条阻断级问题，导出已被拦截（FR-EXP-003）。设置 forceExport=true 可强制导出。`,
    }
  }

  const warnings: string[] = [EDITABLE_COPY_NOTICE]

  // 2. 提取内容并渲染
  const extract = opts.extractBlocks ?? defaultBlocks
  const sorted = [...doc.components].sort((a, b) => a.order - b.order)

  const children: Array<Paragraph | Table> = []
  for (const component of sorted) {
    if (!component.visible) continue

    if (isUnknownComponent(component)) {
      warnings.push(
        `组件「${component.id}」为未知类型（${component.originalType}），已按纯文本导出，重新导入时走第三方路径。`,
      )
    }

    const blocks = extract(component.id, doc)
    children.push(...renderComponent(component, blocks))
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [] }))
    warnings.push('文档无可见组件，导出为空白页。')
  }

  warnings.push('DOCX 页数为估算值，实际分页由 Word 排版决定。')

  // 3. 结构标记（FR-EXP-005）
  const includeMarks = opts.includeMarks !== false
  const customProperties = includeMarks
    ? marksToCustomProperties(buildMarks(doc)).map((entry) => ({
        name: entry.name,
        value: entry.value,
      }))
    : []

  // 4. 页面设置（FR-EXP-002：尽量保留）
  const ps = doc.pageSettings
  const orientation =
    ps.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT

  const document = new Document({
    title: doc.meta.title,
    creator: 'ResumeCraft',
    description: EDITABLE_COPY_NOTICE,
    customProperties,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(ps.widthMm),
              height: convertMillimetersToTwip(ps.heightMm),
              orientation,
            },
            margin: {
              top: convertMillimetersToTwip(ps.marginTopMm),
              right: convertMillimetersToTwip(ps.marginRightMm),
              bottom: convertMillimetersToTwip(ps.marginBottomMm),
              left: convertMillimetersToTwip(ps.marginLeftMm),
            },
          },
        },
        children,
      },
    ],
  })

  // 5. 打包字节。Result 模式：不抛异常（契约 §11）。
  try {
    const data = await Packer.pack(document, 'uint8array')
    return {
      ok: true,
      pageCount: pageCountOf(layout),
      bytes: data.length,
      warnings,
      qualityReport,
      data,
    }
  } catch (cause) {
    return {
      ok: false,
      pageCount: 0,
      bytes: 0,
      warnings,
      qualityReport,
      error: `DOCX 打包失败：${cause instanceof Error ? cause.message : String(cause)}`,
    }
  }
}

/** 当前结构标记协议版本（与 docx-marks.MARK_VERSION 同源）。 */
export const DOCX_MARK_VERSION = MARK_VERSION
