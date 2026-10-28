/**
 * 质量检查引擎（TC-013a / fe-content）
 * 契约：docs/contract/CONTRACT.md §8「MVP-7 质量检查」
 *
 * 模块边界：
 *   types.ts         Issue / QualityReport / 严重度分桶
 *   content-check.ts 内容完整性检查（FR-QA-001）
 *   layout-check.ts  布局合法性检查（FR-QA-002）
 *   index.ts         runQualityChecks 统一入口
 *
 * 使用约束（契约 §8 不变量 2）：
 *   blocking 非空时，导出层不得静默产出文件（FR-EXP-003）。
 *   本报告是导出层与 UI 的唯一消费入口。
 */

export type {
  Issue,
  QualityCheckInput,
  QualityIssueType,
  QualityReport,
  QualitySeverity,
} from './types'

export {
  QUALITY_ISSUE_TYPES,
  classifyIssues,
  emptyReport,
  hasBlockingIssues,
  totalIssueCount,
} from './types'

export {
  checkContentPlacement,
  checkLostContent,
  checkRequiredFields,
  runContentChecks,
} from './content-check'

export {
  checkInvalidSizes,
  checkOutOfBounds,
  checkPageCount,
  mapLayoutWarnings,
  runLayoutChecks,
} from './layout-check'

import { runContentChecks } from './content-check'
import { runLayoutChecks } from './layout-check'
import { classifyIssues } from './types'
import type { QualityCheckInput, QualityReport } from './types'

/**
 * 执行全部质量检查，返回分级报告（契约 §8 唯一入口）。
 *
 * @param input 文档 + 布局结果 + 可选必填字段清单
 * @returns QualityReport{ blocking, warnings, suggestions }
 *
 * 导出层使用方式（FR-EXP-003）：
 *   const report = runQualityChecks({ doc, layout })
 *   if (hasBlockingIssues(report)) { 拦截导出，展示 report.blocking }
 */
export function runQualityChecks(input: QualityCheckInput): QualityReport {
  const { doc, layout, requiredFields } = input

  const allIssues = [
    ...runContentChecks(doc, layout, requiredFields),
    ...runLayoutChecks(layout),
  ]

  return classifyIssues(allIssues)
}
