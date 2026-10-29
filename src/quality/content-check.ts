/**
 * 内容完整性检查（TC-013a / FR-QA-001）
 * 「对导入前后的文本、内部模型和导出文件进行尽可能可行的比较。」
 *
 * 检查维度：
 *  1. 组件放置：文档中的每个组件是否在 LayoutResult.boxes 中有对应位置
 *  2. 必填字段：组件的 requiredFields 是否为空
 *  3. 内容丢失：layout.boxes 中出现但文档中已不存在的组件（数据不一致）
 */

import type { ResumeDocument, ResumeComponent, UnknownComponent } from '../model/types'
import type { LayoutResult } from '../layout/types'
import { QUALITY_ISSUE_TYPES } from './types'
import type { Issue } from './types'

function isUnknownComponent(c: ResumeComponent | UnknownComponent): c is UnknownComponent {
  return 'unknown' in c && c.unknown === true
}

function isKnownComponent(c: ResumeComponent | UnknownComponent): c is ResumeComponent {
  return !isUnknownComponent(c)
}

/** 检查文档组件是否都在布局中被放置（FR-QA-001 核心）。 */
export function checkContentPlacement(
  doc: ResumeDocument,
  layout: LayoutResult,
): Issue[] {
  const issues: Issue[] = []
  const placedIds = new Set(layout.boxes.map((b) => b.componentId))

  for (const component of doc.components) {
    // 不可见组件不参与布局，跳过
    if (!component.visible) continue

    if (!placedIds.has(component.id)) {
      issues.push({
        type: QUALITY_ISSUE_TYPES.unplacedComponent,
        pageIndex: -1,
        componentId: component.id,
        severity: 'blocking',
        cause: `组件「${component.id}」未出现在任何页面上，内容可能丢失`,
        suggestion: '检查该组件是否被误删或布局引擎是否遗漏',
      })
    }
  }

  return issues
}

/**
 * 检查必填字段是否为空。
 * @param requiredFields 按组件 type 指定必须非空的字段名
 */
export function checkRequiredFields(
  doc: ResumeDocument,
  requiredFields: Record<string, string[]> = {},
): Issue[] {
  const issues: Issue[] = []

  for (const component of doc.components) {
    if (!isKnownComponent(component)) continue
    if (!component.visible) continue

    const required = requiredFields[component.type]
    if (!required || required.length === 0) continue

    for (const fieldName of required) {
      const value = component.fields[fieldName]
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)

      if (isEmpty) {
        issues.push({
          type: QUALITY_ISSUE_TYPES.emptyComponent,
          pageIndex: -1,
          componentId: component.id,
          severity: 'suggestion',
          cause: `组件「${component.id}」的必填字段「${fieldName}」为空`,
          suggestion: `补充「${fieldName}」内容，或确认该字段是否确实不需要`,
        })
      }
    }
  }

  return issues
}

/**
 * 检查布局中是否存在文档里已不存在的组件（数据一致性）。
 * 正常运行不应出现；出现即为 bug 或外部数据损坏。
 */
export function checkLostContent(
  doc: ResumeDocument,
  layout: LayoutResult,
): Issue[] {
  const issues: Issue[] = []
  const docIds = new Set(doc.components.map((c) => c.id))
  const seen = new Set<string>()

  for (const box of layout.boxes) {
    if (seen.has(box.componentId)) continue
    seen.add(box.componentId)

    if (!docIds.has(box.componentId)) {
      issues.push({
        type: QUALITY_ISSUE_TYPES.lostContent,
        pageIndex: box.pageIndex,
        componentId: box.componentId,
        severity: 'blocking',
        cause: `布局中存在组件「${box.componentId}」，但文档中已不存在，数据不一致`,
        suggestion: '从备份恢复文档，或重新导入源文件',
      })
    }
  }

  return issues
}

/**
 * 执行全部内容完整性检查。
 * @param requiredFields 可选：必填字段清单
 */
export function runContentChecks(
  doc: ResumeDocument,
  layout: LayoutResult,
  requiredFields?: Record<string, string[]>,
): Issue[] {
  return [
    ...checkContentPlacement(doc, layout),
    ...checkLostContent(doc, layout),
    ...checkRequiredFields(doc, requiredFields),
  ]
}
