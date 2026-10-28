/**
 * 布局报告工具（TC-007）
 * 从 LayoutResult.warnings 派生的纯函数集合：排序、去重、分级、摘要、指纹。
 *
 * 为什么单独成文件：UI 与导出层都要读警告，但它们不该各自实现一遍「哪些算阻断」。
 * 契约 §8 定死：blocking 非空时导出层不得静默产出文件。
 */

import type { LayoutResult, LayoutSeverity, LayoutWarning } from './types'

/** 严重度排序权重：数字越小越靠前 */
export const SEVERITY_RANK: Readonly<Record<LayoutSeverity, number>> = Object.freeze({
  blocking: 0,
  warning: 1,
  suggestion: 2,
})

/**
 * 排序：先按页，再按严重度，最后按组件 id。
 * 组内顺序必须**稳定**——两次相同输入必须出相同顺序（矩形 §5 不变量 3）。
 */
export function sortWarnings(warnings: readonly LayoutWarning[]): LayoutWarning[] {
  return [...warnings].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (rank !== 0) return rank
    const ac = a.componentId ?? ''
    const bc = b.componentId ?? ''
    if (ac !== bc) return ac < bc ? -1 : 1
    if (a.type !== b.type) return a.type < b.type ? -1 : 1
    return 0
  })
}

/** 同一条警告只留一份。判定键 = 类型 + 页 + 组件 + 严重度 */
export function dedupeWarnings(warnings: readonly LayoutWarning[]): LayoutWarning[] {
  const seen = new Set<string>()
  const result: LayoutWarning[] = []
  for (const w of warnings) {
    const key = `${w.type}|${w.pageIndex}|${w.componentId ?? ''}|${w.severity}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(w)
  }
  return result
}

export interface WarningSummary {
  blocking: number
  warning: number
  suggestion: number
  total: number
}

export function summarizeWarnings(warnings: readonly LayoutWarning[]): WarningSummary {
  let blocking = 0
  let warning = 0
  let suggestion = 0
  for (const w of warnings) {
    if (w.severity === 'blocking') blocking += 1
    else if (w.severity === 'warning') warning += 1
    else suggestion += 1
  }
  return { blocking, warning, suggestion, total: warnings.length }
}

/** 有阻断项就不允许静默导出（契约 §8 不变量） */
export function hasBlockingIssue(warnings: readonly LayoutWarning[]): boolean {
  return warnings.some((w) => w.severity === 'blocking')
}

/** 按页分组，页内保持 sortWarnings 的顺序 */
export function groupWarningsByPage(
  warnings: readonly LayoutWarning[],
): Array<{ pageIndex: number; warnings: LayoutWarning[] }> {
  const sorted = sortWarnings(warnings)
  const groups: Array<{ pageIndex: number; warnings: LayoutWarning[] }> = []
  for (const w of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.pageIndex === w.pageIndex) last.warnings.push(w)
    else groups.push({ pageIndex: w.pageIndex, warnings: [w] })
  }
  return groups
}

/**
 * 结果指纹：对 boxes 与 pages 做确定性哈希，用于快照回归。
 * 刻意**不含 warnings**——文案会改，几何不该跟着变。
 */
export function geometryFingerprint(result: Pick<LayoutResult, 'boxes' | 'pages'>): string {
  const parts: string[] = []
  for (const p of result.pages) {
    parts.push(`P${p.pageIndex}:${p.width}x${p.height}@${p.contentX},${p.contentY},${p.contentWidth},${p.contentHeight}`)
  }
  for (const b of result.boxes) {
    parts.push(
      `B${b.componentId}#${b.fragmentIndex}@${b.pageIndex}:${b.x},${b.y},${b.width},${b.height}`,
    )
  }
  const payload = parts.join(';')

  let hash = 2166136261
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
