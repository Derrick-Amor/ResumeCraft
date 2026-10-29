// @vitest-environment jsdom
/**
 * 06b 背景层属性 + 08 角标浮层 回归测试
 *
 * 06b：图层树选中「背景层」→ 右栏 `.bg-locked` + `.bg-empty`；不选中时是页面设置；
 *      锁定是 **UI 态**（点了不改 doc、不进 undo 栈）。
 * 08：`.paper-flag` 点击 → `.popover` 逐条清单；「逐项处理溢出」→ 打开 07 弹窗。
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '../../src/state/editor-store'
import CanvasView from '../../src/ui/canvas/CanvasView.vue'
import { BACKGROUND_LAYER_ID } from '../../src/ui/layers/layer-ids'
import PropertyPanel from '../../src/ui/panels/PropertyPanel.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

/** 单组件高过整页 → 必然产出 overflow-page（07/08 的数据源） */
function makeOverflowDoc(): void {
  store.newDocument('blank')
  const basics = store.components[0]
  if (basics !== undefined) store.removeComponent(basics.id)
  store.setPageSettings({
    heightMm: 60,
    marginTopMm: 20,
    marginRightMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 20,
  })
  const id = store.addComponent('education')
  if (id === null) throw new Error('education 未注册')
  store.updateField(id, 'school', '华南理工大学')
  store.updateField(
    id,
    'courses',
    Array.from({ length: 12 }, (_, i) => `课程 ${i + 1}`),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('06b 背景层属性', () => {
  it('选中背景层 → 右栏出现 .bg-locked 与 .bg-empty，标题是「背景层」', () => {
    store.selectComponent(BACKGROUND_LAYER_ID)
    const panel = mount(PropertyPanel)

    expect(panel.find('[data-testid="rc-bg-locked"]').exists()).toBe(true)
    expect(panel.find('[data-testid="rc-bg-empty"]').exists()).toBe(true)
    expect(panel.find('.bg-locked__head').text()).toContain('背景已锁定')
    expect(panel.find('.bg-locked__desc').text()).toBe('解锁后可修改背景。选择图层框不会自动解锁。')
    expect(panel.find('.inspector__title').text()).toBe('背景层')
  })

  it('不选中背景层时是页面设置', () => {
    store.selectComponent(null)
    const panel = mount(PropertyPanel)

    expect(panel.find('.bg-locked').exists()).toBe(false)
    expect(panel.find('.bg-empty').exists()).toBe(false)
    expect(panel.find('.inspector__title').text()).toBe('页面设置')
  })

  it('锁/解锁是纯 UI 态：不改文档、不进 undo 栈', async () => {
    store.selectComponent(BACKGROUND_LAYER_ID)
    const panel = mount(PropertyPanel)

    const docBefore = JSON.stringify(store.doc)
    const canUndoBefore = store.canUndo

    await panel.find('[data-testid="rc-bg-toggle-lock"]').trigger('click')
    expect(panel.find('.bg-locked__head').text()).toContain('背景已解锁')

    // 契约 §10.4：锁定不进文档模型
    expect(JSON.stringify(store.doc)).toBe(docBefore)
    expect(store.canUndo).toBe(canUndoBefore)
  })

  it('图层树的背景行可以选中（不再是禁用按钮）', async () => {
    const LayerPanel = (await import('../../src/ui/layers/LayerPanel.vue')).default
    const wrapper = mount(LayerPanel, {
      props: { components: store.components, selectedId: null },
    })

    await wrapper.find(`[data-testid="rc-layer-${BACKGROUND_LAYER_ID}"] .layerrow__main`).trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([BACKGROUND_LAYER_ID])
  })
})

describe('08 角标浮层', () => {
  it('点击 .paper-flag 弹出 .popover，逐条列出页码/名称/原因', async () => {
    makeOverflowDoc()
    const canvas = mount(CanvasView)

    await canvas.find('[data-testid="rc-paper-flag-0"]').trigger('click')
    const popover = canvas.find('[data-testid="rc-overflow-popover"]')
    expect(popover.exists()).toBe(true)

    expect(popover.find('.popover__head').text()).toContain('处内容溢出')
    const items = popover.findAll('.popover__item')
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.find('.popover__page').text()).toBe('第 1 页')
    expect(items[0]?.find('.popover__name').text()).toBe('教育经历')
    expect(items[0]?.find('.popover__desc').text()).toContain('超出页面')
  })

  it('有 overLines 时才显示「超出 N 行」徽标，N = 被裁行数', async () => {
    makeOverflowDoc()
    const warning = store.layout.warnings.find((w) => w.type === 'overflow-page')
    const count = warning?.overLines?.length ?? 0
    expect(count).toBeGreaterThan(0)

    const canvas = mount(CanvasView)
    await canvas.find('[data-testid="rc-paper-flag-0"]').trigger('click')

    const badge = canvas.find('.popover__item .badge--danger')
    expect(badge.text()).toBe(`超出 ${count} 行`)
  })

  it('「逐项处理溢出」发出 openOverflow 并关闭浮层', async () => {
    makeOverflowDoc()
    const canvas = mount(CanvasView)

    await canvas.find('[data-testid="rc-paper-flag-0"]').trigger('click')
    await canvas.find('[data-testid="rc-overflow-handle"]').trigger('click')

    expect(canvas.emitted('openOverflow')).toHaveLength(1)
    expect(canvas.find('[data-testid="rc-overflow-popover"]').exists()).toBe(false)
  })

  it('「定位」选中对应组件；无溢出时不渲染浮层', async () => {
    makeOverflowDoc()
    const warnedId = store.layout.warnings.find((w) => w.type === 'overflow-page')?.componentId
    const canvas = mount(CanvasView)

    await canvas.find('[data-testid="rc-paper-flag-0"]').trigger('click')
    await canvas.find('.popover__loc').trigger('click')
    expect(store.selectedId).toBe(warnedId)

    // 无溢出的文档：没有角标也没有浮层
    store.newDocument('blank')
    const clean = mount(CanvasView)
    expect(clean.find('.paper-flag').exists()).toBe(false)
    expect(clean.find('.popover').exists()).toBe(false)
  })
})
