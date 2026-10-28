/**
 * 分页（TC-007 段②）
 * 契约 §5 不变量 4：
 *   跨页时**短语义组件（≤ 页高 60%）keep-together**；
 *   长语义组件与连续组件**降级为可拆分**；**标题不得孤立**。
 *
 * 三条自我约束：
 *  1. 纯函数：不读 store / DOM / 时钟 / 随机数
 *  2. 拆块只拆空白与内容流，**永不丢内容**（不变量 2）
 *  3. 页码与片段序号由本函数统一分配，flow 不做页码——避免两处各算一次
 */

import type { ComponentBox, LayoutWarning, PageBox } from './types'

/** 页面几何。content* 是扣掉页边距后的可用区域。 */
export interface PageGeometry {
  width: number
  height: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
}

/** 语义档：决定能否跨页拆分。不传则按高度自动判定。 */
export type BlockKind = 'short' | 'long' | 'continuous'

export interface PageBlock {
  componentId: string
  height: number
  kind?: BlockKind
  /** 标题块：不允许落在一页最后一行 */
  isHeading?: boolean
}

export interface PaginationOptions {
  page: PageGeometry
  gap?: number
  /** keep-together 阈值：块高 ≤ 内容高 × ratio 视为短组件，默认 0.6 */
  keepTogetherRatio?: number
  /** 页数建议上限，超过给 suggestion 级警告 */
  suggestedMaxPages?: number
  /** 标题与下一块的"最小同行高度"，默认 60px（约 3 行正文） */
  headingMinSlice?: number
}

export interface PaginationResult {
  boxes: ComponentBox[]
  pages: PageBox[]
  warnings: LayoutWarning[]
}

const DEFAULT_GAP = 0
const DEFAULT_KEEP_RATIO = 0.6
const DEFAULT_HEADING_SLICE = 60
/** 拆分时，页尾剩余高度小于这个值就宁可整块下移，避免出现一行孤字 */
const MIN_FRAGMENT = 24
const EPSILON = 1e-9

function makePage(index: number, g: PageGeometry): PageBox {
  return {
    pageIndex: index,
    width: g.width,
    height: g.height,
    contentX: g.contentX,
    contentY: g.contentY,
    contentWidth: g.contentWidth,
    contentHeight: g.contentHeight,
  }
}

export function paginate(
  blocks: readonly PageBlock[],
  options: PaginationOptions,
): PaginationResult {
  const gap = Math.max(0, options.gap ?? DEFAULT_GAP)
  const keepRatio = options.keepTogetherRatio ?? DEFAULT_KEEP_RATIO
  const headingSlice = options.headingMinSlice ?? DEFAULT_HEADING_SLICE
  const geo = options.page
  const contentH = Math.max(0, geo.contentHeight)

  const boxes: ComponentBox[] = []
  const warnings: LayoutWarning[] = []
  const pages: PageBox[] = [makePage(0, geo)]

  let pageIndex = 0
  let used = 0
  /** 当前页已放块数，用于决定是否需要 gap */
  let placedOnPage = 0

  const newPage = (): void => {
    pageIndex += 1
    pages.push(makePage(pageIndex, geo))
    used = 0
    placedOnPage = 0
  }

  const canKeepTogether = (block: PageBlock): boolean => {
    if (block.kind === 'long' || block.kind === 'continuous') return false
    if (block.kind === 'short') return true
    return block.height <= contentH * keepRatio + EPSILON
  }

  const place = (block: PageBlock, height: number, fragmentIndex: number): void => {
    const offset = placedOnPage === 0 ? 0 : gap
    const y = geo.contentY + used + offset
    boxes.push({
      componentId: block.componentId,
      pageIndex,
      fragmentIndex,
      x: geo.contentX,
      y,
      width: geo.contentWidth,
      height,
    })
    used += offset + height
    placedOnPage += 1
  }

  const available = (): number => Math.max(0, contentH - used)

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (!block) continue

    // ---- 标题不得孤立：连同下一块的最小切片一起塞 ----
    if (block.isHeading === true) {
      const next = blocks[i + 1]
      const needWithNext =
        block.height + (placedOnPage === 0 ? 0 : gap) + (next ? gap + Math.min(next.height, headingSlice) : 0)

      if (needWithNext > available() + EPSILON && placedOnPage > 0) {
        newPage()
        // 换页后仍放不下（极端窄页）：保留警告，继续按普通块处理
        if (block.height > available() + EPSILON) {
          warnings.push({
            type: 'orphan-heading',
            pageIndex,
            componentId: block.componentId,
            severity: 'warning',
            cause: '标题被迫孤零零落在页首，下方没有正文跟随',
            suggestion: '缩短上方内容，或把该小节整体移到下一页',
          })
        }
      }
    }

    let remaining = block.height
    let fragmentIndex = 0
    const keep = canKeepTogether(block)

    while (remaining > EPSILON) {
      const avail = available()

      if (remaining <= avail + EPSILON) {
        place(block, remaining, fragmentIndex)
        remaining = 0
        break
      }

      // 放不下：能拆就拆，不能拆就整块下移
      const splittable = !keep && remaining > contentH * 0.5
      const slice = avail - (placedOnPage === 0 ? 0 : gap)

      if (splittable && slice >= MIN_FRAGMENT) {
        place(block, slice, fragmentIndex)
        remaining -= slice
        fragmentIndex += 1
        newPage()
        continue
      }

      if (placedOnPage === 0) {
        // 空页都放不下：这一块本身比整页还高，只能超出去并告警
        place(block, remaining, fragmentIndex)
        warnings.push({
          type: 'overflow-page',
          pageIndex,
          componentId: block.componentId,
          severity: 'blocking',
          cause: '该组件单独占一页仍然超出页面，内容会被裁切',
          suggestion: '精简该组件的文字，或拆成两个组件后重新排版',
        })
        remaining = 0
        break
      }

      newPage()
    }
  }

  // ---- 页数建议 ----
  const maxPages = options.suggestedMaxPages
  if (maxPages !== undefined && pages.length > maxPages) {
    warnings.push({
      type: 'page-count',
      pageIndex: pages.length - 1,
      severity: 'suggestion',
      cause: `当前 ${pages.length} 页，超过建议的 ${maxPages} 页`,
      suggestion: '删减次要经历，或压缩行距与段间距',
    })
  }

  return { boxes, pages, warnings }
}

/** 每页放了多少个片段，给状态栏「第 N 页」与调试用 */
export function fragmentCountByPage(boxes: readonly ComponentBox[]): number[] {
  // 注意：不能用 sparse array + map，map 会跳过空洞，`?? 0` 永远不会执行
  let max = -1
  for (const b of boxes) if (b.pageIndex > max) max = b.pageIndex

  const counts: number[] = []
  for (let i = 0; i <= max; i += 1) counts.push(0)
  for (const b of boxes) {
    counts[b.pageIndex] = (counts[b.pageIndex] ?? 0) + 1
  }
  return counts
}
