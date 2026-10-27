// @vitest-environment jsdom
/**
 * TC-004 基础控件回归测试
 * 对照：docs/design/components-spec.md §0（全局约定）、§1（按钮）；
 *       docs/design/V3-DELTA.md §5（材质：透明色 + 模糊，主按钮不是实心填充）。
 *
 * 这里只测**行为与语义**（类名、aria、事件），不测像素——颜色归 token，由 09 规格页保证。
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  RcBadge,
  RcButton,
  RcCard,
  RcField,
  RcNotice,
  RcOverflowBadge,
  RcSwitch,
  RcTabs,
} from '../../src/ui/controls'
import type { RcTabItem } from '../../src/ui/controls'

describe('RcButton', () => {
  it('默认渲染：带 rc-btn 与 md/default 类，文字走默认插槽', () => {
    const wrapper = mount(RcButton, { slots: { default: '导出前检查' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.classes()).toContain('rc-btn')
    expect(wrapper.classes()).toContain('rc-btn--default')
    expect(wrapper.classes()).toContain('rc-btn--md')
    expect(wrapper.text()).toBe('导出前检查')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('variant 与 size 落到类名上', () => {
    const wrapper = mount(RcButton, {
      props: { variant: 'primary', size: 'sm' },
      slots: { default: '导出' },
    })
    expect(wrapper.classes()).toContain('rc-btn--primary')
    expect(wrapper.classes()).toContain('rc-btn--sm')
  })

  it('iconOnly 追加图标按钮类', () => {
    const wrapper = mount(RcButton, { props: { iconOnly: true } })
    expect(wrapper.classes()).toContain('rc-btn--icon')
  })

  it('icon 插槽会渲染在文字前', () => {
    const wrapper = mount(RcButton, {
      slots: { icon: '<svg data-test="i" />', default: '导出' },
    })
    expect(wrapper.find('[data-test="i"]').exists()).toBe(true)
    expect(wrapper.find('.rc-btn__icon').exists()).toBe(true)
  })

  it('点击触发一次 click 事件', async () => {
    const wrapper = mount(RcButton, { slots: { default: '好' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('禁用：用 aria-disabled 而不是原生 disabled，仍然可聚焦', () => {
    const wrapper = mount(RcButton, {
      props: { disabled: true, disabledReason: '还有 1 项阻断问题' },
      slots: { default: '导出' },
    })
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    // 关键：不能有原生 disabled，否则键盘用户聚焦不到、读不到原因
    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.attributes('title')).toBe('还有 1 项阻断问题')
  })

  it('禁用时点击不发事件', async () => {
    const wrapper = mount(RcButton, {
      props: { disabled: true, disabledReason: '还有 1 项阻断问题' },
      slots: { default: '导出' },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('未禁用时没有 title 与 aria-disabled', () => {
    const wrapper = mount(RcButton, { slots: { default: '好' } })
    expect(wrapper.attributes('title')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
  })

  it('四种 variant 都能渲染出对应类名', () => {
    for (const variant of ['primary', 'default', 'ghost', 'danger'] as const) {
      const wrapper = mount(RcButton, { props: { variant } })
      expect(wrapper.classes()).toContain(`rc-btn--${variant}`)
    }
  })
})

describe('RcBadge', () => {
  it('默认是 neutral', () => {
    const wrapper = mount(RcBadge, { slots: { default: '建议' } })
    expect(wrapper.classes()).toContain('rc-badge')
    expect(wrapper.classes()).toContain('rc-badge--neutral')
    expect(wrapper.text()).toBe('建议')
  })

  it('tone 与 size 落到类名上', () => {
    const wrapper = mount(RcBadge, {
      props: { tone: 'success', size: 'sm' },
      slots: { default: '已确认' },
    })
    expect(wrapper.classes()).toContain('rc-badge--success')
    expect(wrapper.classes()).toContain('rc-badge--sm')
  })

  it('dot 打开时渲染小圆点', () => {
    const withoutDot = mount(RcBadge, { slots: { default: 'x' } })
    expect(withoutDot.find('.rc-badge__dot').exists()).toBe(false)

    const withDot = mount(RcBadge, { props: { dot: true }, slots: { default: 'x' } })
    expect(withDot.find('.rc-badge__dot').exists()).toBe(true)
  })

  it('五种语气都能渲染', () => {
    for (const tone of ['accent', 'success', 'warning', 'danger', 'neutral'] as const) {
      const wrapper = mount(RcBadge, { props: { tone }, slots: { default: 't' } })
      expect(wrapper.classes()).toContain(`rc-badge--${tone}`)
    }
  })
})

const TABS: RcTabItem[] = [
  { key: 'tpl', label: '模板' },
  { key: 'cmp', label: '组件', count: 5 },
  { key: 'asset', label: '素材', disabled: true },
  { key: 'layer', label: '图层' },
]

describe('RcTabs', () => {
  it('渲染 tablist 与全部 tab（含禁用项）', () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    expect(wrapper.attributes('role')).toBe('tablist')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(TABS.length)
  })

  it('选中项 aria-selected=true 且 tabindex=0，其余 -1', () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1]?.attributes('aria-selected')).toBe('true')
    expect(tabs[1]?.attributes('tabindex')).toBe('0')
    expect(tabs[0]?.attributes('aria-selected')).toBe('false')
    expect(tabs[0]?.attributes('tabindex')).toBe('-1')
  })

  it('count 会渲染出来', () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    expect(wrapper.findAll('[role="tab"]')[1]?.text()).toContain('5')
  })

  it('点击未选中项发出 update:modelValue', async () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    await wrapper.findAll('[role="tab"]')[0]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['tpl'])
  })

  it('点击已选中项不发事件', async () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('禁用项点击不发事件，且标了 aria-disabled', async () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    const disabledTab = wrapper.findAll('[role="tab"]')[2]
    expect(disabledTab?.attributes('aria-disabled')).toBe('true')
    expect(disabledTab?.classes()).toContain('rc-tabs__tab--disabled')
    await disabledTab?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('方向键跳过禁用项', async () => {
    const wrapper = mount(RcTabs, { props: { items: TABS, modelValue: 'cmp' } })
    // 从「组件」按右：应跳过禁用的「素材」，落到「图层」
    await wrapper.findAll('[role="tab"]')[1]?.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['layer'])
  })
})

describe('RcCard', () => {
  it('默认静态卡：不可交互、无 selected 类', () => {
    const wrapper = mount(RcCard, { slots: { default: '内容' } })
    expect(wrapper.classes()).toContain('rc-card')
    expect(wrapper.classes()).toContain('rc-card--pad-md')
    expect(wrapper.classes()).not.toContain('rc-card--interactive')
    expect(wrapper.classes()).not.toContain('rc-card--selected')
  })

  it('interactive 与 selected 落到类名上', () => {
    const wrapper = mount(RcCard, { props: { interactive: true, selected: true } })
    expect(wrapper.classes()).toContain('rc-card--interactive')
    expect(wrapper.classes()).toContain('rc-card--selected')
  })

  it('padding 档位', () => {
    expect(mount(RcCard, { props: { padding: 'none' } }).classes()).toContain('rc-card--pad-none')
    expect(mount(RcCard, { props: { padding: 'sm' } }).classes()).toContain('rc-card--pad-sm')
  })

  it('media 插槽存在时才渲染媒体容器', () => {
    const without = mount(RcCard, { slots: { default: 'x' } })
    expect(without.find('.rc-card__media').exists()).toBe(false)

    const withMedia = mount(RcCard, {
      slots: { media: '<div data-test="thumb" />', default: 'x' },
    })
    expect(withMedia.find('.rc-card__media').exists()).toBe(true)
    expect(withMedia.find('[data-test="thumb"]').exists()).toBe(true)
  })
})

describe('RcSwitch', () => {
  it('开态与关态的 aria-checked 正确', () => {
    expect(mount(RcSwitch, { props: { modelValue: false } }).attributes('aria-checked')).toBe(
      'false',
    )
    const on = mount(RcSwitch, { props: { modelValue: true } })
    expect(on.attributes('aria-checked')).toBe('true')
    expect(on.classes()).toContain('rc-switch--on')
  })

  it('点击发出取反后的值', async () => {
    const off = mount(RcSwitch, { props: { modelValue: false } })
    await off.trigger('click')
    expect(off.emitted('update:modelValue')?.[0]).toEqual([true])

    const on = mount(RcSwitch, { props: { modelValue: true } })
    await on.trigger('click')
    expect(on.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('role 是 switch，且不绑原生 disabled', () => {
    const wrapper = mount(RcSwitch, { props: { modelValue: false, disabled: true } })
    expect(wrapper.attributes('role')).toBe('switch')
    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
  })

  it('禁用时点击不发事件，原因挂在 title 上', async () => {
    const wrapper = mount(RcSwitch, {
      props: { modelValue: false, disabled: true, disabledReason: '背景已锁定，先解锁' },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.attributes('title')).toBe('背景已锁定，先解锁')
  })
})

describe('RcNotice', () => {
  it('默认 info，渲染 status 角色', () => {
    const wrapper = mount(RcNotice, { slots: { default: '提示内容' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.classes()).toContain('rc-notice--info')
    expect(wrapper.text()).toContain('提示内容')
  })

  it('四种语气都能渲染', () => {
    for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
      const wrapper = mount(RcNotice, { props: { tone } })
      expect(wrapper.classes()).toContain(`rc-notice--${tone}`)
    }
  })

  it('title 有值才渲染标题行', () => {
    const without = mount(RcNotice, { slots: { default: 'x' } })
    expect(without.find('.rc-notice__title').exists()).toBe(false)

    const withTitle = mount(RcNotice, { props: { title: '发现 1 项阻断' } })
    expect(withTitle.find('.rc-notice__title').text()).toBe('发现 1 项阻断')
  })

  it('icon 与 actions 插槽按需渲染', () => {
    const bare = mount(RcNotice, { slots: { default: 'x' } })
    expect(bare.find('.rc-notice__icon').exists()).toBe(false)
    expect(bare.find('.rc-notice__actions').exists()).toBe(false)

    const full = mount(RcNotice, {
      slots: { default: 'x', icon: '<i data-test="ic" />', actions: '<button data-test="act" />' },
    })
    expect(full.find('.rc-notice__icon').exists()).toBe(true)
    expect(full.find('.rc-notice__actions').exists()).toBe(true)
  })

  it('compact 档位', () => {
    const wrapper = mount(RcNotice, { props: { compact: true } })
    expect(wrapper.classes()).toContain('rc-notice--compact')
  })
})

describe('RcField', () => {
  it('label 与 htmlFor 关联到控件', () => {
    const wrapper = mount(RcField, {
      props: { label: '项目名称', htmlFor: 'proj-name' },
      slots: { default: '<input id="proj-name" />' },
    })
    const label = wrapper.find('.rc-field__label')
    expect(label.text()).toBe('项目名称')
    expect(label.attributes('for')).toBe('proj-name')
  })

  it('htmlFor 为空时不渲染 for 属性', () => {
    const wrapper = mount(RcField, { props: { label: '无关联' } })
    expect(wrapper.find('.rc-field__label').attributes('for')).toBeUndefined()
  })

  it('required 渲染星号', () => {
    const wrapper = mount(RcField, { props: { label: '邮箱', required: true } })
    expect(wrapper.find('.rc-field__required').exists()).toBe(true)
  })

  it('没有 label 但有 actions 时，头部仍然渲染', () => {
    const wrapper = mount(RcField, { slots: { actions: '<a href="#">恢复</a>' } })
    expect(wrapper.find('.rc-field__head').exists()).toBe(true)
    expect(wrapper.find('.rc-field__label').exists()).toBe(false)
    expect(wrapper.find('.rc-field__actions').exists()).toBe(true)
  })

  it('错误态：加 invalid 类、role=alert、文案可见', () => {
    const wrapper = mount(RcField, {
      props: { label: '邮箱', error: '邮箱格式不完整，未应用到纸面。' },
    })
    expect(wrapper.classes()).toContain('rc-field--invalid')
    const error = wrapper.find('.rc-field__error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('邮箱格式不完整')
  })

  it('无错误时不渲染错误行', () => {
    const wrapper = mount(RcField, { props: { label: '邮箱' } })
    expect(wrapper.find('.rc-field__error').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('rc-field--invalid')
  })

  it('hint 独立于错误行渲染', () => {
    const wrapper = mount(RcField, {
      props: { error: '格式不对', hint: '上次有效值：zhangming.dev@example.com' },
    })
    expect(wrapper.find('.rc-field__hint').text()).toContain('上次有效值')
    expect(wrapper.find('.rc-field__error').exists()).toBe(true)
  })
})

describe('RcOverflowBadge', () => {
  it('单条显示感叹号，不显示数字', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 1 } })
    expect(wrapper.find('.rc-overflow-badge__mark').exists()).toBe(true)
    expect(wrapper.find('.rc-overflow-badge__num').exists()).toBe(false)
  })

  it('感叹号用 stroke-width=2（规格 §0.2 的唯一例外）', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 1 } })
    expect(wrapper.find('svg').attributes('stroke-width')).toBe('2')
  })

  it('多条显示数字', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 3 } })
    expect(wrapper.find('.rc-overflow-badge__num').text()).toBe('3')
    expect(wrapper.classes()).toContain('rc-overflow-badge--num')
  })

  it('默认 aria-label 说明条数，可用 label 覆盖', () => {
    expect(mount(RcOverflowBadge, { props: { count: 3 } }).attributes('aria-label')).toBe(
      '3 处内容溢出',
    )
    const custom = mount(RcOverflowBadge, {
      props: { count: 3, label: '第 1 页有 3 处内容溢出' },
    })
    expect(custom.attributes('aria-label')).toBe('第 1 页有 3 处内容溢出')
    expect(custom.attributes('title')).toBe('第 1 页有 3 处内容溢出')
  })

  it('是可点击的 button，type=button（不误触发表单提交）', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 2 } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
  })
})
