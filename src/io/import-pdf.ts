/**
 * PDF 导入（TC-012 / 子步 B）
 * pdfjs-dist 文本+坐标提取 → 启发式版面分析 → 模块识别
 * 扫描件检测提示（FR-IMP-003，不做 OCR）
 *
 * 契约 §7 不变量：
 *  2. 导入失败不破坏原文件（FR-IMP-007）
 *  3. 未识别块进 pending[]（FR-IMP-008）
 *  4. sourceKind = 'pdf'
 */

import type { ImportReport, RecognitionProvider, SourceKind } from './recognition-provider'
import { inferComponentType } from './import-map'
import { pendingItemsToComponents, recognizedBlocksToComponents } from './import-bridge'
import type { ResumeDocument } from '../model/types'
import { createDocument } from '../model/factory'

// ─── pdfjs-dist 可注入接口 ──────────────────────────────

export interface PdfTextItem {
  str: string
  transform: number[] // [a, b, c, d, e, f] — e=x, f=y
  width: number
  height: number
}

export interface PdfPageContent {
  items: PdfTextItem[]
}

export interface PdfDocLike {
  numPages: number
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<PdfPageContent>
  }>
  destroy?(): void
}

export interface ImportPdfOptions {
  /** 注入 pdfjs getDocument（测试可 mock） */
  getDocument?: (data: ArrayBuffer) => Promise<PdfDocLike>
}

// ─── 版面分析 ──────────────────────────────────────────

/** 按 Y 坐标聚类行（同一行的文字 Y 坐标相近） */
function clusterLines(items: PdfTextItem[]): PdfTextItem[][] {
  if (items.length === 0) return []

  // 按 Y 降序排列（PDF 坐标原点在左下）
  const sorted = [...items].sort((a, b) => (b.transform[5] ?? 0) - (a.transform[5] ?? 0))
  const lines: PdfTextItem[][] = []
  let currentLine: PdfTextItem[] = [sorted[0]!]
  let currentY = sorted[0]!.transform[5] ?? 0

  for (let i = 1; i < sorted.length; i += 1) {
    const item = sorted[i]!
    const y = item.transform[5] ?? 0
    const tolerance = (item.height || 12) * 0.5

    if (Math.abs(y - currentY) <= tolerance) {
      currentLine.push(item)
    } else {
      lines.push(currentLine)
      currentLine = [item]
      currentY = y
    }
  }
  lines.push(currentLine)

  // 每行内按 X 降序排列
  return lines.map((line) => line.sort((a, b) => (b.transform[4] ?? 0) - (a.transform[4] ?? 0)))
}

/** 行数组 → 文本 */
function lineToText(line: PdfTextItem[]): string {
  return line.map((item) => item.str).join('').trim()
}

// ─── 主入口 ──────────────────────────────────────────────

/**
 * 导入 PDF（契约 §7）。
 */
export async function importPdf(data: ArrayBuffer, opts: ImportPdfOptions = {}): Promise<ImportReport> {
  const blocks: ImportReport['blocks'] = []
  const pending: ImportReport['pending'] = []
  const warnings: string[] = []

  if (!opts.getDocument) {
    return {
      blocks: [],
      confidence: 0,
      pending: [{ raw: '[PDF 内容]', reason: '未提供 PDF 解析器' }],
      warnings: ['未注入 getDocument 实现，无法解析 PDF'],
      sourceKind: 'pdf' as SourceKind,
    }
  }

  let doc: PdfDocLike
  try {
    doc = await opts.getDocument(data)
  } catch (e) {
    return {
      blocks: [],
      confidence: 0,
      pending: [],
      warnings: [`PDF 解析失败：${e instanceof Error ? e.message : '未知错误'}`],
      sourceKind: 'pdf' as SourceKind,
    }
  }

  try {
    const allLines: string[] = []

    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const lines = clusterLines(content.items)

      for (const line of lines) {
        const text = lineToText(line)
        if (text) allLines.push(text)
      }
    }

    // 扫描件检测（FR-IMP-003）：文本极少 → 可能是扫描件
    const totalText = allLines.join('')
    if (totalText.length < 50) {
      warnings.push('文本内容极少，可能是扫描件 PDF。当前版本不支持 OCR，请使用文本型 PDF。')
      return {
        blocks: [],
        confidence: 0,
        pending: [{ raw: '[扫描件]', reason: '文本内容极少，疑似扫描件（不做 OCR）' }],
        warnings,
        sourceKind: 'pdf' as SourceKind,
      }
    }

    // 启发式模块识别
    let currentSection = ''
    let currentText = ''
    let blockIndex = 0

    for (const line of allLines) {
      const inferredType = inferComponentType(line)

      if (inferredType) {
        // 新 section：保存之前的
        if (currentSection && currentText) {
          blocks.push({
            type: currentSection,
            text: currentText,
            confidence: 0.6,
            sourceLocation: `page-line-${blockIndex}`,
            fields: { description: currentText },
          })
          blockIndex += 1
        }
        currentSection = inferredType
        currentText = line
      } else if (currentSection) {
        currentText += '\n' + line
      } else {
        // 无 section 上下文 → 归入 basics
        currentSection = 'basics'
        currentText = line
      }
    }

    // 最后一段
    if (currentSection && currentText) {
      blocks.push({
        type: currentSection,
        text: currentText,
        confidence: 0.6,
        sourceLocation: `page-line-${blockIndex}`,
        fields: { description: currentText },
      })
    }

    const confidence = blocks.length > 0
      ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
      : 0

    return {
      blocks,
      confidence,
      pending,
      warnings,
      sourceKind: 'pdf' as SourceKind,
    }
  } finally {
    doc.destroy?.()
  }
}

/** 导入 PDF 并生成 ResumeDocument */
export async function importPdfToDocument(
  data: ArrayBuffer,
  title = '导入的简历',
  opts: ImportPdfOptions = {},
): Promise<{ doc: ResumeDocument; report: ImportReport }> {
  const report = await importPdf(data, opts)
  // 进文档的唯一映射入口是 import-bridge：别名归一 + defaultFields 打底；
  // pending 也一并落成 UnknownComponent 进文档（保原文），不再整包丢掉。
  const components = [
    ...recognizedBlocksToComponents(report.blocks, 0, 'zh'),
    ...pendingItemsToComponents(report.pending, report.blocks.length),
  ]

  const doc = createDocument({
    documentId: `imp_${Date.now()}`,
    now: new Date().toISOString(),
    title,
    languageTrack: 'zh',
    components,
  })

  return { doc, report }
}

/** RecognitionProvider 实现（规则引擎，本卡） */
export function createPdfProvider(opts: ImportPdfOptions = {}): RecognitionProvider {
  return {
    name: 'rule-pdf',
    recognize(data: ArrayBuffer | Uint8Array) {
      const buffer = data instanceof Uint8Array
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
        : data
      return importPdf(buffer, opts)
    },
  }
}
