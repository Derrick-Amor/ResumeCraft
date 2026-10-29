/**
 * 布局合成（接线层，TC-007 的对外唯一入口）
 *
 * 为什么需要这个文件：
 *   `measure.ts` / `pagination.ts` / `flow.ts` 各自都能跑，但没有人把它们串成
 *   「文档 → LayoutResult」。UI 拿不到 `runLayout(doc)` 就等于引擎不存在。
 *   本模块就是那条线：文本段 → 逐段测量 → 块高 → 分页 → 结果。
 *
 * 三条不变量（与 types.ts 文件头一致）：
 *  1. **纯函数**：不读 store / DOM / 时钟 / 随机数。同输入必须逐字节同输出。
 *  2. 溢出不自动删内容：这里只把块算高、交给分页；不裁剪、不缩放、不改文档。
 *  3. 单位纪律：块高与页面几何统一用 **mm**（页面物理尺寸），只有"测量"这一步换成 px。
 *     混用单位是排版错一页的经典来源，所以换算只出现在 `measureBlockHeightMm` 里。
 *
 * 确定性说明：默认测量器是模块级单例（带缓存），缓存只影响 `TextMetrics.cached`，
 * 不影响数值，因此不破坏确定性。
 */

import type { PageSettings, ResumeDocument } from '../model/types'
import { createDefaultBackend, createMeasurer } from './measure'
import type { TextMetrics, TextStyle } from './measure'
import { paginate } from './pagination'
import type { PageBlock, PageGeometry } from './pagination'
import { geometryFingerprint } from './report'
import { TRAILING_GAP_PX, documentTextBlocks } from './text-runs'
import type { ComponentTextBlock } from './text-runs'
import type { LayoutResult } from './types'
import { A4_MM, mmToPx, pxToMm, quantize } from './units'

/**
 * 引擎版本。行为一变就必须改这个串，配合 inputHash 做快照回归。
 * layout-3（2026-10-30）：overflow-page 警告带 `overLines`（被裁 run 原文），
 *                    其余警告类型不填。
 * layout-2（2026-10-29）：text-runs 升级为八角色 + trailing 日期，
 * 纸面从扁平行变成设计稿的分节结构，块高与折行宽度都会变。
 */
export const LAYOUT_ENGINE_VERSION = 'layout-3'

/**
 * 测量用字体族（2026-10-29 修正）。
 *
 * 为什么第一项是 'Rc Sans' 而不是设计稿里的 'Inter'：
 *   设计稿靠 Google Fonts 拉 Inter + Noto Sans SC，我们删了那个 @import，
 *   改为本地 @font-face（见 `src/design/fonts.css`）。'Rc Sans' 是本地字库的
 *   **真实族名**，直接写它，测量就落在真正会被下载的那个文件上。
 *   'Inter' 在 fonts.css 里被别名到同一份文件（为让 tokens 取值与设计稿一致），
 *   两条路最终指向同一字体，度量相同。
 *
 * 硬约束：本常量必须与 `src/design/fonts.css` 里**实际被引用的族名**保持一致。
 *   字体变了行宽就变，分页跟着变 —— 这是一处改、三处（DOM / 测量 / PDF）必须同时对的点。
 *
 * 为什么不读 CSS 变量：布局是纯函数，不读 DOM。
 */
export const RESUME_FONT_FAMILY =
  "'Rc Sans', 'Inter', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"

/** 组件间距默认值（mm）。与模板 layoutRules.componentGapMm 的量级一致，模板可显式覆盖。 */
const DEFAULT_GAP_MM = 4

/** 页数建议上限默认值。PRD 的"一页/两页简历"默认取两页。 */
const DEFAULT_SUGGESTED_MAX_PAGES = 2

/**
 * 空组件占位高度（mm）。
 * 没填内容的组件在画布上必须仍然可见可点（否则用户删不掉也找不到），所以给它一个固定的占位高。
 * 取 12mm 约等于一行标题 + 段后留白，不会把版面撑开太多。
 */
const EMPTY_BLOCK_HEIGHT_MM = 12

/** 块高保留 3 位小数（微米级）。只为压掉浮点尾巴，不影响版面。 */
const HEIGHT_DIGITS = 3

const REGULAR_WEIGHT = 400
const BOLD_WEIGHT = 700

/** 测量器签名。与 `createMeasurer(...).measure` 完全一致，便于测试注入。 */
export type Measurer = (text: string, style: TextStyle, maxWidth: number) => TextMetrics

export interface ComposeOptions {
  /** 注入测量器，缺省用模块级单例（createDefaultBackend + createMeasurer） */
  measurer?: Measurer
  /** 组件间距（mm），默认 4 */
  gapMm?: number
  /** 页数建议上限，默认 2 */
  suggestedMaxPages?: number
  /** 测量用字体族，默认 RESUME_FONT_FAMILY */
  fontFamily?: string
}

/**
 * 模块级单例测量器。**懒创建**：`createDefaultBackend()` 会去取 canvas，
 * 模块加载时就建会让 Node/SSR 环境在 import 阶段就碰到 DOM 相关问题。
 */
let sharedMeasurer: Measurer | null = null

function defaultMeasurer(): Measurer {
  if (sharedMeasurer === null) {
    sharedMeasurer = createMeasurer(createDefaultBackend()).measure
  }
  return sharedMeasurer
}

/** 非有限数一律回落到 A4 尺寸：坏页面设置不该让整份布局变成 NaN */
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/** 非负参数归一。负数 / NaN / 缺省都取默认值。 */
function nonNegativeOr(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback
  return value
}

/**
 * 文档页面设置 → 分页几何。content* 是扣掉页边距后的可用区域，单位 mm。
 * 内容区最小夹到 0：页边距填得比纸还大时不该出现负宽度。
 */
function toPageGeometry(settings: PageSettings): PageGeometry {
  const width = finiteOr(settings.widthMm, A4_MM.width)
  const height = finiteOr(settings.heightMm, A4_MM.height)
  const marginLeft = finiteOr(settings.marginLeftMm, 0)
  const marginRight = finiteOr(settings.marginRightMm, 0)
  const marginTop = finiteOr(settings.marginTopMm, 0)
  const marginBottom = finiteOr(settings.marginBottomMm, 0)

  return {
    width,
    height,
    contentX: marginLeft,
    contentY: marginTop,
    contentWidth: Math.max(0, width - marginLeft - marginRight),
    contentHeight: Math.max(0, height - marginTop - marginBottom),
  }
}

interface MeasureContext {
  measure: Measurer
  fontFamily: string
  /** 内容区宽度（px），所有文本段共用的折行宽度 */
  maxWidthPx: number
}

/** 一段文本在块内的测量结果。endMm 自块顶起算（含 paddingTop）。 */
interface RunSpan {
  text: string
  endMm: number
}

/**
 * 逐段测量：与块高是**同一条测量路径**（含 trailing 扣宽、同一套单位换算）。
 * 之所以单独抽出来：`overLines`（被裁文本）必须与纸面/导出看到的段一一对应，
 * 两处各测一次必然漂移。
 */
function measureRunSpans(block: ComponentTextBlock, context: MeasureContext): RunSpan[] {
  const spans: RunSpan[] = []
  if (block.runs.length === 0) return spans

  let textHeightPx = 0
  for (const run of block.runs) {
    const style: TextStyle = {
      fontFamily: context.fontFamily,
      fontSizePt: run.fontSizePt,
      fontWeight: run.bold ? BOLD_WEIGHT : REGULAR_WEIGHT,
      lineHeight: run.lineHeight,
    }
    // item-title 的 trailing（起止日期）在设计稿里是同行右对齐，
    // 正文可用宽度要扣掉日期宽度与两者间距，否则会算成两行、页高虚高。
    let maxWidthPx = context.maxWidthPx
    if (run.trailing !== undefined) {
      const trailingWidth = context.measure(run.trailing, style, context.maxWidthPx).width
      maxWidthPx = Math.max(0, context.maxWidthPx - trailingWidth - TRAILING_GAP_PX)
    }
    textHeightPx += context.measure(run.text, style, maxWidthPx).height
    spans.push({
      text: run.text,
      endMm: quantize(pxToMm(textHeightPx) + block.paddingTopMm, HEIGHT_DIGITS),
    })
  }
  return spans
}

/**
 * 块高（mm，含组件内留白）。
 * 先把每段文本的 px 高度累加，再一次性折成 mm —— 逐段换算会累积浮点误差。
 */
function measureBlockHeightMm(block: ComponentTextBlock, context: MeasureContext): number {
  const spans = measureRunSpans(block, context)
  const last = spans[spans.length - 1]
  if (last === undefined) return EMPTY_BLOCK_HEIGHT_MM
  return quantize(last.endMm + block.paddingBottomMm, HEIGHT_DIGITS)
}

/**
 * 被裁掉的文本行（run 级原文）。
 *
 * 只对 `overflow-page` 有意义：单块独占一页仍装不下时，超出可导出高度的部分被裁。
 * **分页续排不算**——那是 fragmentIndex 续排，内容一个字不少，不标红。
 *
 * 判定：run 的末端超过可导出高度（`contentHeight`）就算被裁。
 * 跨界的 run 整条计入（team-lead 裁决：不拆半行）。
 */
function collectOverLines(
  block: ComponentTextBlock,
  contentHeightMm: number,
  context: MeasureContext,
): string[] {
  const lines: string[] = []
  for (const span of measureRunSpans(block, context)) {
    if (span.endMm > contentHeightMm + 1e-9) lines.push(span.text)
  }
  return lines
}

/**
 * 文档 → 布局结果。
 *
 * `isHeading` 的判定是两件事同时成立：该块首段是 title 角色，且这是该组件类型**首次出现**。
 * 这样分页层就能保证「小节标题不孤零零留在页底」；而同一类型的第二、三个条目
 * （第二条工作经历）不会被当成标题去整块下移，否则一页只能放一条经历。
 */
export function composeLayout(doc: ResumeDocument, options: ComposeOptions = {}): LayoutResult {
  const measure = options.measurer ?? defaultMeasurer()
  const fontFamily = options.fontFamily ?? RESUME_FONT_FAMILY
  const gapMm = nonNegativeOr(options.gapMm, DEFAULT_GAP_MM)
  const suggestedMaxPages = nonNegativeOr(options.suggestedMaxPages, DEFAULT_SUGGESTED_MAX_PAGES)

  const page = toPageGeometry(doc.pageSettings)
  const context: MeasureContext = {
    measure,
    fontFamily,
    maxWidthPx: mmToPx(page.contentWidth),
  }

  // 可见性与排序已在 documentTextBlocks 里统一处理，这里不再判一次
  const textBlocks = documentTextBlocks(doc)

  const blocks: PageBlock[] = []
  for (const textBlock of textBlocks) {
    // 小节标题块的唯一标志是「首段是 section 角色」。
    // documentTextBlocks 已保证同类型连续组件只有首个带 section，
    // 所以 A B A 这种重排后第二次出现的 A 会再起一个小节 —— 这是期望行为。
    // （旧版用 seenTypes 判"该类型首次出现"，会把重排后的第二个小节压掉。）
    const firstRun = textBlock.runs[0]
    const isHeading = firstRun !== undefined && firstRun.role === 'section'

    blocks.push({
      componentId: textBlock.componentId,
      height: measureBlockHeightMm(textBlock, context),
      isHeading,
    })
  }

  const paginated = paginate(blocks, { page, gap: gapMm, suggestedMaxPages })

  /**
   * 给 `overflow-page` 警告补 `overLines`。
   *
   * 为什么在 compose 而不是 pagination 里算：pagination 只看得到 height（PageBlock 不含文本），
   * 而"哪几行被裁"需要 run 原文 + 测量，那在 compose 的测量层。
   * pagination 仍然是"哪块被裁到哪"的判定方（warnings 本体由它产出），这里只做文本富化。
   */
  const warnings = paginated.warnings.map((warning) => {
    if (warning.type !== 'overflow-page' || warning.componentId === undefined) return warning
    const block = textBlocks.find((item) => item.componentId === warning.componentId)
    if (block === undefined) return warning
    const overLines = collectOverLines(block, page.contentHeight, context)
    // 取不到就不填：[] 不等于"没有溢出"，禁止空数组冒充（types.ts 的 overLines 注释）
    return overLines.length > 0 ? { ...warning, overLines } : warning
  })

  return {
    boxes: paginated.boxes,
    pages: paginated.pages,
    warnings,
    engineVersion: LAYOUT_ENGINE_VERSION,
    inputHash: `${LAYOUT_ENGINE_VERSION}:${geometryFingerprint(paginated)}`,
  }
}
