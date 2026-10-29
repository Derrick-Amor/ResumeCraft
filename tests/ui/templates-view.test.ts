// @vitest-environment jsdom
/**
 * 模板库整屏（02）回归测试
 *
 * 验收（PRODUCT-MATRIX §1 的 02 格）：
 *  1. 四张卡渲染，当前模板带 `.tplcard--on` + 「当前模板」badge
 *  2. 搜索过滤后卡数变化
 *  3. 两段式：点卡只选中（不应用）→ 底部显示所选 → 「使用此模板」才应用并进编辑器
 *  4. 未选中时「使用此模板」aria-disabled
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '../../src/state/editor-store'
import TemplatesView from '../../src/ui/templates/TemplatesView.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('模板库 DOM（照 02-templates.html）', () => {
  it('四张模板卡渲染，当前模板带 tplcard--on 与「当前模板」badge', () => {
    store.newDocument('template', 'zh-student-001')
    const wrapper = mount(TemplatesView)

    const cards = wrapper.findAll('.tplcard')
    expect(cards).toHaveLength(4)

    const current = wrapper.find('[data-testid="rc-tplcard-zh-student-001"]')
    expect(current.classes()).toContain('tplcard--on')
    expect(current.find('.badge--accent').text()).toBe('当前模板')
  })

  it('结构类名齐全：sheet__head / filters / searchbox / filterbtn / tpl-grid / mini / actionbar', () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)
    for (const selector of [
      '.sheet__head',
      '.filters',
      '.searchbox',
      '.filterbtn',
      '.filterbtn__v',
      '.filters__count',
      '.tpl-grid',
      '.tplcard__stage',
      '.mini',
      '.mini__sec',
      '.mini__cols',
      '.mini--latin',
      '.actionbar',
      '.actionbar__sel',
      '.actionbar__actions',
    ]) {
      expect(wrapper.find(selector).exists()).toBe(true)
    }
  })

  it('缩略图是纯 DOM 纹理：四张卡各有 mini，含单栏与双栏形态', () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)
    expect(wrapper.findAll('.mini')).toHaveLength(4)
    expect(wrapper.findAll('.mini__cols')).toHaveLength(1) // 秩序·专业 双栏
    expect(wrapper.findAll('.mini--latin')).toHaveLength(1) // 留白·双语 拉丁文形态
  })
})

describe('搜索与筛选', () => {
  it('按名称模糊过滤后卡数与计数同步变化', async () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)
    expect(wrapper.findAll('.tplcard')).toHaveLength(4)
    expect(wrapper.find('[data-testid="rc-tpl-count"]').text()).toBe('4 套原创模板')

    await wrapper.find('[data-testid="rc-tpl-search"]').setValue('双语')
    expect(wrapper.findAll('.tplcard')).toHaveLength(1)
    expect(wrapper.find('[data-testid="rc-tpl-count"]').text()).toBe('1 套原创模板')

    await wrapper.find('[data-testid="rc-tpl-search"]').setValue('')
    expect(wrapper.findAll('.tplcard')).toHaveLength(4)
  })

  it('筛选按钮弹出选项，选中后 filterbtn__v 更新并过滤', async () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)

    await wrapper.find('[data-testid="rc-filter-industry"]').trigger('click')
    const pop = wrapper.find('[data-testid="rc-filter-pop-industry"]')
    expect(pop.exists()).toBe(true)

    await pop.findAll('.checkitem')[2]?.trigger('click') // 「互联网」
    expect(wrapper.find('[data-testid="rc-filter-industry"] .filterbtn__v').text()).toBe('互联网')
    expect(wrapper.findAll('.tplcard')).toHaveLength(2) // 秩序·专业 + 精研·技术
  })
})

describe('两段式：选中 ≠ 应用', () => {
  it('点卡只选中，底部动作条显示所选名；确认后才应用并进编辑器', async () => {
    store.newDocument('template', 'zh-student-001')
    const wrapper = mount(TemplatesView)

    await wrapper.find('[data-testid="rc-tplcard-en-classic-001"]').trigger('click')

    // 只选中，还没应用（仍在模板库屏，没切走）
    expect(store.appliedTemplateId).toBe('zh-student-001')
    expect(wrapper.find('[data-testid="rc-templates"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rc-tpl-sel-name"]').text()).toBe('留白 · 双语')
    expect(wrapper.find('.tplcard--on').attributes('data-testid')).toBe('rc-tplcard-en-classic-001')

    await wrapper.find('[data-testid="rc-tpl-use"]').trigger('click')

    expect(store.screen).toBe('editor')
    expect(store.appliedTemplateId).toBe('en-classic-001')
    // 应用真的发生了：语言轨跟模板走
    expect(store.doc.languageTrack).toBe('en')
  })

  it('未选中时「使用此模板」aria-disabled', () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)

    const useBtn = wrapper.find('[data-testid="rc-tpl-use"]')
    expect(useBtn.attributes('aria-disabled')).toBe('true')
    expect(useBtn.attributes('title')).toBe('先选一种模板')
    expect(wrapper.find('[data-testid="rc-tpl-sel-name"]').text()).toBe('未选择模板')
  })

  it('「取消 / 返回编辑器」不应用模板，只回编辑器', async () => {
    store.newDocument('blank')
    const wrapper = mount(TemplatesView)

    await wrapper.find('[data-testid="rc-tplcard-zh-general-001"]').trigger('click')
    await wrapper.find('[data-testid="rc-tpl-back"]').trigger('click')

    expect(store.screen).toBe('editor')
    expect(store.appliedTemplateId).toBeNull()
  })
})

describe('UI 态不落盘（契约 §10.4）', () => {
  it('serialize 后的文档里没有 screen 与 appliedTemplateId', async () => {
    const { serialize } = await import('../../src/model/serialize')

    store.newDocument('template', 'zh-student-001')
    store.setScreen('templates')

    const json = serialize(store.doc)
    expect(json).not.toContain('screen')
    expect(json).not.toContain('workbench')
    expect(json).not.toContain('appliedTemplateId')
    expect(json).not.toContain('zh-student-001') // 模板 id 不是文档内容
  })
})

describe('从工作台进入', () => {
  it('工作台「从模板开始」跳到模板库整屏（临时弹窗已删除）', async () => {
    const Workbench = (await import('../../src/ui/workbench/Workbench.vue')).default
    const wrapper = mount(Workbench)

    await wrapper.find('[data-testid="rc-entry-template"]').trigger('click')
    expect(store.screen).toBe('templates')
    // 旧的临时弹窗不再存在
    expect(wrapper.find('.scrim').exists()).toBe(false)
  })
})
