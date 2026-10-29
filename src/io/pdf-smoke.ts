/**
 * PDF 回读冒烟（TC-010）
 * FR-EXP-004：导出后对生成文件进行结构检查，检测页数异常、空白页、内容缺失。
 *
 * 用 pdfjs-dist 解析导出的 PDF，校验：
 *  1. PDF 可以正常打开（结构合法）
 *  2. 页数与 LayoutResult 一致
 *  3. 每页有文本内容（非空白页）
 *  4. 预期文本存在（抽样）
 */

// pdfjs-dist 在 Node 环境需要 polyfill；测试中通过注入 pdfjs 实现
// 避免硬依赖 DOM 环境

export interface SmokeCheckInput {
  /** 导出的 PDF 字节 */
  data: Uint8Array
  /** 期望的页数 */
  expectedPageCount: number
  /** 期望存在的文本片段（抽样，全部应出现在某一页中） */
  expectedTexts?: string[]
  /** 注入 pdfjs 的 getDocument（测试可 mock） */
  getDocument?: (data: Uint8Array) => Promise<PdfDocumentLike>
}

export interface PdfPageLike {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>
}

export interface PdfDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPageLike>
  destroy?(): void
}

export interface SmokeCheckResult {
  ok: boolean
  /** 实际页数 */
  actualPageCount: number
  /** 每页字符数（0 表示空白页） */
  pageCharCounts: number[]
  /** 缺失的预期文本 */
  missingTexts: string[]
  /** 失败原因（ok=false 时有值） */
  error?: string
}

/**
 * 执行回读冒烟检查。
 * 不抛异常，全部结果通过返回值表达。
 */
export async function runSmokeCheck(input: SmokeCheckInput): Promise<SmokeCheckResult> {
  const { data, expectedPageCount, expectedTexts = [], getDocument } = input

  if (!getDocument) {
    return {
      ok: false,
      actualPageCount: 0,
      pageCharCounts: [],
      missingTexts: expectedTexts,
      error: '未提供 getDocument 实现，无法执行回读检查',
    }
  }

  let doc: PdfDocumentLike
  try {
    doc = await getDocument(data)
  } catch (e) {
    return {
      ok: false,
      actualPageCount: 0,
      pageCharCounts: [],
      missingTexts: expectedTexts,
      error: `PDF 解析失败：${e instanceof Error ? e.message : '未知错误'}`,
    }
  }

  try {
    const actualPageCount = doc.numPages

    // 1. 页数校验
    if (actualPageCount !== expectedPageCount) {
      return {
        ok: false,
        actualPageCount,
        pageCharCounts: [],
        missingTexts: expectedTexts,
        error: `页数不匹配：期望 ${expectedPageCount}，实际 ${actualPageCount}`,
      }
    }

    // 2. 逐页提取文本
    const pageCharCounts: number[] = []
    const allTexts: string[] = []

    for (let i = 1; i <= actualPageCount; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => item.str ?? '')
        .join('')
      pageCharCounts.push(text.length)
      allTexts.push(text)
    }

    // 3. 空白页检测
    const blankPages = pageCharCounts
      .map((count, idx) => (count === 0 ? idx + 1 : -1))
      .filter((p) => p > 0)

    if (blankPages.length > 0) {
      return {
        ok: false,
        actualPageCount,
        pageCharCounts,
        missingTexts: expectedTexts,
        error: `第 ${blankPages.join(', ')} 页为空白页`,
      }
    }

    // 4. 预期文本抽样校验
    const fullText = allTexts.join('\n')
    const missingTexts = expectedTexts.filter((t) => !fullText.includes(t))

    if (missingTexts.length > 0) {
      return {
        ok: false,
        actualPageCount,
        pageCharCounts,
        missingTexts,
        error: `缺少预期文本：${missingTexts.map((t) => `"${t.slice(0, 30)}…"`).join(', ')}`,
      }
    }

    return {
      ok: true,
      actualPageCount,
      pageCharCounts,
      missingTexts: [],
    }
  } finally {
    doc.destroy?.()
  }
}
