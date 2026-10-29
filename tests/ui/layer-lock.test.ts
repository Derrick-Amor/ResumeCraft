// @vitest-environment jsdom
/**
 * 06a 图层面板「图层锁定按钮」回归测试（Amor 2026-10-30 裁决）
 *
 * 锁定是**纯 UI 态**（契约 §10.4：不进文档模型、不进 undo 栈），
 * 按 06b 模式补渲染：按钮照 06a-layers.html 设计稿做，
 * 功能性含义是防误操作（禁拖拽、禁上下移）。
 * 设计稿原话：「背景默认锁定，避免误选」。
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { serialize } from '../../src/model/serialize'
import { useEditorStore } from '../../src/state/editor-store'
import { ICON_PATHS } from '../../src/ui/controls/icons'
import LayerPanel from '../../src/ui/layers/LayerPanel.vue'
import { BACKGROUND_LAYER_ID } from '../../src/ui/layers/layer-ids'

type Store = ReturnType<typeof useEditorStore>

/** 设计稿 docs/design/mockups/figma/icons.js:31 的 lock 原文（逐值钉死，防将来被改） */
const DESIGN_LOCK_PATH =
  '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'

/**
 * jsdom 会把 <rect/> 序列化成 <rect></rect>，所以不断言整串 markup，
 * 按**属性片段**断言（序列化前后逐值不变）：
 *  - 锁体 rect：lock / unlock 两种图标共有
 *  - 锁扣 path：lock 是闭合环（...a5 5 0 0 1 10 0v4），unlock 是开口（...a5 5 0 0 1 9.9-1）
 */
const LOCK_BODY = 'x="3" y="11" width="18" height="11" rx="2"'
const LOCK_SHACKLE = 'd="M7 11V7a5 5 0 0 1 10 0v4"'
const UNLOCK_SHACKLE = 'd="M7 11V7a5 5 0 0 1 9.9-1"'

let store: Store

/** blank 文档自带 1 个组件，再加两个 → 共 3 行，中间行用于验证上移/下移 */
function mountPanel() {
  store.newDocument('blank')
  store.addComponent('skills')
  store.addComponent('awards')
  return mount(LayerPanel, {
    props: { components: store.components, selectedId: null },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('06a 图层锁定按钮', () => {
  it('渲染 1:1：内容行有锁定按钮（未锁定无 iconbtn--lock、图标 unlock）；背景行带 iconbtn--lock 且 disabled', () => {
    const wrapper = mountPanel()
    const first = store.components[0]
    expect(first).toBeDefined()
    if (first === undefined) return

    const lockBtn = wrapper.find(`[data-testid="rc-layer-lock-${first.id}"]`)
    expect(lockBtn.exists()).toBe(true)
    expect(lockBtn.classes()).not.toContain('iconbtn--lock')
    expect(lockBtn.attributes('title')).toBe('锁定')
    const unlockedSvg = lockBtn.find('svg').html()
    expect(unlockedSvg).toContain(LOCK_BODY)
    expect(unlockedSvg).toContain(UNLOCK_SHACKLE)
    expect(unlockedSvg).not.toContain(LOCK_SHACKLE)

    // 背景行：06a 设计稿 :155 的锁定态呈现（iconbtn--lock + lock 图标 + disabled）
    const bgBtn = wrapper.find(`[data-testid="rc-layer-${BACKGROUND_LAYER_ID}"] .iconbtn--lock`)
    expect(bgBtn.exists()).toBe(true)
    expect(bgBtn.attributes('title')).toBe('背景层锁定')
    expect((bgBtn.element as HTMLButtonElement).disabled).toBe(true)
    expect(bgBtn.find('svg').html()).toContain(LOCK_SHACKLE)
  })

  it('图标真值：ICON_PATHS.lock 等于设计稿 icons.js:31 原文', () => {
    expect(ICON_PATHS.lock).toBe(DESIGN_LOCK_PATH)
    // 配套钉住 unlock（icons.js:32）：两种图标只差锁扣那一段路径
    expect(ICON_PATHS.unlock).toBe(
      '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    )
  })

  it('纯 UI 态：点锁定不改 doc、不动 undo、不触发任何 emit', async () => {
    const wrapper = mountPanel()
    const target = store.components[1]
    expect(target).toBeDefined()
    if (target === undefined) return

    const docBefore = serialize(store.doc)
    const canUndoBefore = store.canUndo

    await wrapper.find(`[data-testid="rc-layer-lock-${target.id}"]`).trigger('click')

    // 契约 §10.4：锁定不进文档模型、不进 undo 栈
    expect(serialize(store.doc)).toBe(docBefore)
    expect(store.canUndo).toBe(canUndoBefore)
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('toggleVisible')).toBeUndefined()
    expect(wrapper.emitted('move')).toBeUndefined()
    expect(wrapper.emitted('moveTo')).toBeUndefined()

    // 再点一次解锁，同样不落盘、不触发 emit
    await wrapper.find(`[data-testid="rc-layer-lock-${target.id}"]`).trigger('click')
    expect(serialize(store.doc)).toBe(docBefore)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('防误操作：锁定行 draggable=false、上移/下移 disabled；解锁后恢复', async () => {
    const wrapper = mountPanel()
    const target = store.components[1] // 中间行：解锁时上移/下移都可用
    expect(target).toBeDefined()
    if (target === undefined) return

    const row = wrapper.find(`[data-testid="rc-layer-${target.id}"]`)
    const up = row.find('[title="上移"]')
    const down = row.find('[title="下移"]')

    // 未锁定：可拖拽，上移/下移都可用
    expect(row.attributes('draggable')).toBe('true')
    expect((up.element as HTMLButtonElement).disabled).toBe(false)
    expect((down.element as HTMLButtonElement).disabled).toBe(false)

    await wrapper.find(`[data-testid="rc-layer-lock-${target.id}"]`).trigger('click')

    // 锁定：禁拖拽、禁上下移
    expect(row.attributes('draggable')).toBe('false')
    expect((up.element as HTMLButtonElement).disabled).toBe(true)
    expect((down.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find(`[data-testid="rc-layer-lock-${target.id}"]`).trigger('click')

    // 解锁：恢复
    expect(row.attributes('draggable')).toBe('true')
    expect((up.element as HTMLButtonElement).disabled).toBe(false)
    expect((down.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('不落盘：序列化结果不含任何 lock 字段（契约 §10.4）', async () => {
    const wrapper = mountPanel()
    const target = store.components[0]
    expect(target).toBeDefined()
    if (target === undefined) return

    await wrapper.find(`[data-testid="rc-layer-lock-${target.id}"]`).trigger('click')

    const json = JSON.stringify(serialize(store.doc))
    expect(json).not.toContain('"lock')
    expect(json).not.toContain('"locked')
    expect(json.toLowerCase()).not.toContain('lock')
  })
})
