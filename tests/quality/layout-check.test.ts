/**
 * TC-013a 布局合法性检查测试（FR-QA-002）
 * 验收要求：正常/阻断/警告/建议各至少 2 例
 */

import { describe, expect, it } from 'vitest'
import {
  checkInvalidSizes,
  checkOutOfBounds,
  checkPageCount,
  mapLayoutWarnings,
  runLayoutChecks,
} from '../../src/quality/layout-check'
import type { LayoutResult, LayoutWarning } from '../../src/layout/types'

function makeLayout(overrides: Partial<LayoutResult> = {}): LayoutResult {
  return {
    boxes: [],
    pages: [
      { pageIndex: 0, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979 },
    ],
    warnings: [],
    engineVersion: 'test',
    inputHash: 'hash',
    ...overrides,
  }
}

function makeBox(overrides: Partial<LayoutResult['boxes'][number]> = {}) {
  return { componentId: 'c1', pageIndex: 0, fragmentIndex: 0, x: 72, y: 72, width: 650, height: 100, ...overrides }
}

function makeWarning(overrides: Partial<LayoutWarning> = {}): LayoutWarning {
  return {
    type: 'overflow-component',
    pageIndex: 0,
    componentId: 'c1',
    severity: 'warning',
    cause: '测试原因',
    suggestion: '测试建议',
    ...overrides,
  }
}

describe('mapLayoutWarnings（映射 LayoutResult.warnings）', () => {
  // ── 正常 × 2 ──
  it('正常：空 warnings → 空数组', () => {
    expect(mapLayoutWarnings(makeLayout())).toHaveLength(0)
  })

  it('正常：保留原始 cause/suggestion/pageIndex', () => {
    const w = makeWarning({ cause: '组件超出', suggestion: '精简内容' })
    const issues = mapLayoutWarnings(makeLayout({ warnings: [w] }))
    expect(issues[0].cause).toBe('组件超出')
    expect(issues[0].suggestion).toBe('精简内容')
    expect(issues[0].pageIndex).toBe(0)
    expect(issues[0].componentId).toBe('c1')
  })

  // ── 警告 × 2 ──
  it('警告：overflow-component → layout-overflow-component', () => {
    const issues = mapLayoutWarnings(makeLayout({ warnings: [makeWarning({ type: 'overflow-component' })] }))
    expect(issues[0].type).toBe('layout-overflow-component')
  })

  it('警告：overlap → layout-overlap', () => {
    const issues = mapLayoutWarnings(makeLayout({ warnings: [makeWarning({ type: 'overlap' })] }))
    expect(issues[0].type).toBe('layout-overlap')
    expect(issues[0].severity).toBe('warning')
  })

  // ── 阻断 × 1 ──
  it('阻断：overflow-page 保持 blocking 严重度', () => {
    const issues = mapLayoutWarnings(
      makeLayout({ warnings: [makeWarning({ type: 'overflow-page', severity: 'blocking' })] }),
    )
    expect(issues[0].severity).toBe('blocking')
  })
})

describe('checkInvalidSizes', () => {
  it('正常：尺寸有效 → 无 issue', () => {
    expect(checkInvalidSizes(makeLayout({ boxes: [makeBox()] }))).toHaveLength(0)
  })

  it('阻断：width=0 → layout-invalid-size', () => {
    const issues = checkInvalidSizes(makeLayout({ boxes: [makeBox({ width: 0 })] }))
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('layout-invalid-size')
    expect(issues[0].severity).toBe('blocking')
  })

  it('阻断：height 为负数 → layout-invalid-size', () => {
    const issues = checkInvalidSizes(makeLayout({ boxes: [makeBox({ height: -50 })] }))
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('blocking')
  })
})

describe('checkOutOfBounds', () => {
  it('正常：盒子在内容区内 → 无 issue', () => {
    expect(checkOutOfBounds(makeLayout({ boxes: [makeBox()] }))).toHaveLength(0)
  })

  it('阻断：盒子超出右边界 → layout-clip', () => {
    const issues = checkOutOfBounds(makeLayout({ boxes: [makeBox({ x: 700, width: 100 })] }))
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('layout-clip')
    expect(issues[0].severity).toBe('blocking')
  })

  it('阻断：盒子超出下边界 → layout-clip', () => {
    const issues = checkOutOfBounds(makeLayout({ boxes: [makeBox({ y: 1100, height: 200 })] }))
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('blocking')
  })

  it('正常：边界 0.5px 容差内不算越界', () => {
    // contentX=72, contentWidth=650 → 右边界 722。box 到 722.3 应在容差内
    expect(checkOutOfBounds(makeLayout({ boxes: [makeBox({ x: 700, width: 22.3 })] }))).toHaveLength(0)
  })
})

describe('checkPageCount', () => {
  it('正常：2 页不告警', () => {
    const layout = makeLayout({
      pages: [
        { pageIndex: 0, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979 },
        { pageIndex: 1, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979 },
      ],
    })
    expect(checkPageCount(layout)).toHaveLength(0)
  })

  it('正常：单页不告警', () => {
    expect(checkPageCount(makeLayout())).toHaveLength(0)
  })

  it('警告：3 页 → layout-page-count', () => {
    const layout = makeLayout({
      pages: Array.from({ length: 3 }, (_, i) => ({
        pageIndex: i, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979,
      })),
    })
    const issues = checkPageCount(layout)
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('layout-page-count')
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].cause).toContain('3 页')
  })

  it('警告：5 页也只告警一次', () => {
    const layout = makeLayout({
      pages: Array.from({ length: 5 }, (_, i) => ({
        pageIndex: i, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979,
      })),
    })
    expect(checkPageCount(layout)).toHaveLength(1)
  })
})

describe('runLayoutChecks 汇总', () => {
  it('混合场景：warnings 映射 + 几何检查', () => {
    const layout = makeLayout({
      boxes: [makeBox({ width: 0 })], // 阻断
      warnings: [makeWarning({ type: 'overlap' })], // 警告
    })
    const issues = runLayoutChecks(layout)
    // overlap(warning) + invalidSize(blocking) = 2
    expect(issues).toHaveLength(2)
    expect(issues.filter((i) => i.severity === 'blocking')).toHaveLength(1)
    expect(issues.filter((i) => i.severity === 'warning')).toHaveLength(1)
  })

  it('正常：空布局+空 warnings → 无 issue', () => {
    expect(runLayoutChecks(makeLayout())).toHaveLength(0)
  })
})
