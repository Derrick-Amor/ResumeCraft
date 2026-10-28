/**
 * TC-007 段②：分页（pagination）回归测试
 * 对照：CONTRACT §5 不变量 4（短组件 keep-together / 长组件可拆 / 标题不孤立）
 *       + 不变量 2（永不丢内容）+ 不变量 1、3（纯函数与确定性）
 */

import { describe, expect, it } from 'vitest'

import { fragmentCountByPage, paginate } from '../../src/layout/pagination'
import type { PageBlock, PageGeometry } from '../../src/layout/pagination'

const PAGE: PageGeometry = {
  width: 794,
  height: 1123,
  contentX: 60,
  contentY: 60,
  contentWidth: 674,
  contentHeight: 1000,
}

function blk(
  componentId: string,
  height: number,
  extra: Partial<PageBlock> = {},
): PageBlock {
  return { componentId, height, ...extra }
}

/** 所有片段高度之和，用来验证"内容一个字节都没丢" */
function sumHeights(boxes: ReadonlyArray<{ height: number }>): number {
  return boxes.reduce((s, b) => s + b.height, 0)
}

describe('单页装得下', () => {
  it('不产生第二页', () => {
    const r = paginate([blk('a', 100), blk('b', 200)], { page: PAGE })
    expect(r.pages).toHaveLength(1)
    expect(r.boxes).toHaveLength(2)
    expect(r.warnings).toEqual([])
  })

  it('空文档仍有 1 页，且无 box', () => {
    const r = paginate([], { page: PAGE })
    expect(r.pages).toHaveLength(1)
    expect(r.boxes).toEqual([])
  })

  it('页面几何原样透传到 PageBox', () => {
    const r = paginate([blk('a', 10)], { page: PAGE })
    expect(r.pages[0]).toMatchObject({
      pageIndex: 0,
      width: 794,
      height: 1123,
      contentX: 60,
      contentY: 60,
      contentWidth: 674,
      contentHeight: 1000,
    })
  })
})

describe('keep-together：短组件整块下移', () => {
  it('高度 ≤ 页高 60% 的块不被拆开', () => {
    // a 占 900，b 只有 200（≤600）应整块下移，而不是塞 100 拆成两段
    const r = paginate([blk('a', 900), blk('b', 200)], { page: PAGE })
    expect(r.pages).toHaveLength(2)
    expect(r.boxes.filter((x) => x.componentId === 'b')).toHaveLength(1)
    expect(r.boxes.find((x) => x.componentId === 'b')?.pageIndex).toBe(1)
  })

  it('显式 kind=long 的长组件才允许拆', () => {
    const r = paginate([blk('a', 900), blk('b', 1200, { kind: 'long' })], { page: PAGE })
    const fragments = r.boxes.filter((x) => x.componentId === 'b')
    expect(fragments.length).toBeGreaterThan(1)
  })

  it('显式 kind=short 即使很高也不拆（极端情况交给 overflow 告警）', () => {
    const r = paginate([blk('a', 1500, { kind: 'short' })], { page: PAGE })
    expect(r.boxes.filter((x) => x.componentId === 'a')).toHaveLength(1)
  })
})

describe('拆分：内容一个字节都不丢（契约 §5 不变量 2）', () => {
  it('长组件拆成多段，高度之和等于原高', () => {
    const r = paginate([blk('a', 900), blk('b', 1200, { kind: 'long' })], { page: PAGE })
    const fragments = r.boxes.filter((x) => x.componentId === 'b')
    expect(sumHeights(fragments)).toBe(1200)
  })

  it('fragmentIndex 从 0 连续递增', () => {
    const r = paginate([blk('b', 2500, { kind: 'long' })], { page: PAGE })
    const fragments = r.boxes.filter((x) => x.componentId === 'b')
    expect(fragments.map((x) => x.fragmentIndex)).toEqual([0, 1, 2])
    expect(sumHeights(fragments)).toBe(2500)
  })

  it('片段跨页时 pageIndex 递增', () => {
    const r = paginate([blk('b', 2500, { kind: 'long' })], { page: PAGE })
    const pagesOfB = r.boxes.filter((x) => x.componentId === 'b').map((x) => x.pageIndex)
    expect(pagesOfB).toEqual([0, 1, 2])
  })

  it('所有块的片段高度总和 = 输入高度总和', () => {
    const blocks = [blk('a', 400), blk('b', 1500, { kind: 'long' }), blk('c', 300)]
    const r = paginate(blocks, { page: PAGE })
    expect(sumHeights(r.boxes)).toBe(400 + 1500 + 300)
  })
})

describe('标题不孤立', () => {
  it('标题放得下但下方塞不下正文时，整组推到下一页', () => {
    const blocks = [blk('filler', 900), blk('h', 50, { isHeading: true }), blk('body', 300)]
    const r = paginate(blocks, { page: PAGE })

    expect(r.pages).toHaveLength(2)
    const heading = r.boxes.find((x) => x.componentId === 'h')
    const body = r.boxes.find((x) => x.componentId === 'body')
    // 标题与正文必须在同一页
    expect(heading?.pageIndex).toBe(1)
    expect(body?.pageIndex).toBe(1)
  })

  it('标题在第一页顶部时不受影响', () => {
    const r = paginate([blk('h', 50, { isHeading: true }), blk('body', 300)], { page: PAGE })
    expect(r.pages).toHaveLength(1)
    expect(r.warnings).toEqual([])
  })
})

describe('溢出告警', () => {
  it('空页都放不下的块给 blocking 级 overflow-page', () => {
    const r = paginate([blk('huge', 1500, { kind: 'short' })], { page: PAGE })
    const w = r.warnings.find((x) => x.type === 'overflow-page')
    expect(w).toBeDefined()
    expect(w?.severity).toBe('blocking')
    expect(w?.componentId).toBe('huge')
    expect(w?.suggestion.length).toBeGreaterThan(0)
  })

  it('页数超过建议给 suggestion 级 page-count', () => {
    const blocks = [blk('a', 900), blk('b', 900), blk('c', 900)]
    const r = paginate(blocks, { page: PAGE, suggestedMaxPages: 2 })
    const w = r.warnings.find((x) => x.type === 'page-count')
    expect(w?.severity).toBe('suggestion')
    expect(r.pages.length).toBeGreaterThan(2)
  })

  it('没超建议页数时不报警', () => {
    const r = paginate([blk('a', 900)], { page: PAGE, suggestedMaxPages: 2 })
    expect(r.warnings).toEqual([])
  })
})

describe('间距与统计', () => {
  it('gap 只加在块之间', () => {
    const r = paginate([blk('a', 100), blk('b', 100)], { page: PAGE, gap: 10 })
    expect(r.boxes[0]?.y).toBe(60)
    expect(r.boxes[1]?.y).toBe(170)
  })

  it('fragmentCountByPage 按页计数且无空洞', () => {
    const r = paginate([blk('a', 900), blk('b', 1200, { kind: 'long' })], { page: PAGE })
    const counts = fragmentCountByPage(r.boxes)
    expect(counts.length).toBe(r.pages.length)
    expect(counts.every((n) => typeof n === 'number')).toBe(true)
    expect(counts.reduce((s, n) => s + n, 0)).toBe(r.boxes.length)
  })
})

describe('确定性（不变量 1 / 3）', () => {
  it('同输入连跑十次结果完全一致', () => {
    const blocks = [blk('a', 400), blk('b', 1500, { kind: 'long' }), blk('c', 300)]
    const first = paginate(blocks, { page: PAGE, gap: 6 })

    for (let i = 0; i < 10; i += 1) {
      const again = paginate(blocks, { page: PAGE, gap: 6 })
      expect(again.boxes).toEqual(first.boxes)
      expect(again.pages).toEqual(first.pages)
      expect(again.warnings).toEqual(first.warnings)
    }
  })

  it('不修改入参', () => {
    const blocks = [blk('a', 100)]
    const snapshot = JSON.stringify(blocks)
    paginate(blocks, { page: PAGE })
    expect(JSON.stringify(blocks)).toBe(snapshot)
  })
})
