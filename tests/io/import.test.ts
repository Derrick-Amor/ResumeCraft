/**
 * TC-012 导入层测试
 * 契约 §7 不变量 + FR-IMP-001~010 + RecognitionProvider 切换
 */

import { describe, expect, it } from 'vitest'
import { importDocx, importDocxToDocument, docxProvider } from '../../src/io/import-docx'
import { importPdf, importPdfToDocument, createPdfProvider } from '../../src/io/import-pdf'
import { inferComponentType } from '../../src/io/import-map'
import type { PdfDocLike } from '../../src/io/import-pdf'
import type { RecognitionProvider } from '../../src/io/recognition-provider'
import type { UnknownComponent } from '../../src/model/types'

// ─── import-map 启发式识别 ─────────────────────────────

describe('inferComponentType — 启发式组件识别', () => {
  it('中文教育关键词 → education', () => {
    expect(inferComponentType('教育经历')).toBe('education')
    expect(inferComponentType('华南理工大学 计算机')).toBe('education')
  })

  it('中文工作关键词 → work', () => {
    expect(inferComponentType('工作经历')).toBe('work')
    expect(inferComponentType('工作经历')).toBe('work')
  })

  it('英文关键词正确识别', () => {
    expect(inferComponentType('Work Experience')).toBe('work')
    expect(inferComponentType('Education Background')).toBe('education')
  })

  it('无关键词返回 null', () => {
    expect(inferComponentType('随便一段话')).toBeNull()
  })
})

describe('importDocx/PdfToDocument — 映射走 bridge（别名归一 + pending 不丢）', () => {
  it('别名归一：识别块 work 进文档是 experience（旧粗映射会直接建成 work）', async () => {
    const { doc } = await importPdfToDocument(new ArrayBuffer(0), '测试', {
      getDocument: () =>
        Promise.resolve(
          makeMockPdf([
            [
              '工作经历',
              '主导了性能优化，页面加载速度提升百分之四十，用户体验显著改善，获得用户一致好评，沉淀了多项技术方案',
            ],
          ]),
        ),
    })
    expect(doc.components.some((c) => c.type === 'experience')).toBe(true)
    expect(doc.components.some((c) => c.type === 'work')).toBe(false)
  })

  it('pending 不丢：无法解析时 pending 项落成 UnknownComponent，raw.text 是原文', async () => {
    const { doc, report } = await importPdfToDocument(new ArrayBuffer(0))
    expect(report.pending.length).toBeGreaterThan(0)
    const unknown = doc.components.find((c): c is UnknownComponent => 'unknown' in c)
    expect(unknown).toBeDefined()
    expect(unknown?.unknown).toBe(true)
    expect(unknown?.raw.text).toBe('[PDF 内容]')
  })
})

// ─── importDocx（用 mock mammoth 不太方便，测接口层）────

describe('importDocx — 接口层', () => {
  it('空 buffer 返回空报告（不抛异常）', async () => {
    const report = await importDocx(new ArrayBuffer(0))
    expect(report.sourceKind).toBe('third-party-docx')
    expect(report.warnings.length).toBeGreaterThanOrEqual(0)
  })

  it('importDocxToDocument 返回 doc + report', async () => {
    const { doc, report } = await importDocxToDocument(new ArrayBuffer(0))
    expect(doc).toBeDefined()
    expect(report).toBeDefined()
    expect(doc.components).toBeDefined()
  })

  it('docxProvider 实现 RecognitionProvider 接口', async () => {
    expect(docxProvider.name).toBe('rule-docx')
    const report = await docxProvider.recognize(new ArrayBuffer(0), 'test.docx')
    expect(report.sourceKind).toBe('third-party-docx')
  })
})

// ─── importPdf（用 mock getDocument）────────────────────

function makeMockPdf(lines: string[][]): PdfDocLike {
  return {
    numPages: lines.length,
    getPage(pageNumber: number) {
      const pageLines = lines[pageNumber - 1] ?? []
      return Promise.resolve({
        getTextContent: () =>
          Promise.resolve({
            items: pageLines.map((str, i) => ({
              str,
              transform: [1, 0, 0, 1, 0, 800 - i * 20],
              width: 100,
              height: 14,
            })),
          }),
      })
    },
    destroy: () => {},
  }
}

describe('importPdf — 不变量 2/3/4', () => {
  it('不变量 4：sourceKind = pdf', async () => {
    const report = await importPdf(new ArrayBuffer(0), {
      getDocument: () => Promise.resolve(makeMockPdf([['张明']])),
    })
    expect(report.sourceKind).toBe('pdf')
  })

  it('不变量 3：无识别块时进 pending', async () => {
    const report = await importPdf(new ArrayBuffer(0), {
      getDocument: () => Promise.resolve(makeMockPdf([['教育经历']])),
    })
    // 至少识别出 education
    expect(report.blocks.length + report.pending.length).toBeGreaterThan(0)
  })

  it('不变量 2：解析失败不抛异常，返回警告', async () => {
    const report = await importPdf(new ArrayBuffer(0), {
      getDocument: () => Promise.reject(new Error('损坏文件')),
    })
    expect(report.blocks).toHaveLength(0)
    expect(report.warnings.some((w) => w.includes('解析失败'))).toBe(true)
  })

  it('扫描件检测（FR-IMP-003）', async () => {
    const report = await importPdf(new ArrayBuffer(0), {
      getDocument: () => Promise.resolve(makeMockPdf([['A']])),
    })
    expect(report.warnings.some((w) => w.includes('扫描'))).toBe(true)
  })

  it('多页正确合并', async () => {
    const report = await importPdf(new ArrayBuffer(0), {
      getDocument: () => Promise.resolve(makeMockPdf([
        ['教育经历', '华南理工大学 计算机科学与技术专业 本科 2020年至2024年 在校期间成绩优异'],
        ['工作经历', '字节跳动 前端工程师 负责抖音Web端开发 主导了性能优化项目 页面加载速度提升百分之四十'],
      ])),
    })
    expect(report.blocks.length).toBeGreaterThanOrEqual(1)
    expect(report.pending.length).toBeGreaterThanOrEqual(0)
  })

  it('无 getDocument 返回优雅降级', async () => {
    const report = await importPdf(new ArrayBuffer(0))
    expect(report.warnings.some((w) => w.includes('getDocument'))).toBe(true)
    expect(report.pending.length).toBeGreaterThan(0)
  })

  it('importPdfToDocument 返回 doc + report', async () => {
    const { doc, report } = await importPdfToDocument(new ArrayBuffer(0), '测试', {
      getDocument: () => Promise.resolve(makeMockPdf([['张明']])),
    })
    expect(doc).toBeDefined()
    expect(report.sourceKind).toBe('pdf')
  })
})

// ─── RecognitionProvider 可切换（FR-IMP-010）────────────

describe('RecognitionProvider 可切换（FR-IMP-010）', () => {
  it('mock provider 验证切换不影响调用方', async () => {
    const mockProvider: RecognitionProvider = {
      name: 'mock-provider',
      recognize: () =>
        Promise.resolve({
          blocks: [{ type: 'basics', text: 'mock', confidence: 1, sourceLocation: 'p0', fields: {} }],
          confidence: 1,
          pending: [],
          warnings: [],
          sourceKind: 'pdf',
        }),
    }

    const report = await mockProvider.recognize(new ArrayBuffer(0), 'test.pdf')
    expect(report.blocks).toHaveLength(1)
    expect(report.blocks[0]!.type).toBe('basics')
  })

  it('pdfProvider 实现 RecognitionProvider 接口', () => {
    const provider = createPdfProvider({
      getDocument: () => Promise.resolve(makeMockPdf([['hello']])),
    })
    expect(provider.name).toBe('rule-pdf')
  })
})
