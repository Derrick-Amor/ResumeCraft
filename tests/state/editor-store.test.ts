/**
 * 编辑器状态层回归测试（状态层）
 *
 * 覆盖：
 *  1. 每个动作都经 commit —— 撤销栈与派生 layout 必须同步跟上
 *  2. 撤销语义：连续输入合并、空操作不入栈、模板/新建为单步
 *  3. 派生状态：pageCount / qualityReport / warningSummary
 *  4. 持久化装配：node 环境降级为内存（不谎报持久化）
 */

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_ZOOM, useEditorStore } from '../../src/state/editor-store'
import { createEditorPersistence, hasIndexedDb } from '../../src/state/persistence'
import { suggestFileName } from '../../src/io/download'
import { RESUME_FONT_FAMILIES, ensureResumeFontsLoaded } from '../../src/layout/fonts-ready'

type Store = ReturnType<typeof useEditorStore>

function fieldsOf(store: Store, id: string): Record<string, unknown> {
  const component = store.doc.components.find((c) => c.id === id)
  if (component === undefined || !('fields' in component)) return {}
  return component.fields as Record<string, unknown>
}

/** 造一个必然多页的组件集：40 条长要点（每条都要折行，单页绝对装不下） */
function longBullets(): string[] {
  const line = '负责某子系统的设计、实现与线上稳定性，并推动跨团队协作落地。'
  return Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 条：${line}${line}${line}`)
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('初始状态', () => {
  it('新建即一个空 basics，1 页，无历史', () => {
    const store = useEditorStore()
    expect(store.components.map((c) => c.type)).toEqual(['basics'])
    expect(store.pageCount).toBeGreaterThanOrEqual(1)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.zoom).toBe(DEFAULT_ZOOM)
    expect(store.selectedId).toBeNull()
    expect(store.saveStatus).toBe('idle')
    expect(store.storageKind).toBe('unknown')
  })

  it('空文档的 qualityReport.blocking 为空数组', () => {
    const store = useEditorStore()
    expect(store.qualityReport.blocking).toEqual([])
    expect(store.warningSummary.total).toBe(0)
  })
})

describe('addComponent', () => {
  it('组件数 +1、order 连续、新组件被选中、可撤销', () => {
    const store = useEditorStore()
    const id = store.addComponent('education')
    expect(id).not.toBeNull()
    expect(store.components).toHaveLength(2)
    expect(store.components.map((c) => c.order)).toEqual([0, 1])
    expect(store.selectedId).toBe(id)
    expect(store.canUndo).toBe(true)

    store.undo()
    expect(store.components).toHaveLength(1)
    expect(store.components.map((c) => c.type)).toEqual(['basics'])
    expect(store.selectedId).toBeNull()
  })

  it('未登记的类型返回 null 且不入栈', () => {
    const store = useEditorStore()
    expect(store.addComponent('not-a-real-type')).toBeNull()
    expect(store.canUndo).toBe(false)
  })
})

describe('updateField', () => {
  it('同一字段连改两次只占一步撤销', () => {
    const store = useEditorStore()
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')

    store.updateField(id, 'school', '华南')
    store.updateField(id, 'school', '华南理工大学')

    expect(fieldsOf(store, id).school).toBe('华南理工大学')
    // 一步撤销回到添加后的空值：说明两次输入合并了
    store.undo()
    expect(fieldsOf(store, id).school).toBe('')
    expect(store.canUndo).toBe(true) // 还剩"添加组件"这一步
  })

  it('改成相同值不入栈', () => {
    const store = useEditorStore()
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')
    store.updateField(id, 'school', '华南理工')
    store.undo()
    store.updateField(id, 'school', '')
    // school 本来就是空串：空操作
    expect(store.canUndo).toBe(true) // 只有"添加组件"
  })

  it('不同字段各自一步', () => {
    const store = useEditorStore()
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')

    store.updateField(id, 'school', '华南理工')
    store.updateField(id, 'major', '计算机')

    store.undo()
    expect(fieldsOf(store, id).major).toBe('')
    expect(fieldsOf(store, id).school).toBe('华南理工')
  })

  it('列表字段按元素比较', () => {
    const store = useEditorStore()
    const id = store.addComponent('experience')
    if (id === null) throw new Error('experience 未注册')

    store.updateField(id, 'bullets', ['A', 'B'])
    store.undo()
    store.updateField(id, 'bullets', ['A', 'B'])
    store.updateField(id, 'bullets', ['A', 'B', 'C'])
    expect(fieldsOf(store, id).bullets).toEqual(['A', 'B', 'C'])
  })
})

describe('updateComponentStyle', () => {
  it('写入组件样式并合并连续改同一属性', () => {
    const store = useEditorStore()
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')

    store.updateComponentStyle(id, { fontSizePt: 11 })
    store.updateComponentStyle(id, { fontSizePt: 13 })

    const component = store.doc.components.find((c) => c.id === id)
    expect(component !== undefined && 'style' in component ? component.style : null).toEqual({
      fontSizePt: 13,
    })

    store.undo()
    expect(fieldsOf(store, id).school).toBe('')
    const restored = store.doc.components.find((c) => c.id === id)
    expect(
      restored !== undefined && 'style' in restored ? restored.style : undefined,
    ).toBeUndefined()
  })
})

describe('removeComponent', () => {
  it('删除后可撤销，且字段完整回来', () => {
    const store = useEditorStore()
    const id = store.addComponent('projects')
    if (id === null) throw new Error('projects 未注册')
    store.updateField(id, 'name', 'ResumeCraft')

    store.removeComponent(id)
    expect(store.components.map((c) => c.type)).toEqual(['basics'])

    store.undo() // 撤销删除
    expect(store.components).toHaveLength(2)
    expect(fieldsOf(store, id).name).toBe('ResumeCraft')
  })
})

describe('moveComponent', () => {
  it('上移下移后 order 连续且顺序变化', () => {
    const store = useEditorStore()
    const skills = store.addComponent('skills')
    const awards = store.addComponent('awards')
    if (skills === null || awards === null) throw new Error('组件未注册')

    expect(store.components.map((c) => c.type)).toEqual(['basics', 'skills', 'awards'])
    store.moveComponent(awards, -1)
    expect(store.components.map((c) => c.type)).toEqual(['basics', 'awards', 'skills'])
    expect(store.components.map((c) => c.order)).toEqual([0, 1, 2])

    store.undo()
    expect(store.components.map((c) => c.type)).toEqual(['basics', 'skills', 'awards'])
  })

  it('已经在头部时上移是空操作', () => {
    const store = useEditorStore()
    const first = store.components[0]
    if (first === undefined) throw new Error('初始文档应有 basics')
    store.moveComponent(first.id, -1)
    expect(store.canUndo).toBe(false)
  })
})

describe('toggleVisible', () => {
  it('隐藏后组件仍在文档里但不进 layout.boxes', () => {
    const store = useEditorStore()
    const id = store.addComponent('skills')
    if (id === null) throw new Error('skills 未注册')

    expect(store.layout.boxes.map((b) => b.componentId)).toContain(id)
    store.toggleVisible(id)
    expect(store.layout.boxes.map((b) => b.componentId)).not.toContain(id)
    expect(store.components).toHaveLength(2)
  })
})

describe('renameDoc', () => {
  it('连改两次只 1 步（mergeKey 生效），空标题被忽略', () => {
    const store = useEditorStore()
    store.renameDoc('  ')
    expect(store.canUndo).toBe(false)

    store.renameDoc('我的简历')
    store.renameDoc('我的简历 2026')
    expect(store.doc.meta.title).toBe('我的简历 2026')

    store.undo()
    expect(store.doc.meta.title).toBe('未命名简历')
    expect(store.canUndo).toBe(false)
  })
})

describe('setPageSettings', () => {
  it('改页边距改变页面几何，同值不同宽度是空操作', () => {
    const store = useEditorStore()
    store.setPageSettings({ marginTopMm: 30 })
    expect(store.layout.pages[0]?.contentY).toBe(30)
    // 下边距为默认值（设计稿换算 11.64mm，Amor 2026-10-30 的 1:1 裁决）
    expect(store.layout.pages[0]?.contentHeight).toBe(297 - 30 - 11.64)

    store.undo()
    expect(store.canUndo).toBe(false)
    store.setPageSettings({ marginTopMm: store.doc.pageSettings.marginTopMm })
    expect(store.canUndo).toBe(false)
  })
})

describe('applyTemplateById', () => {
  it('单步可撤销，preserved 非空，且没有"不在推荐顺序"的警告（槽位别名生效）', () => {
    const store = useEditorStore()
    store.addComponent('experience')
    // 先挪一下页边距，保证应用模板确实改变内容（否则是空操作）
    store.setPageSettings({ marginTopMm: 30 })
    const undoDepthBefore = store.canUndo

    const report = store.applyTemplateById('zh-general-001')
    expect(report).not.toBeNull()
    expect(report?.preserved.length).toBeGreaterThan(0)
    expect(report?.warnings).toEqual([])
    // 内置模板页边距 = 设计稿换算值 14.28mm（zh-general-001 的 A4 pageSettings 已同步）
    expect(store.doc.pageSettings.marginTopMm).toBe(14.28)
    expect(undoDepthBefore).toBe(true)

    store.undo()
    expect(store.doc.pageSettings.marginTopMm).toBe(30)
  })

  it('未注册模板返回 null 且不入栈', () => {
    const store = useEditorStore()
    const depth = store.canUndo
    expect(store.applyTemplateById('tpl-not-exist')).toBeNull()
    expect(store.canUndo).toBe(depth)
  })
})

describe('newDocument', () => {
  it('blank：清空撤销历史，只留一个 basics', () => {
    const store = useEditorStore()
    store.addComponent('skills')
    expect(store.canUndo).toBe(true)

    store.newDocument('blank')
    expect(store.components.map((c) => c.type)).toEqual(['basics'])
    expect(store.canUndo).toBe(false)
    expect(store.selectedId).toBeNull()
    expect(store.boardMode).toBe(false)
  })

  it('template：按模板造齐组件，languageTrack 跟随模板', () => {
    const store = useEditorStore()
    store.newDocument('template', 'en-classic-001')

    expect(store.doc.languageTrack).toBe('en')
    const types = store.components.map((c) => c.type)
    expect(types).toContain('basics')
    expect(types).toContain('experience')
    expect(types).toContain('education')
    expect(store.canUndo).toBe(false)
  })

  it('board：置 boardMode', () => {
    const store = useEditorStore()
    store.newDocument('board')
    expect(store.boardMode).toBe(true)
  })

  it('未注册模板时退回空白文档（不抛）', () => {
    const store = useEditorStore()
    store.newDocument('template', 'tpl-not-exist')
    expect(store.components.map((c) => c.type)).toEqual(['basics'])
  })
})

describe('派生状态', () => {
  it('pageCount 至少 1；塞满要点后大于 1', () => {
    const store = useEditorStore()
    expect(store.pageCount).toBeGreaterThanOrEqual(1)

    const id = store.addComponent('experience')
    if (id === null) throw new Error('experience 未注册')
    store.updateField(id, 'bullets', longBullets())
    expect(store.pageCount).toBeGreaterThan(1)
  })

  it('layout 是唯一坐标来源，字体/文档变化都会重算', () => {
    const store = useEditorStore()
    const before = store.layout.inputHash
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')
    store.updateField(id, 'school', '华南理工大学（更长更长的学校名字以触发折行）')
    expect(store.layout.inputHash).not.toBe(before)
    expect(store.layout.boxes.length).toBe(2)
  })
})

describe('持久化装配', () => {
  it('node 环境没有 indexedDB：kind 为 memory，且 boot 后如实回报', async () => {
    expect(hasIndexedDb()).toBe(false)
    const persistence = createEditorPersistence()
    expect(persistence.kind).toBe('memory')
    expect(await persistence.restoreLatest()).toBeNull()
    persistence.controller.dispose()
  })

  it('boot 之后 storageKind 是真实值，降级时 storageNotice 非空', async () => {
    const store = useEditorStore()
    await store.boot()

    expect(store.storageKind).toBe('memory')
    expect(store.storageNotice).not.toBeNull()
    // node 没有 FontFace：字体就绪结果必须是"不支持"，而不是假装 ready
    expect(store.fontReadiness?.supported).toBe(false)
    expect(store.fontReadiness?.failed).toEqual([...RESUME_FONT_FAMILIES])
  })

  it('flushSave 在未装配时不抛', async () => {
    const store = useEditorStore()
    await expect(store.flushSave()).resolves.toBeUndefined()
  })
})

describe('字体预热', () => {
  it('node 环境返回 supported=false，不静默宣称就绪', async () => {
    const readiness = await ensureResumeFontsLoaded()
    expect(readiness.supported).toBe(false)
    expect(readiness.ready).toBe(false)
    expect(readiness.failed.length).toBeGreaterThan(0)
  })
})

describe('下载文件名', () => {
  it('替换非法字符并补扩展名', () => {
    expect(suggestFileName('张明的简历', 'pdf')).toBe('张明的简历.pdf')
    expect(suggestFileName('a/b:c*d', 'docx')).toBe('a_b_c_d.docx')
    expect(suggestFileName('   ', 'pdf')).toBe('未命名简历.pdf')
    expect(suggestFileName('///', 'pdf')).toBe('未命名简历.pdf')
  })
})
