/**
 * TC-005：组件注册表回归测试
 * 对照：CONTRACT §3 三条不变量
 *   ① 组件类型只登记一次
 *   ② 语言轨差异在组件声明里表达（UI 不做 if languageTrack 判断）
 *   ③ L1/L2 样式随文档往返
 */

import { describe, expect, it } from 'vitest'

import {
  createRegistry,
  defaultFields,
  fieldLabel,
  filterFieldsForTrack,
  validateFields,
} from '../../src/components/registry'
import type { ComponentDefinition, FieldSpec } from '../../src/components/registry'

const NAME_FIELDS: FieldSpec[] = [
  { key: 'name', label: '姓名', required: true, kind: 'text' },
  { key: 'phone', label: '电话', kind: 'text' },
  {
    key: 'photo',
    label: '照片',
    tracks: ['zh'], // 英文简历不放照片
    kind: 'text',
  },
  {
    key: 'objective',
    label: '求职意向',
    labelByTrack: { en: 'Objective' },
    kind: 'text',
  },
]

function makeDef(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
  return {
    type: 'basics',
    displayName: '基本信息',
    fields: NAME_FIELDS,
    validate: (fields) => ({ ok: true, value: fields }),
    defaults: () => ({ name: '', phone: '', photo: '', objective: '' }),
    styles: {
      L1: { fontSize: 14, fontWeight: 500 },
      L2: { lineHeight: 1.55 },
    },
    ...overrides,
  }
}

describe('不变量 ①：只登记一次', () => {
  it('register / get / list 走通', () => {
    const registry = createRegistry()
    registry.register(makeDef())
    registry.register(makeDef({ type: 'education' }))

    expect(registry.get('basics')?.displayName).toBe('基本信息')
    expect(registry.list().map((d) => d.type)).toEqual(['basics', 'education'])
  })

  it('重复登记抛错（程序性错误，不是用户输入错误）', () => {
    const registry = createRegistry()
    registry.register(makeDef())
    expect(() => registry.register(makeDef())).toThrow('组件类型重复登记')
  })

  it('未登记的类型返回 undefined', () => {
    expect(createRegistry().get('nope')).toBeUndefined()
  })
})

describe('不变量 ②：语言轨差异写在声明里', () => {
  it('中文轨包含照片字段，英文轨裁掉', () => {
    const zh = filterFieldsForTrack(NAME_FIELDS, 'zh').map((f) => f.key)
    const en = filterFieldsForTrack(NAME_FIELDS, 'en').map((f) => f.key)
    expect(zh).toContain('photo')
    expect(en).not.toContain('photo')
  })

  it('未声明 tracks 的字段两条轨都有', () => {
    for (const track of ['zh', 'en'] as const) {
      const keys = filterFieldsForTrack(NAME_FIELDS, track).map((f) => f.key)
      expect(keys).toEqual(expect.arrayContaining(['name', 'phone', 'objective']))
    }
  })

  it('fieldsFor 是注册表对外的唯一裁剪入口', () => {
    const registry = createRegistry()
    registry.register(makeDef())
    expect(registry.fieldsFor('basics', 'en').map((f) => f.key)).not.toContain('photo')
    expect(registry.fieldsFor('nope', 'zh')).toEqual([])
  })

  it('显示名可按语言轨覆盖', () => {
    const objective = NAME_FIELDS.find((f) => f.key === 'objective')
    if (!objective) throw new Error('fixture 不完整')
    expect(fieldLabel(objective, 'zh')).toBe('求职意向')
    expect(fieldLabel(objective, 'en')).toBe('Objective')
  })

  it('defaultFields 只保留该轨下的键', () => {
    const def = makeDef()
    expect(Object.keys(defaultFields(def, 'en'))).not.toContain('photo')
    expect(Object.keys(defaultFields(def, 'zh'))).toContain('photo')
  })

  it('defaults 每次返回全新对象，不共享可变状态', () => {
    const def = makeDef()
    const a = def.defaults()
    const b = def.defaults()
    expect(a).not.toBe(b)
    a.name = '改了'
    expect(b.name).toBe('')
  })
})

describe('字段校验（零依赖 Result）', () => {
  it('必填缺失报错', () => {
    const r = validateFields(NAME_FIELDS, { phone: '138' }, 'zh')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.some((e) => e.path === 'name')).toBe(true)
    expect(r.errors[0]?.message).toContain('姓名')
  })

  it('多个问题一次收集完，不短路', () => {
    const fields: FieldSpec[] = [
      { key: 'a', label: 'A', required: true, kind: 'text' },
      { key: 'b', label: 'B', required: true, kind: 'text' },
    ]
    const r = validateFields(fields, {}, 'zh')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(2)
  })

  it('list 字段必须是数组', () => {
    const fields: FieldSpec[] = [{ key: 'tags', label: '标签', kind: 'list' }]
    const bad = validateFields(fields, { tags: '不是数组' }, 'zh')
    expect(bad.ok).toBe(false)
    const good = validateFields(fields, { tags: ['a', 'b'] }, 'zh')
    expect(good.ok).toBe(true)
  })

  it('成功时返回裁剪后的字段，不回传多余键', () => {
    const r = validateFields(NAME_FIELDS, { name: '张明', 垃圾: 1 }, 'zh')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ name: '张明' })
  })

  it('空串在必填字段上算缺失', () => {
    const r = validateFields(NAME_FIELDS, { name: '   ' }, 'zh')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]?.code).toBe('empty-string')
  })
})

describe('不变量 ③：L1/L2 样式存在', () => {
  it('定义里同时带 L1 与 L2', () => {
    const def = makeDef()
    expect(def.styles.L1).toBeDefined()
    expect(def.styles.L2).toBeDefined()
    expect(Object.keys(def.styles.L1).length).toBeGreaterThan(0)
    expect(Object.keys(def.styles.L2).length).toBeGreaterThan(0)
  })
})
