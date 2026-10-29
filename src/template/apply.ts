/**
 * 模板应用（TC-009 / FR-TPL-003）
 * `applyTemplate(doc, templateId) → { doc, mappingReport, undoToken }`
 *
 * 不变量（契约 §9）：
 *  1. 已识别字段切换模板后零丢失
 *  2. 无法映射的内容进 pending
 *  3. 操作可撤销（返回 undoToken）
 */

import { createDocument } from '../model/factory'
import { cloneDocument } from '../model/serialize'
import type { ResumeDocument, AnyComponent, ResumeComponent } from '../model/types'
import type { ApplyTemplateResult, ComponentStyle, MappingReport, TemplateDefinition } from './schema'
import { getTemplate } from './registry'

/**
 * 模板槽位别名 → 组件注册表真实类型。
 *
 * 为什么需要归一：`builtin.ts` 的 `componentOrder` 写的是版面槽位名
 * （work / project / custom），而组件注册表登记的类型是
 * experience / projects / awards。两张表各有各的道理：模板描述的是"版面上这一格放什么"，
 * 注册表描述的是"这类内容的数据结构"。缺了归一，`applyTemplate` 会把工作经历判成
 * 「不在模板推荐顺序中」，既排到末尾又白给一条警告。
 *
 * 为什么不改 `builtin.ts`：模板自身的键序被 `tests/template/template.test.ts` 断言，
 * 改模板等于动别人的契约。归一放在使用侧，两张表各留各的名字。
 *
 * 幂等：真实类型（experience / projects / awards）不在别名表里，过一遍原样返回。
 */
const SLOT_ALIASES: Record<string, string> = {
  work: 'experience',
  project: 'projects',
  custom: 'awards',
}

/** 槽位名 → 组件真实类型。未登记的名字原样返回。 */
function canonicalType(slot: string): string {
  return SLOT_ALIASES[slot] ?? slot
}

/** 未知组件没有 style 字段，样式只对已知组件生效 */
function isKnownComponent(component: AnyComponent): component is ResumeComponent {
  return !('unknown' in component)
}

/** 正数才生效：0 / 负数 / NaN / 类型不对都算"没声明"，不覆盖已有值 */
function positiveOr(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * 把模板的 styles 落到每个组件的 `component.style`。
 *
 * 为什么键要过 canonicalType：`styles` 与 `componentOrder` 用同一套**槽位名**
 * （basics / education / work / project / skills / custom），组件注册表登记的却是
 * 真实类型（experience / projects / awards）。不归一就永远取不到样式 ——
 * 与"排序误判"是同一个坑的两面（见 SLOT_ALIASES 的说明）。
 *
 * 只搬五种键：fontSizePt / lineHeight / bold / spacingBeforeMm / spacingAfterMm。
 * `color` 不搬：它是 HEX 字面量，目前没有任何消费方（text-runs 不读颜色），
 * 搬进文档数据只会让"组件 style 里冒出 tokens.css 之外的色值"变成查不动的问题。
 *
 * 覆盖语义：模板只声明了的键才写，未声明的键保持原样，不写 undefined。
 */
function applyComponentStyles(
  template: TemplateDefinition,
  components: readonly AnyComponent[],
): void {
  const styleByType = new Map<string, ComponentStyle>()
  for (const [slot, style] of Object.entries(template.styles)) {
    styleByType.set(canonicalType(slot), style)
  }

  for (const component of components) {
    if (!isKnownComponent(component)) continue
    const style = styleByType.get(component.type)
    if (style === undefined) continue

    const overrides: Record<string, unknown> = {}
    const size = positiveOr(style.fontSizePt)
    if (size !== null) overrides.fontSizePt = size
    const lineHeight = positiveOr(style.lineHeight)
    if (lineHeight !== null) overrides.lineHeight = lineHeight
    const before = positiveOr(style.spacingBeforeMm)
    if (before !== null) overrides.spacingBeforeMm = before
    const after = positiveOr(style.spacingAfterMm)
    if (after !== null) overrides.spacingAfterMm = after
    if (typeof style.bold === 'boolean') overrides.bold = style.bold

    if (Object.keys(overrides).length > 0) {
      component.style = { ...(component.style ?? {}), ...overrides }
    }
  }
}

let tokenCounter = 0

function nextUndoToken(): string {
  tokenCounter += 1
  return `tpl-${Date.now()}-${tokenCounter}`
}

/**
 * 应用模板到文档。
 * @param doc 当前文档
 * @param templateId 模板 ID
 */
export function applyTemplate(doc: ResumeDocument, templateId: string): ApplyTemplateResult {
  const template = getTemplate(templateId)
  if (!template) {
    throw new Error(`模板「${templateId}」不存在`)
  }

  // 先克隆入参：下面的重排会原地写 component.order，直接改入参等于把调用方的
  // undo 快照一起改了（撤销会撤不回去）。克隆后本函数对入参零副作用。
  const source = cloneDocument(doc)

  const mappingReport: MappingReport = {
    preserved: [],
    pending: [],
    warnings: [],
  }

  // 复制现有组件，按模板 componentOrder 重排。
  // 两边都过一遍 canonicalType：模板给的是槽位名，组件给的是注册表类型，先对齐再比。
  const knownTypes = new Set(template.componentOrder.map(canonicalType))
  const preservedComponents: AnyComponent[] = []
  const pendingComponents: AnyComponent[] = []

  for (const component of source.components) {
    if (knownTypes.has(canonicalType(component.type))) {
      // 已识别：保留全部内容，重设样式
      preservedComponents.push(component)
      mappingReport.preserved.push(component.id)
    } else if ('unknown' in component && component.unknown) {
      // 未知组件：进待处理列表（不丢字节）
      pendingComponents.push(component)
      mappingReport.pending.push(component.id)
    } else {
      // 已知类型但不在模板 order 里：仍保留，排在末尾
      preservedComponents.push(component)
      mappingReport.warnings.push(`组件「${component.id}」类型「${component.type}」不在模板推荐顺序中，排在末尾`)
    }
  }

  // 按模板 componentOrder 重排（orderMap 的键同样是归一后的真实类型）
  const orderMap = new Map(template.componentOrder.map((slot, i) => [canonicalType(slot), i]))
  preservedComponents.sort((a, b) => {
    const ia = orderMap.get(canonicalType(a.type)) ?? 999
    const ib = orderMap.get(canonicalType(b.type)) ?? 999
    return ia - ib
  })

  // 合并 preserved + pending（pending 在最后）
  const finalComponents = [...preservedComponents, ...pendingComponents]

  // 模板样式落到组件：与重排同一次 commit，撤销一步回到应用前（契约 §9 不变量 3）
  applyComponentStyles(template, finalComponents)

  // 重新编号 order
  finalComponents.forEach((c, i) => {
    c.order = i
  })

  // 构建新文档（保留 documentId、schemaVersion、languageTrack）
  const newDoc = createDocument({
    documentId: doc.documentId,
    now: new Date().toISOString(),
    createdAt: doc.meta.createdAt,
    title: doc.meta.title,
    languageTrack: template.languageTrack,
    components: finalComponents,
  })

  // 应用页面设置
  newDoc.pageSettings = { ...template.pageSettings }

  // 应用标题（保留原标题）
  newDoc.meta.title = doc.meta.title

  return {
    doc: newDoc,
    mappingReport,
    undoToken: nextUndoToken(),
  }
}
