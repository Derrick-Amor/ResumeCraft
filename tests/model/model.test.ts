/**
 * TC-003 文档模型与序列化 + undo 栈 —— 契约回归测试
 * 对照：docs/contract/CONTRACT.md §2 的五条不变量 + undo 四条不变量。
 *
 * 约定：所有时间显式传入，不依赖真实时钟，保证可重复。
 */

import { describe, expect, it } from 'vitest'

import {
  MIGRATIONS,
  SUPPORTED_SCHEMA_VERSION,
  UndoStack,
  cloneDocument,
  createComponent,
  createDocument,
  deserialize,
  documentFingerprint,
  documentsEqual,
  formatIssues,
  isMigrateIdempotent,
  isValid,
  migrate,
  serialize,
  validate,
} from '../../src/model'
import type { AnyComponent, LanguageTrack, ResumeDocument, UnknownComponent } from '../../src/model'

const NOW = '2026-10-27T10:00:00.000Z'

interface DocOptions {
  title?: string
  languageTrack?: LanguageTrack
  components?: AnyComponent[]
}

function makeDoc(options: DocOptions = {}): ResumeDocument {
  return createDocument({
    documentId: 'doc_fixed',
    now: NOW,
    createdAt: NOW,
    title: options.title ?? '张明的简历',
    languageTrack: options.languageTrack ?? 'zh',
    components: options.components ?? [
      createComponent({
        id: 'cmp_1',
        type: 'basics',
        order: 0,
        fields: { name: '张明', email: 'zhangming.dev@example.com' },
      }),
      createComponent({
        id: 'cmp_2',
        type: 'education',
        order: 1,
        fields: { school: '华南理工大学', major: '软件工程' },
      }),
    ],
  })
}

/** 带未知组件 + 未知顶层字段的文档，用来验「一个字节都不能丢」 */
function makeDocWithUnknown(): ResumeDocument {
  const doc = makeDoc()
  doc.components.push({
    id: 'cmp_unknown',
    type: 'future-widget',
    order: 2,
    visible: true,
    unknown: true,
    originalType: 'future-widget',
    raw: {
      id: 'cmp_unknown',
      type: 'future-widget',
      order: 2,
      visible: true,
      unknown: true,
      originalType: 'future-widget',
      fields: { payload: { nested: [1, 2, 3] } },
      style: { accent: '#4b7168' },
    },
  })
  doc.extra = { vendorNote: '由 v9 生成', flags: { beta: true } }
  return doc
}

function isUnknown(component: AnyComponent): component is UnknownComponent {
  return 'unknown' in component && component.unknown === true
}

describe('§2 不变量 1：schemaVersion 与 documentId', () => {
  it('新建文档自带整数版本号与非空 documentId', () => {
    const doc = createDocument({ now: NOW })
    expect(doc.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION)
    expect(Number.isInteger(doc.schemaVersion)).toBe(true)
    expect(doc.documentId.length).toBeGreaterThan(0)
  })

  it('两次新建的 documentId 不重复', () => {
    const a = createDocument({ now: NOW })
    const b = createDocument({ now: NOW })
    expect(a.documentId).not.toBe(b.documentId)
  })

  it('缺 documentId 校验失败', () => {
    const result = validate({ ...makeDoc(), documentId: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.path === 'documentId')).toBe(true)
  })

  it('版本号高于支持值直接拒绝，并给出可读原因', () => {
    const result = validate({ ...makeDoc(), schemaVersion: SUPPORTED_SCHEMA_VERSION + 1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.code).toBe('unsupported-version')
    expect(result.errors[0]?.message).toContain('版本')
  })
})

describe('默认页边距与设计稿 1:1（Amor 2026-10-30 裁决，防回退）', () => {
  it('新建文档的四个页边距等于设计稿 .paper padding 的换算值', () => {
    // 设计稿真值：docs/design/mockups/figma/app.css:552 `.paper { padding: 54px 60px 44px; }`
    // 纸面宽 794px = A4 210mm（tokens.css --rc-paper-w），按 794:210 换算并保留 2 位小数：
    //   54px → 14.28mm（上）、60px → 15.87mm（左右）、44px → 11.64mm（下）。
    // 屏幕纸面 CSS padding 为 0（防二次偏移），页边距完全由 pageSettings 承担，
    // 所以这组默认值就是纸面页边距的唯一真值来源。谁把默认值改回 20mm，本测试立刻红。
    const doc = createDocument({ now: NOW })
    expect(doc.pageSettings.marginTopMm).toBe(14.28)
    expect(doc.pageSettings.marginRightMm).toBe(15.87)
    expect(doc.pageSettings.marginBottomMm).toBe(11.64)
    expect(doc.pageSettings.marginLeftMm).toBe(15.87)
  })
})

describe('§2 不变量 2：未知组件原样保留并标记 unknown', () => {
  it('validate 把 unknown:true 的组件转成 UnknownComponent，字段一个不丢', () => {
    const result = validate(makeDocWithUnknown())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const unknown = result.value.components.find(isUnknown)
    expect(unknown).toBeDefined()
    if (!unknown) return
    expect(unknown.originalType).toBe('future-widget')
    expect(unknown.raw.fields).toEqual({ payload: { nested: [1, 2, 3] } })
    expect(unknown.raw.style).toEqual({ accent: '#4b7168' })
  })

  it('未登记但未标 unknown 的 type 也不会被丢弃', () => {
    const doc = makeDoc()
    const result = validate({
      ...doc,
      components: [
        ...doc.components,
        { id: 'x1', type: 'not-registered', order: 9, visible: true, fields: {} },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.components).toHaveLength(3)
    expect(result.value.components[2]?.type).toBe('not-registered')
  })

  // 回归：首轮实现只认"扁平入参"，内存里的 UnknownComponent 过一遍 validate
  // 会把 raw 再包一层，导致 raw.fields 变成 undefined
  it('UnknownComponent 再过一次 validate 不会把 raw 再包一层', () => {
    const once = validate(makeDocWithUnknown())
    expect(once.ok).toBe(true)
    if (!once.ok) return

    const unknown = once.value.components.find(isUnknown)
    expect(unknown).toBeDefined()
    if (!unknown) return
    expect(unknown.raw.fields).toEqual({ payload: { nested: [1, 2, 3] } })
    expect(unknown.raw.raw).toBeUndefined()
  })

  // 回归：首轮实现没把 extra 列进已知顶层字段，validate 两遍会包成 { extra: {...} }
  it('validate 对自己的输出幂等（extra 不会被二次包裹）', () => {
    const once = validate(makeDocWithUnknown())
    expect(once.ok).toBe(true)
    if (!once.ok) return

    const twice = validate(once.value)
    expect(twice.ok).toBe(true)
    if (!twice.ok) return
    expect(twice.value).toEqual(once.value)
  })
})

describe('§2 不变量 3：未知字段保留不删', () => {
  it('未知顶层字段进 extra', () => {
    const result = validate(makeDocWithUnknown())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.extra).toEqual({ vendorNote: '由 v9 生成', flags: { beta: true } })
  })

  it('没有未知字段时不写入空 extra（否则往返会多一个空对象）', () => {
    const result = validate(makeDoc())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.extra).toBeUndefined()
  })
})

describe('§2 不变量 5：序列化往返深等', () => {
  it('中英文档各一份，往返完全一致', () => {
    for (const languageTrack of ['zh', 'en'] as const) {
      const doc = makeDoc({ languageTrack })
      const json = serialize(doc)
      const back = deserialize(json)
      expect(back.ok).toBe(true)
      if (!back.ok) return
      expect(back.value).toEqual(doc)
      expect(serialize(back.value)).toBe(json)
    }
  })

  it('带未知组件与未知字段的文档，往返也一致', () => {
    const doc = makeDocWithUnknown()
    const back = deserialize(serialize(doc))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.value).toEqual(doc)
  })

  it('组件 style 与 visible 一起往返', () => {
    const doc = makeDoc()
    const styled = createComponent({
      id: 'cmp_3',
      type: 'skills',
      order: 2,
      visible: false,
      fields: { list: 'TypeScript / Vue' },
      style: { fontSizePt: 10.5 },
    })
    doc.components.push(styled)

    const back = deserialize(serialize(doc))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.value.components[2]).toEqual(styled)
  })

  it('非法 JSON 返回错误对象而不是抛异常', () => {
    expect(() => deserialize('{ not json')).not.toThrow()
    const result = deserialize('{ not json')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.code).toBe('invalid-json')
  })

  it('指纹对内容敏感、对同一内容稳定', () => {
    const a = makeDoc()
    const b = makeDoc()
    const c = makeDoc({ title: '另一份' })
    expect(documentFingerprint(a)).toBe(documentFingerprint(b))
    expect(documentFingerprint(a)).not.toBe(documentFingerprint(c))
  })
})

describe('validate：一次性收集全部问题', () => {
  it('多个字段同时错，报错条数 > 3，且不抛异常', () => {
    const result = validate({
      schemaVersion: 'x',
      documentId: 1,
      languageTrack: 'fr',
      components: {},
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.length).toBeGreaterThan(3)
    expect(formatIssues(result.errors)).toContain('languageTrack')
  })

  it('重复组件 id 被拦下', () => {
    const doc = makeDoc()
    const first = doc.components[0]
    const second = doc.components[1]
    if (!first || !second) throw new Error('fixture 不完整')

    const result = validate({
      ...doc,
      components: [first, { ...second, id: first.id }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.code === 'duplicate-id')).toBe(true)
  })

  it('页面尺寸为 0 被拒', () => {
    const doc = makeDoc()
    const result = validate({ ...doc, pageSettings: { ...doc.pageSettings, widthMm: 0 } })
    expect(result.ok).toBe(false)
  })

  it('isValid 是 validate 的布尔壳', () => {
    expect(isValid(makeDoc())).toBe(true)
    expect(isValid(null)).toBe(false)
    expect(isValid('x')).toBe(false)
  })
})

describe('migrate：幂等 + 迁移前留副本', () => {
  it('已是最新版本时原样返回，migrated=false', () => {
    const doc = makeDoc()
    const result = migrate(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.migrated).toBe(false)
    expect(result.value.document).toBe(doc)
    expect(result.value.backup).toBeNull()
  })

  it('幂等自检通过', () => {
    expect(isMigrateIdempotent(makeDoc())).toBe(true)
  })

  it('当前没有历史版本，迁移表为空', () => {
    expect(Object.keys(MIGRATIONS)).toHaveLength(0)
  })

  it('未来版本拒绝打开', () => {
    const result = migrate({ ...makeDoc(), schemaVersion: SUPPORTED_SCHEMA_VERSION + 1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.code).toBe('unsupported-version')
  })
})

describe('undo 栈：命令式接口 + 四条不变量', () => {
  it('push / undo / redo 走通', () => {
    const initial = makeDoc()
    const stack = new UndoStack(initial)
    const next = makeDoc({ title: '改过的标题' })

    expect(stack.canUndo()).toBe(false)
    stack.push(next, { label: '改标题', now: 1000 })
    expect(stack.canUndo()).toBe(true)
    expect(stack.current.meta.title).toBe('改过的标题')

    const undone = stack.undo()
    expect(undone?.meta.title).toBe('张明的简历')
    expect(stack.canRedo()).toBe(true)

    const redone = stack.redo()
    expect(redone?.meta.title).toBe('改过的标题')
  })

  it('空操作不入栈（避免冲掉 redo 链）', () => {
    const doc = makeDoc()
    const stack = new UndoStack(doc)
    stack.push(cloneDocument(doc), { label: '无变化', now: 1000 })
    expect(stack.depth).toBe(0)
    expect(stack.canUndo()).toBe(false)
  })

  it('同 mergeKey 且在时间窗内合并成一步', () => {
    const stack = new UndoStack(makeDoc(), { mergeWindowMs: 800 })
    stack.push(makeDoc({ title: '张' }), { label: '输入', mergeKey: 'title', now: 1000 })
    stack.push(makeDoc({ title: '张明' }), { label: '输入', mergeKey: 'title', now: 1400 })

    expect(stack.depth).toBe(1)
    expect(stack.current.meta.title).toBe('张明')

    const undone = stack.undo()
    expect(undone?.meta.title).toBe('张明的简历')
  })

  it('超出时间窗不合并', () => {
    const stack = new UndoStack(makeDoc(), { mergeWindowMs: 800 })
    stack.push(makeDoc({ title: '张' }), { label: '输入', mergeKey: 'title', now: 1000 })
    stack.push(makeDoc({ title: '张明' }), { label: '输入', mergeKey: 'title', now: 2000 })
    expect(stack.depth).toBe(2)
  })

  it('不同 mergeKey 不合并', () => {
    const stack = new UndoStack(makeDoc(), { mergeWindowMs: 800 })
    stack.push(makeDoc({ title: '张' }), { label: '输入', mergeKey: 'title', now: 1000 })
    stack.push(makeDoc({ title: '张', languageTrack: 'en' }), {
      label: '切换语言轨',
      mergeKey: 'track',
      now: 1100,
    })
    expect(stack.depth).toBe(2)
  })

  it('栈有上限，超限丢最早', () => {
    const stack = new UndoStack(makeDoc(), { maxDepth: 2 })
    stack.push(makeDoc({ title: 'a' }), { label: '1', now: 1000 })
    stack.push(makeDoc({ title: 'b' }), { label: '2', now: 2000 })
    stack.push(makeDoc({ title: 'c' }), { label: '3', now: 3000 })

    expect(stack.depth).toBe(2)
    expect(stack.current.meta.title).toBe('c')

    stack.undo()
    expect(stack.current.meta.title).toBe('b')
    stack.undo()
    expect(stack.current.meta.title).toBe('a')
    expect(stack.canUndo()).toBe(false)
  })

  it('撤销后产生新编辑，redo 尾部被丢弃', () => {
    const stack = new UndoStack(makeDoc())
    stack.push(makeDoc({ title: 'a' }), { label: '1', now: 1000 })
    stack.push(makeDoc({ title: 'b' }), { label: '2', now: 2000 })
    stack.undo()
    expect(stack.canRedo()).toBe(true)

    stack.push(makeDoc({ title: 'c' }), { label: '3', now: 3000 })
    expect(stack.canRedo()).toBe(false)
    expect(stack.current.meta.title).toBe('c')
  })

  it('clear 清空历史（MVP：保存/重开即清空）', () => {
    const stack = new UndoStack(makeDoc())
    stack.push(makeDoc({ title: 'a' }), { label: '1', now: 1000 })
    stack.clear()
    expect(stack.canUndo()).toBe(false)
    expect(stack.canRedo()).toBe(false)
    expect(stack.depth).toBe(0)
  })

  it('peekUndoLabel 给出可读动作名', () => {
    const stack = new UndoStack(makeDoc())
    expect(stack.peekUndoLabel()).toBeNull()
    stack.push(makeDoc({ title: 'a' }), { label: '修改项目名称', now: 1000 })
    expect(stack.peekUndoLabel()).toBe('修改项目名称')
  })

  it('documentsEqual 对等价文档返回 true', () => {
    expect(documentsEqual(makeDoc(), makeDoc())).toBe(true)
    expect(documentsEqual(makeDoc(), makeDoc({ title: 'x' }))).toBe(false)
  })
})
