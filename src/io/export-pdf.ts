/**
 * PDF 导出（TC-010 / fe-io）
 * 契约：docs/contract/CONTRACT.md §7
 * `exportPdf(doc, layout, opts) → ExportResult{ ok, pageCount, bytes, warnings, fontSubstituted }`
 *
 * 不变量（契约 §7 不变量 1）：
 *   导出前必须调用质量检查；阻断级问题默认拦截，需用户显式确认才可强制导出（FR-EXP-003）。
 *
 * 关键约束（PRD 13.1#10 已核实的坑）：
 *   - 中文必须嵌入 TTF（OTF/CFF 在 Chrome PDF 渲染中不出字）
 *   - 子集化（subset:true）以控制 PDF 体积
 *   - 可变字体需先固定字重（我们用的是已实例化的静态 TTF）
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

import { runQualityChecks } from '../quality'
import type { QualityReport } from '../quality'
import type { ResumeDocument } from '../model/types'
import type { ComponentBox, LayoutResult } from '../layout/types'

// ─── 类型 ────────────────────────────────────────────────

/** 字体资源：key 为逻辑名（'rc-sans' / 'rc-serif'），value 为 TTF 字节 */
export type FontBytesMap = Record<string, Uint8Array>

/** 导出选项 */
export interface ExportPdfOptions {
  /**
   * 阻断级问题是否强制导出（FR-EXP-003：需用户显式确认）。
   * 默认 false —— blocking 非空时直接拒绝。
   */
  forceExport?: boolean
  /**
   * 字体字节。生产环境由调用方从 `src/assets/fonts/ttf/` 加载后传入；
   * 测试可传 mock。缺省时降级到 StandardFonts（仅英文，中文显示豆腐块）。
   */
  fonts?: FontBytesMap
  /** 组件文本提取器。不同组件类型由 components 注册表提供字段 → 文本的映射 */
  extractText?: (componentId: string, doc: ResumeDocument) => TextRun[]
}

/** 一段文本运行：同一组件内可有多段（如标题 + 正文） */
export interface TextRun {
  text: string
  fontKey?: 'rc-sans' | 'rc-serif'
  fontSizePt?: number
  bold?: boolean
  /** 相对组件盒的偏移（pt）。缺省从盒顶开始 */
  offsetX?: number
  offsetY?: number
  /** 行高（pt）。缺省 fontSize * 1.5 */
  lineHeight?: number
}

/** 导出结果。契约 §7 原文字段 + 扩展 */
export interface ExportResult {
  ok: boolean
  pageCount: number
  /** PDF 文件字节数 */
  bytes: number
  warnings: string[]
  /** 是否发生了字体替代（true = 中文可能显示异常）。DOCX 导出不适用，保留字段兼容（TC-011） */
  fontSubstituted?: boolean
  /** 导出前质量检查报告（即使 forceExport 也返回） */
  qualityReport: QualityReport
  /** 导出被阻断时的错误信息 */
  error?: string
  /** PDF 文件字节（ok=true 时有值） */
  data?: Uint8Array
}

// ─── 常量 ────────────────────────────────────────────────

/** pt → mm 换算。PDF 用 pt（1/72 inch），布局用 mm。 */
const MM_TO_PT = 72 / 25.4

/** 默认行距倍数 */
const DEFAULT_LINE_HEIGHT_RATIO = 1.5

// ─── 坐标转换 ────────────────────────────────────────────

/**
 * 布局坐标（左上原点，mm）→ PDF 坐标（左下原点，pt）。
 * PDF 页面高度 - (布局 Y + 高度) 即可翻转 Y 轴。
 */
function toPdfY(layoutY: number, height: number, pageHeightMm: number): number {
  return (pageHeightMm - layoutY - height) * MM_TO_PT
}

function toPdfX(layoutX: number): number {
  return layoutX * MM_TO_PT
}

function mmToPt(mm: number): number {
  return mm * MM_TO_PT
}

// ─── 字体管理 ────────────────────────────────────────────

interface EmbeddedFont {
  regular: PDFFont
  bold: PDFFont
  serif: PDFFont
  substituted: boolean
}

async function embedFonts(pdf: PDFDocument, fonts?: FontBytesMap): Promise<EmbeddedFont> {
  pdf.registerFontkit(fontkit)

  const hasSans = fonts?.['rc-sans'] !== undefined
  const hasSerif = fonts?.['rc-serif'] !== undefined

  if (hasSans && fonts) {
    const regular = await pdf.embedFont(fonts['rc-sans'], { subset: true })
    // 用 700 字重做 bold；缺省降级到同一个字重
    const bold = fonts['rc-sans-bold']
      ? await pdf.embedFont(fonts['rc-sans-bold'], { subset: true })
      : regular
    const serif = hasSerif && fonts['rc-serif']
      ? await pdf.embedFont(fonts['rc-serif'], { subset: true })
      : regular
    return { regular, bold, serif, substituted: false }
  }

  // 降级：StandardFonts（不支持中文，会有豆腐块）
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    substituted: true,
  }
}

// ─── 文本绘制 ────────────────────────────────────────────

function drawTextRuns(
  page: PDFPage,
  box: ComponentBox,
  runs: TextRun[],
  fonts: EmbeddedFont,
  pageHeightMm: number,
): string[] {
  const warnings: string[] = []
  let cursorY = box.y

  for (const run of runs) {
    const fontSizePt = run.fontSizePt ?? 11
    const lineHeightPt = run.lineHeight ?? fontSizePt * DEFAULT_LINE_HEIGHT_RATIO
    const font =
      run.bold ? fonts.bold
      : run.fontKey === 'rc-serif' ? fonts.serif
      : fonts.regular

    const x = toPdfX(box.x + (run.offsetX ?? 0))
    const y = toPdfY(cursorY + (run.offsetY ?? 0), 0, pageHeightMm)

    try {
      page.drawText(run.text, {
        x,
        y,
        size: fontSizePt,
        font,
        color: rgb(0, 0, 0),
      })
    } catch {
      warnings.push(`组件「${box.componentId}」的文本渲染失败：${run.text.slice(0, 20)}…`)
    }

    cursorY += lineHeightPt / MM_TO_PT // 转回 mm 供下一段定位
  }

  return warnings
}

// ─── 主入口 ──────────────────────────────────────────────

/**
 * 导出 PDF（契约 §7 唯一入口）。
 *
 * 流程：质量检查 → 阻断判定 → 创建 PDF → 嵌入字体 → 按 LayoutResult 逐页绘制 → 输出字节
 *
 * @param doc 文档模型（事实源）
 * @param layout 布局结果（TC-007 产出）
 * @param opts 导出选项（fonts 必传才能正确显示中文）
 */
export async function exportPdf(
  doc: ResumeDocument,
  layout: LayoutResult,
  opts: ExportPdfOptions = {},
): Promise<ExportResult> {
  // 1. 导出前质量检查（契约 §7 不变量 1）
  const qualityReport = runQualityChecks({ doc, layout })

  if (qualityReport.blocking.length > 0 && !opts.forceExport) {
    return {
      ok: false,
      pageCount: 0,
      bytes: 0,
      warnings: [],
      fontSubstituted: false,
      qualityReport,
      error: `存在 ${qualityReport.blocking.length} 条阻断级问题，导出已被拦截（FR-EXP-003）。设置 forceExport=true 可强制导出。`,
    }
  }

  // 2. 创建 PDF
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.meta.title)
  pdf.setCreator('ResumeCraft')

  // 3. 嵌入字体
  const fonts = await embedFonts(pdf, opts.fonts)
  const warnings: string[] = []

  if (fonts.substituted) {
    warnings.push('中文字体未加载，中文字符可能显示为方块。请确认字体资源已正确加载。')
  }

  // 4. 逐页绘制
  const pageMap = new Map(layout.pages.map((p) => [p.pageIndex, p]))
  const pageCount = layout.pages.length > 0
    ? layout.pages.reduce((m, p) => Math.max(m, p.pageIndex), 0) + 1
    : 0

  for (let i = 0; i < pageCount; i += 1) {
    const pageBox = pageMap.get(i)
    if (!pageBox) continue

    const pageWidthPt = mmToPt(pageBox.width)
    const pageHeightPt = mmToPt(pageBox.height)
    const pdfPage = pdf.addPage([pageWidthPt, pageHeightPt])

    // 绘制该页上的所有组件文本
    const boxesOnPage = layout.boxes.filter((b) => b.pageIndex === i)
    for (const box of boxesOnPage) {
      const runs = opts.extractText
        ? opts.extractText(box.componentId, doc)
        : defaultTextExtractor(box.componentId, doc)

      if (runs.length > 0) {
        const textWarnings = drawTextRuns(pdfPage, box, runs, fonts, pageBox.height)
        warnings.push(...textWarnings)
      }
    }
  }

  // 5. 保存字节
  const data = await pdf.save({ useObjectStreams: true })

  return {
    ok: true,
    pageCount,
    bytes: data.length,
    warnings,
    fontSubstituted: fonts.substituted,
    qualityReport,
    data,
  }
}

// ─── 默认文本提取器 ──────────────────────────────────────

/**
 * 默认的文本提取逻辑。按组件类型从 fields 中提取可读文本。
 * 组件语义字段由 TC-005 注册表定义；此处只做通用提取。
 */
function defaultTextExtractor(componentId: string, doc: ResumeDocument): TextRun[] {
  const component = doc.components.find((c) => c.id === componentId)
  if (!component) return []
  if ('unknown' in component && component.unknown) return []
  if (!('fields' in component)) return []

  const runs: TextRun[] = []
  const fields = component.fields

  // 常见字段名 → 文本段的通用映射
  const titleKeys = ['title', 'name', 'school', 'company', 'position']

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value.trim() === '') continue

    const isTitle = titleKeys.some((k) => key.toLowerCase().includes(k))
    runs.push({
      text: value,
      fontSizePt: isTitle ? 13 : 11,
      bold: isTitle,
      fontKey: 'rc-sans',
    })
  }

  // 数组字段（如 items[]）
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (typeof item === 'string' && item.trim() !== '') {
        runs.push({ text: `• ${item}`, fontSizePt: 10, fontKey: 'rc-sans' })
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        for (const v of Object.values(obj)) {
          if (typeof v === 'string' && v.trim() !== '') {
            runs.push({ text: v, fontSizePt: 10, fontKey: 'rc-sans' })
          }
        }
      }
    }
  }

  return runs
}
