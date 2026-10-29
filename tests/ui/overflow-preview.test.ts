// @vitest-environment jsdom
/**
 * 溢出预览（07）回归测试
 *
 * 验收（team-lead 的 07 派工令）：
 *  1. 弹窗列出 `.ovfpreview`，超出行用 `<mark>` 包住（有 overText 数据时）
 *  2. 压缩该组件 → 该组件行距变小、其他不变、undo 可退
 *  3. 压缩本页全部 → 本页全部变、**一步 undo 全回退**
 *  4. 行距不会被压到 1.40 以下（clamp）
 *  5. 暂不处理 → 数据不变、弹窗关
 *  6. 纸面 `.paper-flag` 出现且数字 = 溢出数
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { MIN_LINE_HEIGHT, useEditorStore } from '../../src/state/editor-store'
import CanvasView from '../../src/ui/canvas/CanvasView.vue'
import OverflowDialog from '../../src/ui/overflow-dialog/OverflowDialog.vue'
import type { OverflowItem } from '../../src/ui/overflow-dialog/OverflowDialog.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

function styleOf(store: Store, id: string): Record<string, unknown> | undefined {
  const component = store.doc.components.find((c) => c.id === id)
  return component !== undefined && 'style' in component ? component.style : undefined
}

/** 造一个溢出场景：单个组件高于可导出区域（20mm 内容区），分页层会报 overflow-page */
function makeOverflowDoc(): string {
  store.newDocument('blank')
  const basics = store.components[0]
  if (basics !== undefined) store.removeComponent(basics.id)
  store.setPageSettings({ heightMm: 60, marginTopMm: 20, marginRightMm: 20, marginBottomMm: 20, marginLeftMm: 20 })

  const id = store.addComponent('education')
  if (id === null) throw new Error('education 未注册')
  store.updateField(id, 'school', '华南理工大学')
  store.updateField(
    id,
    'courses',
    Array.from({ length: 12 }, (_, i) => `课程 ${i + 1}`),
  )
  return id
}

const ITEMS: OverflowItem[] = [
  {
    componentId: 'c1',
    componentName: '课表助手项目',
    pageIndex: 0,
    lineCount: 3,
    lines: [
      '构建课程导入与冲突检测，支持 6 类课表格式，导入成功率 96%；',
      '实现离线缓存及提醒设置，累计 800+ 用户，周活跃率 62%。',
    ],
    overLines: ['实现离线缓存及提醒设置，累计 800+ 用户，周活跃率 62%。'],
  },
]

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('1. 溢出预览', () => {
  it('弹窗列出 .ovfpreview，超出行用 <mark> 包住', () => {
    const wrapper = mount(OverflowDialog, { props: { open: true, items: ITEMS } })

    expect(wrapper.find('.ovfpreview').exists()).toBe(true)
    expect(wrapper.find('.ovfpreview__label').text()).toContain('课表助手项目')
    expect(wrapper.find('.ovfpreview__line').text()).toBe('可导出区域边界')

    const mark = wrapper.find('.ovfpreview__text mark')
    expect(mark.exists()).toBe(true)
    expect(mark.text()).toBe('实现离线缓存及提醒设置，累计 800+ 用户，周活跃率 62%。')
  })

  it('没有逐行数据时渲染真实文本行、且不编造 <mark>（整段不高亮）', () => {
    const wrapper = mount(OverflowDialog, {
      props: {
        open: true,
        items: [
          { componentId: 'c1', componentName: 'X', pageIndex: 0, lines: ['第一行原文', '第二行原文'] },
        ],
      },
    })
    const text = wrapper.find('[data-testid="rc-ovf-preview-text"]')
    expect(text.text()).toContain('第一行原文')
    expect(text.text()).toContain('第二行原文')
    expect(text.find('mark').exists()).toBe(false)
  })

  it('无溢出时不渲染 .ovfpreview（items 为空）', () => {
    const wrapper = mount(OverflowDialog, { props: { open: true, items: [] } })
    expect(wrapper.find('.ovfpreview').exists()).toBe(false)
  })

  it('副标题照 07 原文；有行数才出现数字', () => {
    const withCount = mount(OverflowDialog, { props: { open: true, items: ITEMS } })
    expect(withCount.find('.dialog__sub').text()).toBe(
      '第 1 页 · 课表助手项目有 3 行超出可导出区域。请选择一种处理方式。',
    )

    const noCount = mount(OverflowDialog, {
      props: { open: true, items: [{ componentId: 'c1', componentName: 'X', pageIndex: 1 }] },
    })
    expect(noCount.find('.dialog__sub').text()).toBe(
      '第 2 页 · X超出可导出区域。请选择一种处理方式。',
    )
  })
})

describe('2. 压缩该组件', () => {
  it('该组件行距变小、其他组件不变、undo 可退', () => {
    const target = store.addComponent('education')
    const other = store.addComponent('skills')
    if (target === null || other === null) throw new Error('组件未注册')

    store.compressComponent(target)

    expect(styleOf(store, target)?.lineHeight).toBe(1.45)
    expect(styleOf(store, other)).toBeUndefined()

    // 一步撤销回到压缩前（style 整个消失 = 这一步就是那次压缩）
    store.undo()
    expect(styleOf(store, target)).toBeUndefined()
    expect(styleOf(store, other)).toBeUndefined()
  })

  it('弹窗默认选中「压缩该组件」，点应用压缩发出对应事件', async () => {
    const wrapper = mount(OverflowDialog, { props: { open: true, items: ITEMS } })
    expect(wrapper.find('[data-testid="rc-ovf-choice-component"]').classes()).toContain('optcard--on')

    await wrapper.find('[data-testid="rc-ovf-apply"]').trigger('click')
    expect(wrapper.emitted('compressComponent')?.[0]).toEqual(['c1'])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('3. 压缩本页全部', () => {
  it('本页全部内容组件都变，且**一步 undo 全回退**', () => {
    const first = store.addComponent('education')
    const second = store.addComponent('skills')
    if (first === null || second === null) throw new Error('组件未注册')

    store.compressPage(0)

    expect(styleOf(store, first)?.lineHeight).toBe(1.4)
    expect(styleOf(store, first)?.fontSizePt).toBe(10)
    expect(styleOf(store, second)?.lineHeight).toBe(1.4)

    // 一步撤销：两个组件同时回退（若是各一步，第一次 undo 只会回退一个）
    store.undo()
    expect(styleOf(store, first)).toBeUndefined()
    expect(styleOf(store, second)).toBeUndefined()
  })
})

describe('4. 压缩下限 clamp', () => {
  it('行距不会被压到 1.40 以下，字号不会低于 10pt', () => {
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')

    store.updateComponentStyle(id, { lineHeight: 1.2, fontSizePt: 8 })

    // 两个值都低于下限 → 一个都没写入（不许默默压到 9pt）
    expect(styleOf(store, id)).toBeUndefined()

    // 正好等于下限的值可以写入
    store.updateComponentStyle(id, { lineHeight: MIN_LINE_HEIGHT, fontSizePt: 10 })
    expect(styleOf(store, id)).toEqual({ lineHeight: 1.4, fontSizePt: 10 })
  })
})

describe('5. 暂不处理', () => {
  it('数据不变、弹窗关', async () => {
    const id = store.addComponent('education')
    if (id === null) throw new Error('education 未注册')

    const wrapper = mount(OverflowDialog, { props: { open: true, items: ITEMS } })
    await wrapper.find('[data-testid="rc-ovf-choice-skip"]').trigger('click')
    await wrapper.find('[data-testid="rc-ovf-apply"]').trigger('click')

    expect(wrapper.emitted('skip')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(styleOf(store, id)).toBeUndefined()
  })
})

describe('6. 纸面溢出标记', () => {
  it('.paper-flag 出现且数字 = 溢出数，同时画 .p-boundary', () => {
    makeOverflowDoc()
    const overflowCount = store.layout.warnings.filter(
      (w) => w.type === 'overflow-page' || w.type === 'overflow-component',
    ).length
    expect(overflowCount).toBeGreaterThan(0)

    const canvas = mount(CanvasView)
    const flag = canvas.find('[data-testid="rc-paper-flag-0"]')
    expect(flag.exists()).toBe(true)
    expect(flag.text()).toBe(String(overflowCount))
    expect(canvas.find('.p-boundary').exists()).toBe(true)
  })

  it('没有溢出时不画标记', () => {
    store.newDocument('blank')
    const canvas = mount(CanvasView)
    expect(canvas.find('.paper-flag').exists()).toBe(false)
    expect(canvas.find('.p-boundary').exists()).toBe(false)
  })

  it('纸面 .is-over / .p-ovf__tag 恰好标在 overLines 里的那些行上', () => {
    makeOverflowDoc()
    const warning = store.layout.warnings.find((w) => w.type === 'overflow-page')
    expect(warning?.overLines?.length).toBeGreaterThan(0)
    const overLines = warning?.overLines ?? []

    const canvas = mount(CanvasView)
    const overs = canvas.findAll('li.is-over, p.is-over')
    expect(overs.length).toBe(overLines.length)

    // 每条被标的行都能在 overLines 里逐字找到（不含标签文案）
    for (const el of overs) {
      const text = el.text().replace(/超出 \d+ 行/, '').trim()
      expect(overLines.some((line) => text.includes(line))).toBe(true)
    }

    // 「超出 N 行」的 N = overLines.length，且只挂在第一条被裁行上
    const tags = canvas.findAll('.p-ovf__tag')
    expect(tags).toHaveLength(1)
    expect(tags[0]?.text().trim()).toBe(`超出 ${overLines.length} 行`)
  })
})
