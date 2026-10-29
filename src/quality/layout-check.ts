/**
 * 布局合法性检查（TC-013a / FR-QA-002）
 * 「检查越界、重叠、裁切、无效尺寸和分页异常。」
 *
 * 数据来源：
 *  1. LayoutResult.warnings —— TC-007 布局引擎已产出的警告（直接映射）
 *  2. LayoutResult.boxes/pages —— 几何级检查（无效尺寸、越界）
 */

import type { LayoutResult, LayoutWarningType } from '../layout/types'
import type { Issue, QualityIssueType } from './types'
import { QUALITY_ISSUE_TYPES } from './types'

/**
 * LayoutWarningType → QualityIssueType 映射。
 * 类型对应固定，不得随意增删（契约 §8 不变量 1）。
 */
const WARNING_TYPE_MAP: Record<LayoutWarningType, QualityIssueType> = {
  'overflow-component': QUALITY_ISSUE_TYPES.overflowComponent,
  'overflow-page': QUALITY_ISSUE_TYPES.overflowPage,
  overlap: QUALITY_ISSUE_TYPES.overlap,
  'blank-page': QUALITY_ISSUE_TYPES.blankPage,
  'page-count': QUALITY_ISSUE_TYPES.pageCount,
  'orphan-heading': QUALITY_ISSUE_TYPES.orphanHeading,
}

/**
 * 将 LayoutResult.warnings 映射为 Issue[]。
 * 严重度语义不变（裁切/丢内容 = blocking）。
 */
export function mapLayoutWarnings(layout: LayoutResult): Issue[] {
  return layout.warnings.map((w) => ({
    type: WARNING_TYPE_MAP[w.type] ?? QUALITY_ISSUE_TYPES.overflowComponent,
    pageIndex: w.pageIndex,
    componentId: w.componentId ?? '',
    severity: w.severity,
    cause: w.cause,
    suggestion: w.suggestion,
  }))
}

/** 几何级检查：盒子尺寸无效（负数或零面积）。 */
export function checkInvalidSizes(layout: LayoutResult): Issue[] {
  const issues: Issue[] = []

  for (const box of layout.boxes) {
    if (box.width <= 0 || box.height <= 0) {
      issues.push({
        type: QUALITY_ISSUE_TYPES.invalidSize,
        pageIndex: box.pageIndex,
        componentId: box.componentId,
        severity: 'blocking',
        cause: `组件「${box.componentId}」尺寸无效（${box.width}×${box.height}），内容不可见`,
        suggestion: '检查该组件的内容是否为空，或样式是否被误设为 0',
      })
    }
  }

  return issues
}

/** 几何级检查：盒子越出页面可用区域（超出 content 边界）。 */
export function checkOutOfBounds(layout: LayoutResult): Issue[] {
  const issues: Issue[] = []
  const pageMap = new Map(layout.pages.map((p) => [p.pageIndex, p]))

  for (const box of layout.boxes) {
    const page = pageMap.get(box.pageIndex)
    if (!page) continue

    const overflowsX =
      box.x < page.contentX - 0.5 || box.x + box.width > page.contentX + page.contentWidth + 0.5
    const overflowsY =
      box.y < page.contentY - 0.5 || box.y + box.height > page.contentY + page.contentHeight + 0.5

    if (overflowsX || overflowsY) {
      issues.push({
        type: QUALITY_ISSUE_TYPES.clip,
        pageIndex: box.pageIndex,
        componentId: box.componentId,
        severity: 'blocking',
        cause: `组件「${box.componentId}」超出页面 ${box.pageIndex + 1} 的可用区域，内容会被裁切`,
        suggestion: '缩短该组件内容，或调整页边距',
      })
    }
  }

  return issues
}

/** 几何级检查：页数超建议（≥3 页给 warning，不阻断）。 */
export function checkPageCount(layout: LayoutResult, maxRecommended = 2): Issue[] {
  if (layout.pages.length <= maxRecommended) return []
  return [
    {
      type: QUALITY_ISSUE_TYPES.pageCount,
      pageIndex: -1,
      componentId: '',
      severity: 'warning',
      cause: `当前简历共 ${layout.pages.length} 页，超过建议的 ${maxRecommended} 页`,
      suggestion: '精简内容以控制在 2 页内，简历惯例是 1-2 页',
    },
  ]
}

/**
 * 执行全部布局合法性检查。
 * 两路：warnings 直接映射 + 几何级检查。
 */
export function runLayoutChecks(layout: LayoutResult): Issue[] {
  return [
    ...mapLayoutWarnings(layout),
    ...checkInvalidSizes(layout),
    ...checkOutOfBounds(layout),
    ...checkPageCount(layout),
  ]
}
