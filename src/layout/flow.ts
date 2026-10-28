/**
 * 排列（TC-007 段①）
 * 契约 §5：把有序组件沿内容区自上而下堆叠，算出坐标；**不决定翻页**。
 *
 * 职责边界（刻意切窄）：
 *   flow 只管「在这一页里往下排」，排不下的块原样丢进 `overflow` 列表。
 *   它**不裁剪、不缩放、不删内容**——契约 §5 不变量 2：数据完整性 > 布局合法性。
 *   怎么处理溢出，是 pagination 与 overflow-stages 的事。
 *
 * 纯函数：不读 store / DOM / 时钟 / 随机数（契约 §5 不变量 1）。
 */

import type { ComponentBox } from './types'

/** 参与排列的一个块。高度由 measure 层算好传进来，flow 不自己量。 */
export interface FlowBlock {
  componentId: string
  /** 块高（px），含自身内边距，不含块间距 */
  height: number
}

export interface FlowArea {
  x: number
  y: number
  width: number
  height: number
}

export interface FlowOptions {
  area: FlowArea
  /** 相邻块之间的间距；单块排布时为 0 */
  gap?: number
}

export interface OverflowEntry {
  componentId: string
  /** 该块整体没放下的高度（= 块高，因为 flow 不做拆分） */
  height: number
  /** 若是被"上一块留下的空隙"挤下去的，记录当时可用高度 */
  availableHeight: number
}

export interface FlowResult {
  boxes: ComponentBox[]
  /** 本页放不下、需要交给分页处理的块，保持原有顺序 */
  overflow: OverflowEntry[]
  /** 已占用的高度（含块间距，不含末尾多余 gap） */
  usedHeight: number
  /** 剩余可用高度，可能为 0 */
  remainingHeight: number
}

const DEFAULT_GAP = 0

/**
 * 单页排列。返回的 boxes 的 `pageIndex` 固定是 0——
 * 分页之后由 pagination 重新编号，flow 不预设页码，避免两处各算一次。
 */
export function flowBlocks(
  blocks: readonly FlowBlock[],
  options: FlowOptions,
): FlowResult {
  const gap = Math.max(0, options.gap ?? DEFAULT_GAP)
  const { area } = options
  const available = Math.max(0, area.height)

  const boxes: ComponentBox[] = []
  const overflow: OverflowEntry[] = []
  let cursorY = area.y
  let usedHeight = 0
  let overflowed = false

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (!block) continue

    // 已进入溢出状态后，后续块一律排进 overflow，保证顺序不乱
    if (overflowed) {
      overflow.push({ componentId: block.componentId, height: block.height, availableHeight: 0 })
      continue
    }

    const offset = boxes.length === 0 ? 0 : gap
    const needed = offset + block.height
    const remaining = available - usedHeight

    if (needed > remaining + 1e-9) {
      // 放不下：整块下移，不裁剪
      overflow.push({
        componentId: block.componentId,
        height: block.height,
        availableHeight: Math.max(0, remaining),
      })
      overflowed = true
      continue
    }

    cursorY += offset
    boxes.push({
      componentId: block.componentId,
      pageIndex: 0,
      fragmentIndex: 0,
      x: area.x,
      y: cursorY,
      width: area.width,
      height: block.height,
    })
    cursorY += block.height
    usedHeight += needed
  }

  return {
    boxes,
    overflow,
    usedHeight,
    remainingHeight: Math.max(0, available - usedHeight),
  }
}

/** 块高合计（含间距），用于预判是否需要分页。 */
export function totalHeight(blocks: readonly FlowBlock[], gap = DEFAULT_GAP): number {
  if (blocks.length === 0) return 0
  let sum = 0
  for (const b of blocks) sum += b.height
  return sum + Math.max(0, gap) * (blocks.length - 1)
}

/** 是否需要翻页：总高超过可用高度即为 true。 */
export function needsPagination(blocks: readonly FlowBlock[], availableHeight: number, gap = DEFAULT_GAP): boolean {
  return totalHeight(blocks, gap) > availableHeight + 1e-9
}
