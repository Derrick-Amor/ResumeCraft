/**
 * 质量检查类型定义（TC-013a）
 * 契约：docs/contract/CONTRACT.md §8「MVP-7 质量检查」，本模块是定义方。
 *
 * 不变量：
 *  1. 严重度语义固定：裁切/丢内容 = blocking，溢出/重叠/空白页 = warning，可改善 = suggestion
 *  2. blocking 非空时，导出层不得静默产出文件（FR-EXP-003）
 *  3. 本报告是导出层与 UI 的唯一消费入口
 */

import type { LayoutResult, LayoutSeverity, LayoutWarningType } from '../layout/types'
import type { ResumeDocument } from '../model/types'

// ─── Issue ───────────────────────────────────────────────

/**
 * 单条检查结果。契约 §8 原文：
 * `Issue{ type, pageIndex, componentId, severity, cause, suggestion }`
 */
export interface Issue {
  /** 问题类型。稳定枚举，见 ISSUE_TYPES */
  type: QualityIssueType
  /** 发生页码（从 0 起）。与页面无关时为 -1 */
  pageIndex: number
  /** 相关组件 ID。与组件无关时为空串 */
  componentId: string
  /** 严重度 */
  severity: QualitySeverity
  /** 面向用户的原因说明。禁止含简历正文（FR-SEC-004 同源约束） */
  cause: string
  /** 处理建议。禁止写「请调整」这类废话 */
  suggestion: string
}

/** 严重度。与 LayoutSeverity 语义完全一致，独立定义便于 API 稳定。 */
export type QualitySeverity = LayoutSeverity

/**
 * 问题类型。两组：
 *  - content-*  内容完整性（FR-QA-001）
 *  - layout-*   布局合法性（FR-QA-002）
 */
export const QUALITY_ISSUE_TYPES = {
  // 内容完整性
  missingContent: 'content-missing',
  emptyComponent: 'content-empty',
  lostContent: 'content-lost',
  unplacedComponent: 'content-unplaced',
  // 布局合法性
  overflowComponent: 'layout-overflow-component',
  overflowPage: 'layout-overflow-page',
  overlap: 'layout-overlap',
  clip: 'layout-clip',
  invalidSize: 'layout-invalid-size',
  blankPage: 'layout-blank-page',
  pageCount: 'layout-page-count',
  orphanHeading: 'layout-orphan-heading',
} as const

export type QualityIssueType = (typeof QUALITY_ISSUE_TYPES)[keyof typeof QUALITY_ISSUE_TYPES]

// ─── QualityReport ───────────────────────────────────────

/**
 * 质量检查报告。契约 §8 原文：
 * `QualityReport{ blocking, warnings, suggestions }`
 */
export interface QualityReport {
  /** 阻断级问题：内容裁切/内容丢失/必然错页。非空则导出默认拦截 */
  blocking: Issue[]
  /** 警告级问题：溢出、重叠、异常空白页、页数超建议 */
  warnings: Issue[]
  /** 建议级问题：可改善项 */
  suggestions: Issue[]
}

/** 空报告。 */
export function emptyReport(): QualityReport {
  return { blocking: [], warnings: [], suggestions: [] }
}

/** 把 Issue 按 severity 分入三个桶。 */
export function classifyIssues(issues: readonly Issue[]): QualityReport {
  const report = emptyReport()
  for (const issue of issues) {
    if (issue.severity === 'blocking') report.blocking.push(issue)
    else if (issue.severity === 'warning') report.warnings.push(issue)
    else report.suggestions.push(issue)
  }
  return report
}

/** 报告是否包含阻断级问题（导出层用它决定是否拦截）。 */
export function hasBlockingIssues(report: QualityReport): boolean {
  return report.blocking.length > 0
}

/** 报告总条数。 */
export function totalIssueCount(report: QualityReport): number {
  return report.blocking.length + report.warnings.length + report.suggestions.length
}

// ─── 检查输入 ────────────────────────────────────────────

/**
 * runQualityChecks 的入参。
 * contentCheckOptions 可选：指定要检查的「必备字段清单」。
 */
export interface QualityCheckInput {
  /** 文档模型（事实源） */
  doc: ResumeDocument
  /** 布局结果（TC-007 产出） */
  layout: LayoutResult
  /** 可选：内容完整性检查的必备字段清单（按组件 type 指定必须非空的字段名） */
  requiredFields?: Record<string, string[]>
}

// ─── Re-export ───────────────────────────────────────────

export type { LayoutResult, LayoutSeverity, LayoutWarningType }
