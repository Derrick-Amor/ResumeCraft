/**
 * TC-007 段①：排列（flow）回归测试
 * 对照：CONTRACT §5 不变量 1（纯函数）、2（溢出不裁内容）、3（确定性）
 */

import { describe, expect, it } from 'vitest'

import { flowBlocks, needsPagination, totalHeight } from '../../src/layout/flow'
import type { FlowBlock } from '../../src/layout/flow'

const AREA = { x: 60, y: 60, width: 674, height: 1000 }

function b(componentId: string, height: number): FlowBlock {
  return { componentId, height }
}

describe('基本堆叠', () => {
  it('从内容区左上角开始，逐块向下', () => {
    const r = flowBlocks([b('a', 100), b('b', 50)], { area: AREA })
    expect(r.boxes).toHaveLength(2)
    expect(r.boxes[0]).toMatchObject({ componentId: 'a', x: 60, y: 60, width: 674, height: 100 })
    expect(r.boxes[1]).toMatchObject({ componentId: 'b', x: 60, y: 160, width: 674, height: 50 })
  })

  it('usedHeight 不含末尾多余 gap', () => {
    const r = flowBlocks([b('a', 100), b('b', 50)], { area: AREA, gap: 10 })
    // 100 + 10 + 50 = 160
    expect(r.usedHeight).toBe(160)
    expect(r.remainingHeight).toBe(840)
  })

  it('块间距只加在块之间', () => {
    const r = flowBlocks([b('a', 100), b('b', 50), b('c', 50)], { area: AREA, gap: 8 })
    expect(r.boxes.map((x) => x.y)).toEqual([60, 168, 226])
  })

  it('空输入返回空结果，剩余高度等于可用高度', () => {
    const r = flowBlocks([], { area: AREA })
    expect(r.boxes).toEqual([])
    expect(r.overflow).toEqual([])
    expect(r.usedHeight).toBe(0)
    expect(r.remainingHeight).toBe(1000)
  })

  it('pageIndex 恒为 0（分页由 pagination 重新编号）', () => {
    const r = flowBlocks([b('a', 10), b('b', 10)], { area: AREA })
    expect(r.boxes.every((x) => x.pageIndex === 0)).toBe(true)
  })
})

describe('溢出：整块下移，绝不裁剪（契约 §5 不变量 2）', () => {
  it('放不下的块进 overflow，且不进 boxes', () => {
    const r = flowBlocks([b('a', 600), b('b', 500)], { area: AREA })
    expect(r.boxes).toHaveLength(1)
    expect(r.overflow).toHaveLength(1)
    expect(r.overflow[0]).toMatchObject({ componentId: 'b', height: 500 })
  })

  it('一旦溢出，后续块全部按序进 overflow，不插队', () => {
    const r = flowBlocks([b('a', 900), b('b', 200), b('c', 10)], { area: AREA })
    expect(r.boxes.map((x) => x.componentId)).toEqual(['a'])
    expect(r.overflow.map((x) => x.componentId)).toEqual(['b', 'c'])
  })

  it('刚好装满不算溢出（边界值）', () => {
    const r = flowBlocks([b('a', 1000)], { area: AREA })
    expect(r.boxes).toHaveLength(1)
    expect(r.overflow).toHaveLength(0)
    expect(r.remainingHeight).toBe(0)
  })

  it('overflow 带可用高度快照，便于下游判断能塞多少', () => {
    const r = flowBlocks([b('a', 900), b('b', 200)], { area: AREA })
    expect(r.overflow[0]?.availableHeight).toBe(100)
  })

  it('块高为 0 时不占空间但仍生成 box', () => {
    const r = flowBlocks([b('a', 0), b('b', 50)], { area: AREA })
    expect(r.boxes).toHaveLength(2)
    expect(r.boxes[0]?.y).toBe(60)
    expect(r.boxes[1]?.y).toBe(60)
  })
})

describe('totalHeight 与 needsPagination', () => {
  it('合计含间距', () => {
    expect(totalHeight([b('a', 100), b('b', 50), b('c', 50)], 10)).toBe(220)
  })

  it('空数组为 0', () => {
    expect(totalHeight([])).toBe(0)
  })

  it('超过可用高度才需要分页', () => {
    expect(needsPagination([b('a', 900), b('b', 200)], 1000)).toBe(true)
    expect(needsPagination([b('a', 900), b('b', 100)], 1000)).toBe(false)
    expect(needsPagination([b('a', 1000)], 1000)).toBe(false)
  })
})

describe('确定性（契约 §5 不变量 3）', () => {
  it('同输入连跑十次结果完全一致', () => {
    const blocks = [b('a', 120), b('b', 80), b('c', 60)]
    const first = flowBlocks(blocks, { area: AREA, gap: 6 })

    for (let i = 0; i < 10; i += 1) {
      const again = flowBlocks(blocks, { area: AREA, gap: 6 })
      expect(again.boxes).toEqual(first.boxes)
      expect(again.usedHeight).toBe(first.usedHeight)
      expect(again.overflow).toEqual(first.overflow)
    }
  })

  it('不修改入参', () => {
    const blocks = [b('a', 100)]
    const snapshot = JSON.stringify(blocks)
    flowBlocks(blocks, { area: AREA })
    expect(JSON.stringify(blocks)).toBe(snapshot)
  })
})
