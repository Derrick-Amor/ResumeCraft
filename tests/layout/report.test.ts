/**
 * TC-007 布局报告工具回归测试
 * 对照：CONTRACT §5（结果结构 / 确定性）、§8（严重度语义与阻断口径）
 */

import { describe, expect, it } from 'vitest'

import {
  SEVERITY_RANK,
  dedupeWarnings,
  geometryFingerprint,
  groupWarningsByPage,
  hasBlockingIssue,
  sortWarnings,
  summarizeWarnings,
} from '../../src/layout/report'
import type { ComponentBox, LayoutWarning, PageBox } from '../../src/layout/types'

function w(partial: Partial<LayoutWarning> & Pick<LayoutWarning, 'type' | 'pageIndex'>): LayoutWarning {
  return {
    severity: 'warning',
    cause: '原因',
    suggestion: '建议',
    ...partial,
  }
}

const PAGE: PageBox = {
  pageIndex: 0,
  width: 794,
  height: 1123,
  contentX: 60,
  contentY: 60,
  contentWidth: 674,
  contentHeight: 1003,
}

const BOX: ComponentBox = {
  componentId: 'cmp_1',
  pageIndex: 0,
  fragmentIndex: 0,
  x: 60,
  y: 60,
  width: 674,
  height: 120,
}

describe('严重度权重', () => {
  it('blocking < warning < suggestion', () => {
    expect(SEVERITY_RANK.blocking).toBeLessThan(SEVERITY_RANK.warning)
    expect(SEVERITY_RANK.warning).toBeLessThan(SEVERITY_RANK.suggestion)
  })
})

describe('sortWarnings：先页、再严重度、最后 id', () => {
  it('按页升序', () => {
    const list = [w({ type: 'overflow-page', pageIndex: 2 }), w({ type: 'overlap', pageIndex: 0 })]
    expect(sortWarnings(list).map((x) => x.pageIndex)).toEqual([0, 2])
  })

  it('同页内阻断排最前', () => {
    const list = [
      w({ type: 'page-count', pageIndex: 0, severity: 'suggestion' }),
      w({ type: 'overlap', pageIndex: 0, severity: 'warning' }),
      w({ type: 'overflow-component', pageIndex: 0, severity: 'blocking' }),
    ]
    expect(sortWarnings(list).map((x) => x.severity)).toEqual([
      'blocking',
      'warning',
      'suggestion',
    ])
  })

  it('不修改入参', () => {
    const list = [w({ type: 'overlap', pageIndex: 1 }), w({ type: 'overlap', pageIndex: 0 })]
    const snapshot = list.map((x) => x.pageIndex)
    sortWarnings(list)
    expect(list.map((x) => x.pageIndex)).toEqual(snapshot)
  })

  it('两次排序结果完全一致（确定性）', () => {
    const list = [
      w({ type: 'overlap', pageIndex: 1, componentId: 'b' }),
      w({ type: 'overlap', pageIndex: 1, componentId: 'a' }),
      w({ type: 'orphan-heading', pageIndex: 0 }),
    ]
    expect(sortWarnings(list)).toEqual(sortWarnings(list))
    // 同页同严重度按组件 id 字典序
    const sameePage = sortWarnings(list).filter((x) => x.pageIndex === 1)
    expect(sameePage.map((x) => x.componentId)).toEqual(['a', 'b'])
  })
})

describe('dedupeWarnings', () => {
  it('同类型同页同组件同严重度只留一份', () => {
    const list = [
      w({ type: 'overlap', pageIndex: 0, componentId: 'a' }),
      w({ type: 'overlap', pageIndex: 0, componentId: 'a' }),
    ]
    expect(dedupeWarnings(list)).toHaveLength(1)
  })

  it('不同组件 / 不同页 / 不同严重度都算不同条', () => {
    const list = [
      w({ type: 'overlap', pageIndex: 0, componentId: 'a' }),
      w({ type: 'overlap', pageIndex: 0, componentId: 'b' }),
      w({ type: 'overlap', pageIndex: 1, componentId: 'a' }),
      w({ type: 'overlap', pageIndex: 0, componentId: 'a', severity: 'blocking' }),
    ]
    expect(dedupeWarnings(list)).toHaveLength(4)
  })
})

describe('summarizeWarnings 与 hasBlockingIssue', () => {
  it('分类计数', () => {
    const list = [
      w({ type: 'overlap', pageIndex: 0, severity: 'blocking' }),
      w({ type: 'overflow-page', pageIndex: 0, severity: 'warning' }),
      w({ type: 'page-count', pageIndex: 0, severity: 'suggestion' }),
      w({ type: 'blank-page', pageIndex: 1, severity: 'suggestion' }),
    ]
    expect(summarizeWarnings(list)).toEqual({
      blocking: 1,
      warning: 1,
      suggestion: 2,
      total: 4,
    })
  })

  it('空列表摘要全 0', () => {
    expect(summarizeWarnings([])).toEqual({ blocking: 0, warning: 0, suggestion: 0, total: 0 })
  })

  it('只要有一条 blocking 就返回 true（导出层据此拦截）', () => {
    expect(hasBlockingIssue([w({ type: 'overlap', pageIndex: 0, severity: 'blocking' })])).toBe(true)
    expect(hasBlockingIssue([w({ type: 'overlap', pageIndex: 0, severity: 'warning' })])).toBe(false)
    expect(hasBlockingIssue([])).toBe(false)
  })
})

describe('groupWarningsByPage', () => {
  it('按页分组且组内有序', () => {
    const list = [
      w({ type: 'overflow-page', pageIndex: 1, severity: 'warning' }),
      w({ type: 'overlap', pageIndex: 0, severity: 'blocking' }),
      w({ type: 'page-count', pageIndex: 1, severity: 'suggestion' }),
    ]
    const groups = groupWarningsByPage(list)
    expect(groups.map((g) => g.pageIndex)).toEqual([0, 1])
    expect(groups[1]?.warnings.map((x) => x.severity)).toEqual(['warning', 'suggestion'])
  })

  it('空输入返回空数组', () => {
    expect(groupWarningsByPage([])).toEqual([])
  })
})

describe('geometryFingerprint：同输入必同 hash', () => {
  it('同几何得到同指纹', () => {
    const a = geometryFingerprint({ boxes: [BOX], pages: [PAGE] })
    const b = geometryFingerprint({ boxes: [{ ...BOX }], pages: [{ ...PAGE }] })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
  })

  it('位置变一点，指纹就变', () => {
    const a = geometryFingerprint({ boxes: [BOX], pages: [PAGE] })
    const b = geometryFingerprint({ boxes: [{ ...BOX, y: 61 }], pages: [PAGE] })
    expect(a).not.toBe(b)
  })

  it('片段序号不同也算不同几何', () => {
    const a = geometryFingerprint({ boxes: [BOX], pages: [PAGE] })
    const b = geometryFingerprint({ boxes: [{ ...BOX, fragmentIndex: 1 }], pages: [PAGE] })
    expect(a).not.toBe(b)
  })

  it('页面顺序不影响内容指纹的稳定性（按输入顺序计算，同输入同输出）', () => {
    const first = geometryFingerprint({ boxes: [BOX], pages: [PAGE] })
    for (let i = 0; i < 5; i += 1) {
      expect(geometryFingerprint({ boxes: [BOX], pages: [PAGE] })).toBe(first)
    }
  })
})
