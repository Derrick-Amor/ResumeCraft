/**
 * 组件注册表（TC-005）
 * 契约 §3「MVP-2 组件注册表」是本模块的定义方。
 *
 * 三条不变量：
 *  1. 组件类型**只在注册表登记一次**；UI 与布局不得对 type 写 switch 硬编码分支
 *  2. **语言轨差异在组件声明里表达**，不允许 UI 层散落 if (languageTrack === 'en')
 *  3. L1/L2 样式必须随文档序列化往返（见 src/model 的 serialize）
 *
 * 校验器零依赖（package.json 无 zod），沿用 TC-003 的 Result 方案。
 */

import type { LanguageTrack, ModelIssue, Result } from '../model/types'
import { fail, issue, ok, ISSUE_CODES } from '../model/types'

/** 字段类型。决定 UI 用哪个控件，不决定业务含义。 */
export type FieldKind = 'text' | 'textarea' | 'list' | 'date' | 'link'

export interface FieldSpec {
  key: string
  /** 字段显示名。语言轨不同显示名不同时，用 `labelByTrack` */
  label: string
  labelByTrack?: Partial<Record<LanguageTrack, string>>
  /** 该字段出现在哪些语言轨；不填 = 两条轨都有 */
  tracks?: readonly LanguageTrack[]
  required?: boolean
  kind: FieldKind
}

/** 样式档：L1 = 组件级，L2 = 段落级。必须随文档往返。 */
export interface StyleLevels {
  L1: Readonly<Record<string, string | number>>
  L2: Readonly<Record<string, string | number>>
}

export interface ComponentDefinition {
  /** 唯一类型标识，登记后不可更改 */
  type: string
  displayName: string
  fields: readonly FieldSpec[]
  /** 零依赖校验器。失败返回 Result，不抛 */
  validate: (fields: Record<string, unknown>, track: LanguageTrack) => Result<Record<string, unknown>>
  /** 每次调用返回**全新对象**，避免多个组件共享同一份可变默认值 */
  defaults: () => Record<string, unknown>
  styles: StyleLevels
}

export interface ComponentRegistry {
  /** 登记。重复 type 抛错——这是编程错误，不是用户输入错误 */
  register: (definition: ComponentDefinition) => void
  get: (type: string) => ComponentDefinition | undefined
  list: () => readonly ComponentDefinition[]
  /** 按语言轨裁剪后的字段清单（不变量 2 的唯一入口） */
  fieldsFor: (type: string, track: LanguageTrack) => readonly FieldSpec[]
}

/** 取该语言轨下的字段清单。语言轨裁剪只发生在这里，UI 不做判断。 */
export function filterFieldsForTrack(
  fields: readonly FieldSpec[],
  track: LanguageTrack,
): FieldSpec[] {
  return fields.filter((f) => !f.tracks || f.tracks.includes(track))
}

/** 取该轨下字段的显示名 */
export function fieldLabel(field: FieldSpec, track: LanguageTrack): string {
  return field.labelByTrack?.[track] ?? field.label
}

/** 按该轨字段清单生成默认值副本 */
export function defaultFields(
  definition: ComponentDefinition,
  track: LanguageTrack,
): Record<string, unknown> {
  const raw = definition.defaults()
  const allowed = new Set(filterFieldsForTrack(definition.fields, track).map((f) => f.key))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (allowed.has(key)) out[key] = value
  }
  return out
}

export function createRegistry(): ComponentRegistry {
  const byType = new Map<string, ComponentDefinition>()
  const order: string[] = []

  return {
    register(definition) {
      if (byType.has(definition.type)) {
        // 程序性错误：同一 type 登记两次会让"只登记一次"这条不变量失效
        throw new Error(`组件类型重复登记：${definition.type}`)
      }
      byType.set(definition.type, definition)
      order.push(definition.type)
    },

    get(type) {
      return byType.get(type)
    },

    list() {
      return order.map((t) => byType.get(t)).filter((d): d is ComponentDefinition => d !== undefined)
    },

    fieldsFor(type, track) {
      const definition = byType.get(type)
      if (!definition) return []
      return filterFieldsForTrack(definition.fields, track)
    },
  }
}

/** 通用字段校验：非空、类型、必填。组件自己的语义校验在 definition.validate 里叠加。 */
export function validateFields(
  fields: readonly FieldSpec[],
  input: Record<string, unknown>,
  track: LanguageTrack,
): Result<Record<string, unknown>> {
  const errors: ModelIssue[] = []
  const result: Record<string, unknown> = {}

  for (const spec of fields) {
    const value = input[spec.key]

    if (value === undefined || value === null || value === '') {
      if (spec.required === true) {
        errors.push(issue(spec.key, ISSUE_CODES.missing, `${fieldLabel(spec, track)}不能为空`))
      }
      continue
    }

    if (spec.kind === 'list') {
      if (!Array.isArray(value)) {
        errors.push(issue(spec.key, ISSUE_CODES.wrongType, `${fieldLabel(spec, track)}必须是列表`))
        continue
      }
      result[spec.key] = value
      continue
    }

    if (spec.kind === 'date') {
      if (typeof value !== 'string') {
        errors.push(issue(spec.key, ISSUE_CODES.wrongType, `${fieldLabel(spec, track)}必须是日期字符串`))
        continue
      }
      result[spec.key] = value
      continue
    }

    if (typeof value !== 'string') {
      errors.push(issue(spec.key, ISSUE_CODES.wrongType, `${fieldLabel(spec, track)}必须是文本`))
      continue
    }

    if (spec.required === true && value.trim() === '') {
      errors.push(issue(spec.key, ISSUE_CODES.emptyString, `${fieldLabel(spec, track)}不能为空`))
      continue
    }

    result[spec.key] = value
  }

  if (errors.length > 0) return fail(errors)
  return ok(result)
}
