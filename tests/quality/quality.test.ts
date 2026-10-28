/**
 * TC-013a runQualityChecks 入口测试 + 类型/分桶测试
 * 契约 §8：runQualityChecks(doc, layoutResult) → QualityReport
 * 验收要求：三类严重度分级正确 + API 稳定
 */

import { describe, expect, it } from 'vitest'
import {
  QUALITY_ISSUE_TYPES,
  classifyIssues,
  emptyReport,
  hasBlockingIssues,
  runQualityChecks,
  totalIssueCount,
} from '../../src/quality'
import type { Issue, QualityReport } from '../../src/quality'
import { createDocument, createComponent } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'
import type { LayoutResult } from '../../src/layout/types'

const NOW = '2026-10-28T00:00:00.000Z'

const DEFAULT_COMPONENTS = Symbol('default')

function makeDoc(
  components: ReturnType<typeof createComponent>[] | typeof DEFAULT_COMPONENTS = DEFAULT_COMPONENTS,
): ResumeDocument {
  return createDocument({
    documentId: 'doc_001',
    now: NOW,
    createdAt: NOW,
    title: '测试简历',
    languageTrack: 'zh',
    components:
      components === DEFAULT_COMPONENTS
        ? [createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } })]
        : components,
  })
}

function makeLayout(overrides: Partial<LayoutResult> = {}): LayoutResult {
  return {
    boxes: [{ componentId: 'c1', pageIndex: 0, fragmentIndex: 0, x: 72, y: 72, width: 650, height: 100 }],
    pages: [{ pageIndex: 0, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979 }],
    warnings: [],
    engineVersion: 'test',
    inputHash: 'hash',
    ...overrides,
  }
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: QUALITY_ISSUE_TYPES.emptyComponent,
    pageIndex: -1,
    componentId: 'c1',
    severity: 'suggestion',
    cause: '测试原因',
    suggestion: '测试建议',
    ...overrides,
  }
}

describe('runQualityChecks（契约 §8 唯一入口）', () => {
  // ── 正常 × 2 ──
  it('正常：文档+布局完全一致 → 三桶皆空', () => {
    const report = runQualityChecks({ doc: makeDoc(), layout: makeLayout() })
    expect(report.blocking).toHaveLength(0)
    expect(report.warnings).toHaveLength(0)
    expect(report.suggestions).toHaveLength(0)
  })

  it('正常：空文档+空布局 → 三桶皆空', () => {
    const report = runQualityChecks({ doc: makeDoc([]), layout: makeLayout({ boxes: [] }) })
    expect(hasBlockingIssues(report)).toBe(false)
    expect(totalIssueCount(report)).toBe(0)
  })

  // ── 阻断 × 2 ──
  it('阻断：组件未放置 → blocking 非空', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} }),
      createComponent({ id: 'c2', type: 'education', order: 1, fields: {} }),
    ])
    const layout = makeLayout() // 只放了 c1
    const report = runQualityChecks({ doc, layout })
    expect(report.blocking).toHaveLength(1)
    expect(report.blocking[0].type).toBe('content-unplaced')
    expect(hasBlockingIssues(report)).toBe(true)
  })

  it('阻断：盒子越界 → layout-clip 进 blocking', () => {
    const layout = makeLayout({
      boxes: [{ componentId: 'c1', pageIndex: 0, fragmentIndex: 0, x: 700, y: 72, width: 100, height: 100 }],
    })
    const report = runQualityChecks({ doc: makeDoc(), layout })
    expect(report.blocking.some((i) => i.type === 'layout-clip')).toBe(true)
    expect(hasBlockingIssues(report)).toBe(true)
  })

  // ── 警告 × 2 ──
  it('警告：overlap 映射 → warnings', () => {
    const layout = makeLayout({
      warnings: [
        {
          type: 'overlap',
          pageIndex: 0,
          componentId: 'c1',
          severity: 'warning',
          cause: '组件重叠',
          suggestion: '调整位置',
        },
      ],
    })
    const report = runQualityChecks({ doc: makeDoc(), layout })
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0].type).toBe('layout-overlap')
    expect(hasBlockingIssues(report)).toBe(false)
  })

  it('警告：3 页 → page-count 进 warnings', () => {
    const layout = makeLayout({
      pages: Array.from({ length: 3 }, (_, i) => ({
        pageIndex: i, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979,
      })),
    })
    const report = runQualityChecks({ doc: makeDoc(), layout })
    expect(report.warnings.some((i) => i.type === 'layout-page-count')).toBe(true)
  })

  // ── 建议 × 2 ──
  it('建议：必填字段为空 → suggestions', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '' } })])
    const report = runQualityChecks({ doc, layout: makeLayout(), requiredFields: { basics: ['name'] } })
    expect(report.suggestions).toHaveLength(1)
    expect(report.suggestions[0].severity).toBe('suggestion')
  })

  it('建议：多个空字段 → 多条 suggestion', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '', email: '' } }),
    ])
    const report = runQualityChecks({
      doc,
      layout: makeLayout(),
      requiredFields: { basics: ['name', 'email'] },
    })
    expect(report.suggestions).toHaveLength(2)
    expect(hasBlockingIssues(report)).toBe(false)
  })

  // ── 分级正确性 ──
  it('分级正确：裁切=blocking，溢出=warning，空字段=suggestion', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '' } }),
    ])
    const layout = makeLayout({
      boxes: [{ componentId: 'c1', pageIndex: 0, fragmentIndex: 0, x: 700, y: 72, width: 100, height: 100 }],
      warnings: [
        {
          type: 'overflow-component',
          pageIndex: 0,
          componentId: 'c1',
          severity: 'warning',
          cause: '溢出',
          suggestion: '精简',
        },
      ],
    })
    const report = runQualityChecks({ doc, layout, requiredFields: { basics: ['name'] } })

    // blocking: layout-clip（越界裁切）
    expect(report.blocking.length).toBeGreaterThanOrEqual(1)
    expect(report.blocking.every((i) => i.severity === 'blocking')).toBe(true)
    // warnings: layout-overflow-component
    expect(report.warnings.length).toBeGreaterThanOrEqual(1)
    expect(report.warnings.every((i) => i.severity === 'warning')).toBe(true)
    // suggestions: content-empty
    expect(report.suggestions.length).toBeGreaterThanOrEqual(1)
    expect(report.suggestions.every((i) => i.severity === 'suggestion')).toBe(true)
  })
})

describe('classifyIssues / emptyReport / hasBlockingIssues', () => {
  it('classifyIssues 正确分桶', () => {
    const issues = [
      makeIssue({ severity: 'blocking' }),
      makeIssue({ severity: 'warning' }),
      makeIssue({ severity: 'suggestion' }),
      makeIssue({ severity: 'blocking' }),
    ]
    const report = classifyIssues(issues)
    expect(report.blocking).toHaveLength(2)
    expect(report.warnings).toHaveLength(1)
    expect(report.suggestions).toHaveLength(1)
  })

  it('emptyReport 三桶皆空', () => {
    const report = emptyReport()
    expect(report.blocking).toHaveLength(0)
    expect(report.warnings).toHaveLength(0)
    expect(report.suggestions).toHaveLength(0)
  })

  it('hasBlockingIssues 为空 false，非空 true', () => {
    const empty: QualityReport = emptyReport()
    expect(hasBlockingIssues(empty)).toBe(false)
    expect(hasBlockingIssues({ ...empty, blocking: [makeIssue()] })).toBe(true)
  })

  it('totalIssueCount 正确统计', () => {
    const report = classifyIssues([makeIssue({ severity: 'blocking' }), makeIssue({ severity: 'suggestion' })])
    expect(totalIssueCount(report)).toBe(2)
  })
})

describe('API 稳定性（TC-010/011 直接调用的契约面）', () => {
  it('Issue 字段齐全：type/pageIndex/componentId/severity/cause/suggestion', () => {
    const issue = makeIssue()
    expect(typeof issue.type).toBe('string')
    expect(typeof issue.pageIndex).toBe('number')
    expect(typeof issue.componentId).toBe('string')
    expect(typeof issue.severity).toBe('string')
    expect(typeof issue.cause).toBe('string')
    expect(typeof issue.suggestion).toBe('string')
  })

  it('QualityReport 三桶结构固定', () => {
    const report = runQualityChecks({ doc: makeDoc(), layout: makeLayout() })
    expect(Array.isArray(report.blocking)).toBe(true)
    expect(Array.isArray(report.warnings)).toBe(true)
    expect(Array.isArray(report.suggestions)).toBe(true)
  })

  it('QUALITY_ISSUE_TYPES 覆盖 content-* 与 layout-* 两组', () => {
    const types = Object.values(QUALITY_ISSUE_TYPES)
    expect(types.some((t) => t.startsWith('content-'))).toBe(true)
    expect(types.some((t) => t.startsWith('layout-'))).toBe(true)
    expect(types).toHaveLength(12)
  })
})
