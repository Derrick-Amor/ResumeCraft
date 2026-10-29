// @vitest-environment jsdom
/**
 * 工作台（05 空状态 / 首次引导）回归测试
 *
 * 验收（docs/plan/PRODUCT-MATRIX.md §1 的 05 格）：
 *  1. DOM 结构照 05-empty.html：`.rail` / `.entrygrid` + `.entrycard ×3` / `.progress3`
 *  2. 三条进入编辑器的路径真的生效（新建空白必须新建出文档并切屏）
 *  3. 屏幕态是 UI 态，不进文档模型（契约 §10.4）
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '../../src/state/editor-store'
import ImportWizard from '../../src/ui/import-wizard/ImportWizard.vue'
import Workbench from '../../src/ui/workbench/Workbench.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('工作台 DOM（照 05-empty.html）', () => {
  it('三张入口卡齐备，文案与设计稿一致', () => {
    const wrapper = mount(Workbench)
    const cards = wrapper.findAll('.entrycard')
    expect(cards).toHaveLength(3)

    const titles = wrapper.findAll('.entrycard__title').map((el) => el.text())
    expect(titles).toEqual(['从模板开始', '导入已有简历', '空白画板'])

    // 第一张是推荐卡（entrycard--on + badge--accent）
    expect(cards[0]?.classes()).toContain('entrycard--on')
    expect(wrapper.find('.badge--accent').text()).toBe('推荐')
  })

  it('结构类名齐全：rail / entrygrid / progress3 / footnote / eyebrow', () => {
    const wrapper = mount(Workbench)
    for (const selector of [
      '.rail',
      '.rail__item',
      '.rail__item--on',
      '.rail__divider',
      '.rail__empty',
      '.sheet',
      '.sheet__inner',
      '.eyebrow',
      '.h1',
      '.entrygrid',
      '.entrycard__btn',
      '.progress3',
      '.progress3__head',
      '.progress3__item',
      '.footnote',
    ]) {
      expect(wrapper.find(selector).exists()).toBe(true)
    }
  })

  it('顶栏是工作台语义：我的工作台 / 不暴露导出', () => {
    const wrapper = mount(Workbench)
    expect(wrapper.find('.docmeta__name').text()).toBe('我的工作台')
    expect(wrapper.find('.docmeta__sub').text()).toBe('开始你的第一份简历')
    expect(wrapper.text()).not.toContain('导出前检查')
  })

  it('状态栏是空状态文案', () => {
    const wrapper = mount(Workbench)
    const bar = wrapper.find('.statusbar')
    expect(bar.text()).toContain('尚未创建文档')
    expect(bar.text()).toContain('PDF · Word 可编辑导出')
  })
})

describe('进入编辑器的三条路径', () => {
  it('点「新建空白简历」→ screen=editor 且文档组件数 ≥ 1', async () => {
    const wrapper = mount(Workbench)
    expect(store.screen).toBe('workbench')
    expect(store.components).toHaveLength(1) // 初始是空 basics

    await wrapper.find('[data-testid="rc-entry-blank"]').trigger('click')

    expect(store.screen).toBe('editor')
    expect(store.components.length).toBeGreaterThanOrEqual(1)
    expect(store.components.map((c) => c.type)).toEqual(['basics'])
  })

  it('选模板路径：跳到 02 模板库整屏（临时弹窗已删除）', async () => {
    const wrapper = mount(Workbench)

    await wrapper.find('[data-testid="rc-entry-template"]').trigger('click')

    expect(store.screen).toBe('templates')
    // 旧的临时选择弹窗不再存在，选模板这件事归 02 屏
    expect(wrapper.find('.scrim').exists()).toBe(false)
  })

  it('导入路径：点「选择文件」打开向导，向导确认后进编辑器', async () => {
    const wrapper = mount(Workbench)

    await wrapper.find('[data-testid="rc-entry-import"]').trigger('click')
    // 05 只负责打开向导；五步流程本身归 03 屏（那边还有 docpaper/rcard 缺口）
    expect(wrapper.find('.scrim').exists()).toBe(true)

    // 向导确认事件（03 屏补全 block→组件映射后，这里仍是同一个接线口）
    wrapper.findComponent(ImportWizard).vm.$emit('import', [], [])
    await nextTick()

    expect(store.screen).toBe('editor')
    expect(store.components.length).toBeGreaterThanOrEqual(1)
  })
})

describe('屏幕态是 UI 态', () => {
  it('切屏不改文档内容', () => {
    const before = store.components.length
    store.setScreen('editor')
    expect(store.screen).toBe('editor')
    expect(store.components.length).toBe(before)
    store.setScreen('workbench')
    expect(store.screen).toBe('workbench')
    expect(store.components.length).toBe(before)
  })

  it('屏幕态不进文档模型（serialize 里没有它）', async () => {
    const { serialize } = await import('../../src/model/serialize')
    store.setScreen('editor')
    const json = serialize(store.doc)
    expect(json).not.toContain('screen')
    expect(json).not.toContain('workbench')
  })
})
