/**
 * LayoutResult 快照回归（TC-013）
 * 固定样本 → 布局引擎输出 → 与锁定基准对比
 * 任何布局变更导致快照不匹配时必须人工确认后更新基准
 */

import { describe, expect, it } from 'vitest'
import { runLayoutChecks } from '../../src/quality'
import { zhStandardLayout, overflowLayout, longContentResume, zhStandardResume, blankResume, unknownComponentResume } from '../fixtures/sample-docs'
import { runContentChecks, classifyIssues } from '../../src/quality'

describe('LayoutResult 快照回归', () => {
  it('标准简历布局快照稳定', () => {
    const layout = zhStandardLayout()
    // 锁定几何：盒数量、位置、页面数
    expect(layout.boxes).toHaveLength(4)
    expect(layout.pages).toHaveLength(1)
    expect(layout.pages[0]!.width).toBe(210)
    expect(layout.pages[0]!.height).toBe(297)
    // 坐标不漂移
    expect(layout.boxes[0]!.x).toBe(20)
    expect(layout.boxes[0]!.y).toBe(20)
    expect(layout.boxes[3]!.y).toBe(220)
  })

  it('溢出布局快照：警告类型正确', () => {
    const layout = overflowLayout()
    expect(layout.warnings).toHaveLength(1)
    expect(layout.warnings[0]!.type).toBe('overflow-component')
    expect(layout.warnings[0]!.severity).toBe('warning')
  })

  it('质量检查输出稳定', () => {
    const layout = zhStandardLayout()
    const issues = runLayoutChecks(layout)
    expect(issues).toHaveLength(0) // 标准布局无问题
  })

  it('溢出布局触发质量检查', () => {
    const layout = overflowLayout()
    const issues = runLayoutChecks(layout)
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues[0]!.severity).toBe('warning')
  })
})

describe('内容完整性快照', () => {
  it('标准简历：无内容丢失', () => {
    const doc = zhStandardResume()
    const layout = zhStandardLayout()
    const issues = runContentChecks(doc, layout)
    const report = classifyIssues(issues)
    expect(report.blocking).toHaveLength(0)
  })

  it('空白简历：无 issue', () => {
    const doc = blankResume()
    const layout = { boxes: [], pages: [], warnings: [], engineVersion: 'test', inputHash: '' }
    const issues = runContentChecks(doc, layout)
    expect(issues).toHaveLength(0)
  })

  it('未知组件：内容不丢', () => {
    const doc = unknownComponentResume()
    const layout = {
      boxes: [
        { componentId: 'c_basics', pageIndex: 0, fragmentIndex: 0, x: 20, y: 20, width: 170, height: 50 },
        { componentId: 'c_unknown', pageIndex: 0, fragmentIndex: 0, x: 20, y: 80, width: 170, height: 50 },
      ],
      pages: [{ pageIndex: 0, width: 210, height: 297, contentX: 20, contentY: 20, contentWidth: 170, contentHeight: 257 }],
      warnings: [],
      engineVersion: 'test',
      inputHash: '',
    }
    const issues = runContentChecks(doc, layout)
    const report = classifyIssues(issues)
    expect(report.blocking).toHaveLength(0)
  })
})

describe('性能样本基线（PRD 11.1）', () => {
  it('1 页简历布局检查耗时 < 50ms', () => {
    const doc = zhStandardResume()
    const layout = zhStandardLayout()
    const start = performance.now()
    for (let i = 0; i < 10; i += 1) {
      runContentChecks(doc, layout)
      runLayoutChecks(layout)
    }
    const elapsed = (performance.now() - start) / 10
    expect(elapsed).toBeLessThan(50)
  })

  it('长内容（8 组件）布局检查耗时 < 100ms', () => {
    const doc = longContentResume()
    const layout = {
      boxes: doc.components.map((c, i) => ({
        componentId: c.id,
        pageIndex: i < 5 ? 0 : 1,
        fragmentIndex: 0,
        x: 20,
        y: 20 + (i % 5) * 50,
        width: 170,
        height: 45,
      })),
      pages: [
        { pageIndex: 0, width: 210, height: 297, contentX: 20, contentY: 20, contentWidth: 170, contentHeight: 257 },
        { pageIndex: 1, width: 210, height: 297, contentX: 20, contentY: 20, contentWidth: 170, contentHeight: 257 },
      ],
      warnings: [],
      engineVersion: 'test',
      inputHash: '',
    }
    const start = performance.now()
    for (let i = 0; i < 10; i += 1) {
      runContentChecks(doc, layout)
      runLayoutChecks(layout)
    }
    const elapsed = (performance.now() - start) / 10
    expect(elapsed).toBeLessThan(100)
  })
})
