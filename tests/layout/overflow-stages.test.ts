/**
 * TC-007 段③：溢出三阶段回归测试
 * 对照：CONTRACT §5 不变量 3（三阶段各自产候选、压缩手段限行距/字距/留白、不删内容）
 */

import { describe, expect, it } from 'vitest'

import {
  COMPRESS_LIMITS,
  DEFAULT_BASELINE,
  proposeCompress,
  proposeOverflowPlan,
  proposePushDown,
  proposeSplit,
} from '../../src/layout/overflow-stages'

const OVERFLOW = [
  { componentId: 'a', height: 1200, pageIndex: 0 },
  { componentId: 'b', height: 300, pageIndex: 1 },
]

describe('阶段一：压缩', () => {
  it('组件级候选只针对溢出组件，不误伤其他块', () => {
    const list = proposeCompress(['a'])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ stage: 'compress', scope: 'component', componentId: 'a' })
  })

  it('压缩值严格落在下限内（不越界）', () => {
    const list = proposeCompress(['a'])
    const p = list[0]?.params
    expect(p?.lineHeight).toBeGreaterThanOrEqual(COMPRESS_LIMITS.minLineHeight)
    expect(p?.letterSpacingPx).toBeGreaterThanOrEqual(COMPRESS_LIMITS.minLetterSpacingPx)
    expect(p?.paddingY).toBeGreaterThanOrEqual(COMPRESS_LIMITS.minPaddingY)
  })

  it('已经很紧时不再继续压（幂等于下限）', () => {
    const tight = { ...DEFAULT_BASELINE, lineHeight: 1.2, letterSpacingPx: -0.2, paddingY: 0 }
    const list = proposeCompress(['a'], tight)
    const p = list[0]?.params
    expect(p?.lineHeight).toBe(1.2)
    expect(p?.letterSpacingPx).toBe(-0.2)
    expect(p?.paddingY).toBe(0)
  })

  // 回归：baseline 本身已越过下限时，直接 clamp 会得到"放宽"（min>max 时 clamp 取 max），
  // 与压缩的目的相反。shrinkTo 保证上限永远是 baseline 本身。
  it('baseline 已越过下限时不得放宽（只许 ≤ baseline）', () => {
    const belowFloor = { ...DEFAULT_BASELINE, letterSpacingPx: -0.3, paddingY: -1 }
    const list = proposeCompress(['a'], belowFloor)
    const p = list[0]?.params
    expect(p?.letterSpacingPx ?? 0).toBeLessThanOrEqual(-0.3)
    expect(p?.paddingY ?? 0).toBeLessThanOrEqual(-1)
  })

  it('多个溢出块时追加页级候选，排在组件级之后', () => {
    const list = proposeCompress(['a', 'b'])
    expect(list).toHaveLength(3)
    expect(list[0]?.scope).toBe('component')
    expect(list[1]?.scope).toBe('component')
    expect(list[2]?.scope).toBe('page')
  })

  it('只有一个溢出块时不出页级候选（避免无谓地压扁整页）', () => {
    expect(proposeCompress(['a']).some((c) => c.scope === 'page')).toBe(false)
  })

  it('没有行数提示时 estimatedGainPx 为 null，不编数字', () => {
    const list = proposeCompress(['a'])
    expect(list[0]?.estimatedGainPx).toBeNull()
  })

  it('给了行数提示才估算，且为正数', () => {
    const list = proposeCompress(['a'], { ...DEFAULT_BASELINE, lineCountHint: 10 })
    const gain = list[0]?.estimatedGainPx
    expect(typeof gain).toBe('number')
    expect(gain).toBeGreaterThan(0)
  })

  it('每条候选都有可读理由', () => {
    for (const c of proposeCompress(['a', 'b'])) {
      expect(c.rationale.length).toBeGreaterThan(0)
    }
  })
})

describe('阶段二：拆分', () => {
  it('只对高过整页的块提拆分', () => {
    const list = proposeSplit(
      [
        { componentId: 'tall', height: 1200 },
        { componentId: 'ok', height: 800 },
      ],
      1000,
    )
    expect(list).toHaveLength(1)
    expect(list[0]?.componentId).toBe('tall')
  })

  it('拆分位置等于内容区高度', () => {
    const list = proposeSplit([{ componentId: 'tall', height: 1200 }], 1000)
    expect(list[0]?.atY).toBe(1000)
  })

  it('刚好等于页高不算高过（边界）', () => {
    expect(proposeSplit([{ componentId: 'x', height: 1000 }], 1000)).toHaveLength(0)
  })
})

describe('阶段三：下推', () => {
  it('目标页是当前页 +1，且不动任何视觉参数', () => {
    const list = proposePushDown([{ componentId: 'a', pageIndex: 0 }])
    expect(list[0]).toMatchObject({ stage: 'push-down', componentId: 'a', targetPage: 1 })
    expect(Object.keys(list[0] ?? {})).not.toContain('params')
  })
})

describe('三阶段编排', () => {
  it('顺序固定：压缩 → 拆分 → 下推', () => {
    const plan = proposeOverflowPlan({ overflow: OVERFLOW, contentHeight: 1000 })
    const stages = plan.map((c) => c.stage)
    const firstSplit = stages.indexOf('split')
    const firstPush = stages.indexOf('push-down')
    const lastCompress = stages.lastIndexOf('compress')

    expect(firstSplit).toBeGreaterThan(lastCompress)
    expect(firstPush).toBeGreaterThan(firstSplit)
  })

  it('宽页（1200 高）不产生拆分候选', () => {
    const plan = proposeOverflowPlan({
      overflow: [{ componentId: 'a', height: 1200, pageIndex: 0 }],
      contentHeight: 1400,
    })
    expect(plan.some((c) => c.stage === 'split')).toBe(false)
  })

  it('空溢出列表返回空计划', () => {
    expect(proposeOverflowPlan({ overflow: [], contentHeight: 1000 })).toEqual([])
  })

  it('确定性：连续两次生成完全一致', () => {
    const a = proposeOverflowPlan({ overflow: OVERFLOW, contentHeight: 1000 })
    const b = proposeOverflowPlan({ overflow: OVERFLOW, contentHeight: 1000 })
    expect(a).toEqual(b)
  })

  it('不修改入参', () => {
    const overflow = [
      { componentId: 'a', height: 1200, pageIndex: 0 },
    ]
    const snapshot = JSON.stringify(overflow)
    proposeOverflowPlan({ overflow, contentHeight: 1000 })
    expect(JSON.stringify(overflow)).toBe(snapshot)
  })

  it('候选里没有任何「删除内容」的选项（契约 §5 不变量 2）', () => {
    const plan = proposeOverflowPlan({ overflow: OVERFLOW, contentHeight: 1000 })
    for (const c of plan) {
      const text = `${c.stage} ${c.rationale}`
      expect(text).not.toContain('删除')
      expect(text).not.toContain('丢弃')
    }
  })
})
