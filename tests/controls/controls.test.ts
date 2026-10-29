// @vitest-environment jsdom
/**
 * 基础控件回归测试（C 段：类名对齐设计稿）
 *
 * 只测**行为与语义**（类名、aria、事件），不测像素 —— 颜色与尺寸归
 * `src/design/app.css` + `tokens.css`，由 `tests/design/fidelity.test.ts` 守。
 *
 * 本轮类名映射（设计稿原名为准）：
 *   RcButton  .btn / --primary / --ghost / --danger / --sm / --icon（default 与 md 不带修饰类）
 *   RcBadge   .badge / --accent / --ok / --warn / --danger / --neutral / --lg
 *   RcSideTabs      .side__tabs / .side__tab / --on
 *   RcInspectorTabs .inspector__tabs / .inspector__tab / --on
 *   RcCard    .card / .card__media
 *   RcSwitch  .switch / --on（滑块走 ::after，无 thumb 节点）
 *   RcNotice  .hintbar / --ok / --warn / --danger（info 无修饰）
 *   RcField   .field / __label / __req / __error / __hint
 *   RcOverflowBadge .paper-flag
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  RcBadge,
  RcButton,
  RcCard,
  RcField,
  RcInspectorTabs,
  RcNotice,
  RcOverflowBadge,
  RcSideTabs,
  RcSwitch,
} from '../../src/ui/controls'
import type { RcTabItem } from '../../src/ui/controls'

describe('RcButton', () => {
  it('默认渲染：只有 .btn（default 与 md 不带修饰类），文字走默认插槽', () => {
    const wrapper = mount(RcButton, { slots: { default: '导出前检查' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.classes()).toEqual(['btn'])
    expect(wrapper.text()).toBe('导出前检查')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('variant 与 size 落到类名上', () => {
    const wrapper = mount(RcButton, {
      props: { variant: 'primary', size: 'sm' },
      slots: { default: '导出' },
    })
    expect(wrapper.classes()).toContain('btn--primary')
    expect(wrapper.classes()).toContain('btn--sm')
  })

  it('iconOnly 追加 btn--icon', () => {
    const wrapper = mount(RcButton, { props: { iconOnly: true } })
    expect(wrapper.classes()).toContain('btn--icon')
  })

  it('icon 插槽会渲染在文字前（不再包一层图标容器）', () => {
    const wrapper = mount(RcButton, {
      slots: { icon: '<svg data-test="i" />', default: '导出' },
    })
    expect(wrapper.find('[data-test="i"]').exists()).toBe(true)
    expect(wrapper.element.firstElementChild?.getAttribute('data-test')).toBe('i')
    expect(wrapper.text()).toBe('导出')
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

  it('四种 variant 的类名映射：default 无修饰类，其余一一对应', () => {
    const expected = {
      primary: 'btn--primary',
      default: null,
      ghost: 'btn--ghost',
      danger: 'btn--danger',
    } as const
    for (const [variant, className] of Object.entries(expected)) {
      const wrapper = mount(RcButton, { props: { variant: variant as 'primary' } })
      if (className === null) {
        expect(wrapper.classes()).not.toContain('btn--default')
      } else {
        expect(wrapper.classes()).toContain(className)
      }
    }
  })
})

describe('RcBadge', () => {
  it('默认是 neutral，类名走设计稿词表', () => {
    const wrapper = mount(RcBadge, { slots: { default: '建议' } })
    expect(wrapper.classes()).toContain('badge')
    expect(wrapper.classes()).toContain('badge--neutral')
    expect(wrapper.text()).toBe('建议')
  })

  it('tone=success 映射到 badge--ok，size=md 映射到 badge--lg', () => {
    const wrapper = mount(RcBadge, {
      props: { tone: 'success', size: 'md' },
      slots: { default: '已确认' },
    })
    expect(wrapper.classes()).toContain('badge--ok')
    expect(wrapper.classes()).toContain('badge--lg')
  })

  it('dot 属性已按设计稿删除：传了也不会渲染圆点', () => {
    const wrapper = mount(RcBadge, { props: { dot: true }, slots: { default: 'x' } })
    expect(wrapper.element.children).toHaveLength(0)
  })

  it('五种语气都能渲染', () => {
    const map = {
      accent: 'badge--accent',
      success: 'badge--ok',
      warning: 'badge--warn',
      danger: 'badge--danger',
      neutral: 'badge--neutral',
    } as const
    for (const [tone, className] of Object.entries(map)) {
      const wrapper = mount(RcBadge, { props: { tone: tone as 'accent' }, slots: { default: 't' } })
      expect(wrapper.classes()).toContain(className)
    }
  })
})

const TABS: RcTabItem[] = [
  { key: 'tpl', label: '模板' },
  { key: 'cmp', label: '组件', count: 5 },
  { key: 'asset', label: '素材', disabled: true },
  { key: 'layer', label: '图层' },
]

describe('RcSideTabs', () => {
  it('根节点是 .side__tabs 的 tablist，渲染全部 tab（含禁用项）', () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    expect(wrapper.attributes('role')).toBe('tablist')
    expect(wrapper.classes()).toContain('side__tabs')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(TABS.length)
    expect(wrapper.findAll('[role="tab"]')[0]?.classes()).toContain('side__tab')
  })

  it('选中项 aria-selected=true 且 tabindex=0，其余 -1', () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1]?.attributes('aria-selected')).toBe('true')
    expect(tabs[1]?.attributes('tabindex')).toBe('0')
    expect(tabs[0]?.attributes('aria-selected')).toBe('false')
    expect(tabs[0]?.attributes('tabindex')).toBe('-1')
    expect(tabs[1]?.classes()).toContain('side__tab--on')
  })

  it('count 会渲染出来', () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    expect(wrapper.findAll('[role="tab"]')[1]?.text()).toContain('5')
  })

  it('点击未选中项发出 update:modelValue', async () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    await wrapper.findAll('[role="tab"]')[0]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['tpl'])
  })

  it('点击已选中项不发事件', async () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('禁用项点击不发事件，且标了 aria-disabled', async () => {
    const wrapper = mount(RcSideTabs, { props: { items: TABS, modelValue: 'cmp' } })
    const disabledTab = wrapper.findAll('[role="tab"]')[2]
    expect(disabledTab?.attributes('aria-disabled')).toBe('true')
    await disabledTab?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('右栏形态用同一套键盘行为：方向键跳过禁用项，类名换成 inspector__*', async () => {
    const wrapper = mount(RcInspectorTabs, { props: { items: TABS, modelValue: 'cmp' } })
    expect(wrapper.classes()).toContain('inspector__tabs')
    expect(wrapper.findAll('[role="tab"]')[0]?.classes()).toContain('inspector__tab')

    // 从「组件」按右：应跳过禁用的「素材」，落到「图层」
    await wrapper.findAll('[role="tab"]')[1]?.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['layer'])
  })
})

describe('RcCard', () => {
  it('默认静态卡：只有 .card，无 role/aria-selected', () => {
    const wrapper = mount(RcCard, { slots: { default: '内容' } })
    expect(wrapper.classes()).toEqual(['card'])
    expect(wrapper.attributes('role')).toBeUndefined()
    expect(wrapper.attributes('aria-selected')).toBeUndefined()
  })

  it('interactive 补 role/tabindex，selected 落到 aria-selected（不造设计稿没有的类）', () => {
    const wrapper = mount(RcCard, { props: { interactive: true, selected: true } })
    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('tabindex')).toBe('0')
    expect(wrapper.attributes('aria-selected')).toBe('true')
    expect(wrapper.classes()).toEqual(['card'])
  })

  it('media 插槽存在时才渲染 .card__media', () => {
    const without = mount(RcCard, { slots: { default: 'x' } })
    expect(without.find('.card__media').exists()).toBe(false)

    const withMedia = mount(RcCard, {
      slots: { media: '<div data-test="thumb" />', default: 'x' },
    })
    expect(withMedia.find('.card__media').exists()).toBe(true)
    expect(withMedia.find('[data-test="thumb"]').exists()).toBe(true)
  })

  it('默认插槽直接进 .card（不再包 body 容器）', () => {
    const wrapper = mount(RcCard, { slots: { default: '<p data-test="body">正文</p>' } })
    expect(wrapper.element.firstElementChild?.getAttribute('data-test')).toBe('body')
  })
})

describe('RcSwitch', () => {
  it('开态与关态的 aria-checked 正确，滑块由伪元素画（无 thumb 节点）', () => {
    const off = mount(RcSwitch, { props: { modelValue: false } })
    expect(off.attributes('aria-checked')).toBe('false')
    expect(off.classes()).toContain('switch')
    expect(off.element.children).toHaveLength(0)

    const on = mount(RcSwitch, { props: { modelValue: true } })
    expect(on.attributes('aria-checked')).toBe('true')
    expect(on.classes()).toContain('switch--on')
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
  it('默认 info：只有 .hintbar，渲染 status 角色', () => {
    const wrapper = mount(RcNotice, { slots: { default: '提示内容' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.classes()).toEqual(['hintbar'])
    expect(wrapper.text()).toContain('提示内容')
  })

  it('四种语气映射到设计稿修饰类（info 无修饰）', () => {
    const map = {
      info: null,
      success: 'hintbar--ok',
      warning: 'hintbar--warn',
      danger: 'hintbar--danger',
    } as const
    for (const [tone, className] of Object.entries(map)) {
      const wrapper = mount(RcNotice, { props: { tone: tone as 'info' } })
      if (className === null) {
        expect(wrapper.classes()).toEqual(['hintbar'])
      } else {
        expect(wrapper.classes()).toContain(className)
      }
    }
  })

  it('title 有值才渲染标题行', () => {
    const without = mount(RcNotice, { slots: { default: 'x' } })
    expect(without.find('.hintbar__t').exists()).toBe(false)

    const withTitle = mount(RcNotice, { props: { title: '发现 1 项阻断' } })
    expect(withTitle.find('.hintbar__t').text()).toBe('发现 1 项阻断')
  })

  it('icon 与 actions 插槽按需渲染', () => {
    const bare = mount(RcNotice, { slots: { default: 'x' } })
    expect(bare.find('.hintbar__ico').exists()).toBe(false)
    expect(bare.find('[data-test="act"]').exists()).toBe(false)

    const full = mount(RcNotice, {
      slots: { default: 'x', icon: '<i data-test="ic" />', actions: '<button data-test="act" />' },
    })
    expect(full.find('.hintbar__ico').exists()).toBe(true)
    expect(full.find('[data-test="act"]').exists()).toBe(true)
  })

  it('compact 档已按设计稿删除：传了也不产生额外类', () => {
    const wrapper = mount(RcNotice, { props: { compact: true } })
    expect(wrapper.classes()).toEqual(['hintbar'])
  })
})

describe('RcField', () => {
  it('label 与 htmlFor 关联到控件', () => {
    const wrapper = mount(RcField, {
      props: { label: '项目名称', htmlFor: 'proj-name' },
      slots: { default: '<input id="proj-name" />' },
    })
    const label = wrapper.find('.field__label')
    expect(label.text()).toBe('项目名称')
    expect(label.attributes('for')).toBe('proj-name')
  })

  it('htmlFor 为空时不渲染 for 属性', () => {
    const wrapper = mount(RcField, { props: { label: '无关联' } })
    expect(wrapper.find('.field__label').attributes('for')).toBeUndefined()
  })

  it('required 渲染 .field__req 星号', () => {
    const wrapper = mount(RcField, { props: { label: '邮箱', required: true } })
    expect(wrapper.find('.field__req').exists()).toBe(true)
  })

  it('设计稿没有头部/动作槽：传 actions 也不渲染额外容器', () => {
    const wrapper = mount(RcField, { slots: { actions: '<a data-test="act" href="#">恢复</a>' } })
    expect(wrapper.find('.field__label').exists()).toBe(false)
    expect(wrapper.find('[data-test="act"]').exists()).toBe(false)
  })

  it('错误态：渲染 .field__error（role=alert），不额外挂 invalid 类', () => {
    const wrapper = mount(RcField, {
      props: { label: '邮箱', error: '邮箱格式不完整，未应用到纸面。' },
    })
    const error = wrapper.find('.field__error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('邮箱格式不完整')
    // 设计稿把错误态画在控件自己身上（.input--invalid），外壳不挂标记类
    expect(wrapper.classes()).toEqual(['field'])
  })

  it('无错误时不渲染错误行', () => {
    const wrapper = mount(RcField, { props: { label: '邮箱' } })
    expect(wrapper.find('.field__error').exists()).toBe(false)
  })

  it('hint 独立于错误行渲染', () => {
    const wrapper = mount(RcField, {
      props: { error: '格式不对', hint: '上次有效值：zhangming.dev@example.com' },
    })
    expect(wrapper.find('.field__hint').text()).toContain('上次有效值')
    expect(wrapper.find('.field__error').exists()).toBe(true)
  })
})

describe('RcOverflowBadge', () => {
  it('单条显示感叹号，不显示数字', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 1 } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).toBe('')
  })

  it('感叹号用 stroke-width=2（规格 §0.2 的唯一例外）', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 1 } })
    expect(wrapper.find('svg').attributes('stroke-width')).toBe('2')
  })

  it('多条显示数字，类名是设计稿的 paper-flag', () => {
    const wrapper = mount(RcOverflowBadge, { props: { count: 3 } })
    expect(wrapper.text()).toBe('3')
    expect(wrapper.classes()).toContain('paper-flag')
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
