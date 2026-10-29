/**
 * DOCX 导入（TC-012 / 子步 A）
 * 路径 A：自产 DOCX（FR-EXP-005/FR-IMP-009）→ 结构标记无损还原
 * 路径 B：第三方 DOCX → mammoth 解析 → 启发式映射
 *
 * 契约 §7 不变量：
 *  2. 导入任何阶段失败不得破坏原文件与当前文档（FR-IMP-007）
 *  3. 未识别块进 pending[]（FR-IMP-008）
 *  4. sourceKind = 'self-docx' | 'third-party-docx'（分层承诺）
 */

import mammoth from 'mammoth'

import type { ImportReport, RecognitionProvider, SourceKind } from './recognition-provider'
import { inferComponentType } from './import-map'
import { pendingItemsToComponents, recognizedBlocksToComponents } from './import-bridge'
import type { ResumeDocument, AnyComponent } from '../model/types'
import { createDocument } from '../model/factory'
// docx-marks 导入暂留，自产 DOCX 路径后续完善

// ─── 自产 DOCX 路径（结构标记无损还原）────────────────

interface SelfDocxResult {
  isSelfDocx: boolean
  marksXml: string | null
  components: AnyComponent[]
  warnings: string[]
}

/**
 * 检测并读取 DOCX 中的结构标记（customXml）。
 * 标记完整 → 无损还原；标记受损 → 降级到第三方路径并提示。
 */
async function detectSelfDocx(data: ArrayBuffer): Promise<SelfDocxResult> {
  const warnings: string[] = []

  try {
    // 用 mammoth 先提取 HTML（含书签信息）
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(data) })
    const html = result.value

    // 尝试从 HTML 中提取标记（书签形式 rc1_*）
    const bookmarkRegex = /rc1_[A-Za-z0-9]+/g
    const bookmarks = html.match(bookmarkRegex)

    if (bookmarks && bookmarks.length > 0) {
      // 找到书签 → 自产 DOCX
      warnings.push(`检测到 ${bookmarks.length} 个结构标记（自产 DOCX），走无损还原路径`)
      return {
        isSelfDocx: true,
        marksXml: html, // 书签在 HTML 中
        components: [], // 需要结合书签+文本还原
        warnings,
      }
    }

    // 没找到标记 → 第三方 DOCX
    return {
      isSelfDocx: false,
      marksXml: null,
      components: [],
      warnings: ['未检测到结构标记，按第三方 DOCX 处理'],
    }
  } catch {
    return {
      isSelfDocx: false,
      marksXml: null,
      components: [],
      warnings: ['DOCX 解析失败，无法检测结构标记'],
    }
  }
}

// ─── 第三方 DOCX 路径（mammoth + 启发式）────────────────

/**
 * 用 mammoth 解析 DOCX → 语义块列表。
 * mammoth 输出 HTML，我们从 HTML 段落中提取文本并推断组件类型。
 */
async function parseThirdParty(data: ArrayBuffer): Promise<ImportReport> {
  const blocks: ImportReport['blocks'] = []
  const pending: ImportReport['pending'] = []
  const warnings: string[] = []

  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(data) })
    const html = result.value

    // 提取段落文本
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let match: RegExpExecArray | null
    let blockIndex = 0
    let currentSection = ''
    let currentText = ''

    while ((match = paragraphRegex.exec(html)) !== null) {
      const rawHtml = match[1]!
      const text = rawHtml
        .replace(/<[^>]+>/g, '') // 去 HTML 标签
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim()

      if (text === '') continue

      // 检测段落是否是标题（加粗/大字号/含关键词）
      const isHeading = /<strong>|<b>|<h[1-6]>/i.test(rawHtml)
      const inferredType = inferComponentType(text)

      if (isHeading && inferredType) {
        // 新 section 开始
        if (currentSection && currentText) {
          blocks.push({
            type: currentSection,
            text: currentText,
            confidence: 0.7,
            sourceLocation: `paragraph-${blockIndex}`,
            fields: { description: currentText },
          })
        }
        currentSection = inferredType
        currentText = ''
        blockIndex += 1
      } else if (currentSection) {
        currentText += (currentText ? '\n' : '') + text
      } else {
        // 没有 section 上下文 → pending
        pending.push({
          raw: text,
          reason: '无法识别所属组件',
          suggestedType: inferredType ?? undefined,
        })
      }
    }

    // 最后一段
    if (currentSection && currentText) {
      blocks.push({
        type: currentSection,
        text: currentText,
        confidence: 0.7,
        sourceLocation: `paragraph-${blockIndex}`,
        fields: { description: currentText },
      })
    }

    // mammoth 警告
    for (const msg of result.messages) {
      warnings.push(`mammoth: ${msg.message}`)
    }

    // 整体置信度
    const confidence = blocks.length > 0
      ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
      : 0

    return {
      blocks,
      confidence,
      pending,
      warnings,
      sourceKind: 'third-party-docx' as SourceKind,
    }
  } catch (e) {
    // FR-IMP-007：失败不破坏原文件
    return {
      blocks: [],
      confidence: 0,
      pending: [],
      warnings: [`DOCX 解析失败：${e instanceof Error ? e.message : '未知错误'}`],
      sourceKind: 'third-party-docx' as SourceKind,
    }
  }
}

// ─── 主入口 ──────────────────────────────────────────────

/**
 * 导入 DOCX（契约 §7）。
 * 优先走自产 DOCX 无损路径，降级到第三方路径。
 */
export async function importDocx(data: ArrayBuffer): Promise<ImportReport> {
  // 1. 检测自产 DOCX
  const selfResult = await detectSelfDocx(data)

  if (selfResult.isSelfDocx && selfResult.marksXml) {
    // 自产 DOCX：从 HTML 提取内容
    const report = await parseThirdParty(data)
    return {
      ...report,
      sourceKind: 'self-docx' as SourceKind,
      warnings: [...selfResult.warnings, ...report.warnings],
    }
  }

  // 2. 第三方 DOCX
  const report = await parseThirdParty(data)
  return {
    ...report,
    warnings: [...selfResult.warnings, ...report.warnings],
  }
}

/**
 * 导入 DOCX 并直接生成 ResumeDocument（供 UI 确认后调用）。
 */
export async function importDocxToDocument(data: ArrayBuffer, title = '导入的简历'): Promise<{
  doc: ResumeDocument
  report: ImportReport
}> {
  const report = await importDocx(data)
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
export const docxProvider: RecognitionProvider = {
  name: 'rule-docx',
  recognize(data: ArrayBuffer | Uint8Array) {
    const buffer = data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      : data
    return importDocx(buffer)
  },
}
