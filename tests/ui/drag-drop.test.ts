// @vitest-environment jsdom
/**
 * 拖拽（原生 HTML5 DnD）回归测试
 *
 * 两个独立行为：
 *   A. 拖入添加：左栏 `.compcard` → 画布 `.paper`，落 `store.addComponent(type)`
 *   B. 拖动排序：图层行 `.layerrow` → 另一图层行，落 `store.moveComponentTo(id, toIndex)`
 *   C. 纸面片段 `.p-piece` 也可拖去排序（与 B 同语义）
 *
 * jsdom 不实现 DataTransfer，所以这里**手动派发事件并挂一个假 dataTransfer**，
 * 不能用 `trigger('dragstart')` 的默认行为（它不会带 dataTransfer）。
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '../../src/state/editor-store'
import CanvasView from '../../src/ui/canvas/CanvasView.vue'
import ResourceBar from '../../src/ui/shell/ResourceBar.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

const CARD_MIME = 'application/x-rc-component'
const LAYER_MIME = 'application/x-rc-layer'

/** jsdom 没有 DataTransfer，按 HTML5 的 setData/getData/types 造一个最小实现 */
class FakeDataTransfer {
  private readonly data = new Map<string, string>()
  effectAllowed = 'none'
  dropEffect = 'none'

  setData(type: string, value: string): void {
    this.data.set(type, value)
  }

  getData(type: string): string {
    return this.data.get(type) ?? ''
  }

  get types(): string[] {
    return [...this.data.keys()]
  }
}

/** 手动派发带 dataTransfer 的拖拽事件，返回是否被 preventDefault */
function fireDrag(target: Element, type: string, dt: FakeDataTransfer): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dt })
  return target.dispatchEvent(event)
}

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('A. 拖入添加', () => {
  it('拖 .compcard 到 .paper → 组件数 +1 且 type 正确', () => {
    const resourceBar = mount(ResourceBar)
    const canvas = mount(CanvasView)
    const before = store.components.length

    const dt = new FakeDataTransfer()
    const card = resourceBar.find('[data-testid="rc-component-item-education"]')
    expect(card.attributes('draggable')).toBe('true')

    fireDrag(card.element, 'dragstart', dt)
    expect(dt.getData(CARD_MIME)).toBe('education')

    const paper = canvas.find('.paper')
    // dragover 不 preventDefault 的话浏览器不会触发 drop
    expect(fireDrag(paper.element, 'dragover', dt)).toBe(false)
    fireDrag(paper.element, 'drop', dt)

    expect(store.components.length).toBe(before + 1)
    expect(store.components[store.components.length - 1]?.type).toBe('education')
  })

  it('点击添加仍然可用（拖拽是并行入口，不替代点击）', async () => {
    const resourceBar = mount(ResourceBar)
    const before = store.components.length

    await resourceBar.find('[data-testid="rc-component-item-skills"]').trigger('click')

    expect(store.components.length).toBe(before + 1)
    expect(store.components[store.components.length - 1]?.type).toBe('skills')
  })

  it('图层行掉到纸面不算"新增"（MIME 不匹配时不落）', () => {
    const canvas = mount(CanvasView)
    const before = store.components.length

    const dt = new FakeDataTransfer()
    dt.setData(LAYER_MIME, 'whatever')
    const paper = canvas.find('.paper')
    // 纸面只认 CARD_MIME：dragover 不 preventDefault，drop 也不该添加
    expect(fireDrag(paper.element, 'dragover', dt)).toBe(true)
    fireDrag(paper.element, 'drop', dt)
    expect(store.components.length).toBe(before)
  })
})

describe('B. 图层树拖动排序', () => {
  /** 走 ResourceBar 装配（含 @move-to → store 的真实接线），并切到「页面」Tab 露出图层树 */
  async function mountLayers() {
    const basics = store.components[0]
    const second = store.addComponent('skills')
    const third = store.addComponent('awards')

    const bar = mount(ResourceBar)
    const tabs = bar.findAll('[role="tab"]')
    await tabs[3]?.trigger('click') // 模板 / 组件 / 素材 / 页面

    return { basics, second, third, bar }
  }

  it('拖第 1 行到第 3 行的位置 → order 重排正确', async () => {
    const { basics, second, third, bar } = await mountLayers()
    expect(store.components.map((c) => c.id)).toEqual([basics?.id, second, third])

    const dt = new FakeDataTransfer()
    const from = bar.find(`[data-testid="rc-layer-${second}"]`)
    const to = bar.find(`[data-testid="rc-layer-${third}"]`)
    expect(from.attributes('draggable')).toBe('true')

    fireDrag(from.element, 'dragstart', dt)
    expect(dt.getData(LAYER_MIME)).toBe(second)
    fireDrag(to.element, 'dragover', dt)
    fireDrag(to.element, 'drop', dt)

    // 落点语义 = 最终位置：skills 序号 1 → 2
    expect(store.components.map((c) => c.id)).toEqual([basics?.id, third, second])
  })

  it('拖拽后 undo 能回到原顺序（证明走 undo 栈，不是直接改 doc）', async () => {
    const { basics, second, third, bar } = await mountLayers()
    const original = [basics?.id, second, third]

    const dt = new FakeDataTransfer()
    fireDrag(bar.find(`[data-testid="rc-layer-${second}"]`).element, 'dragstart', dt)
    fireDrag(bar.find(`[data-testid="rc-layer-${third}"]`).element, 'dragover', dt)
    fireDrag(bar.find(`[data-testid="rc-layer-${third}"]`).element, 'drop', dt)
    expect(store.components.map((c) => c.id)).not.toEqual(original)

    store.undo()
    expect(store.components.map((c) => c.id)).toEqual(original)
  })

  it('上移/下移按钮仍工作（拖拽是补充不是替代）', async () => {
    const { basics, second, third, bar } = await mountLayers()
    // 用中间那行：最后一行的「下移」是 disabled（到头了），点了也不会动
    const contentRow = bar.find(`[data-testid="rc-layer-${second}"]`)
    expect(contentRow.findAll('button').length).toBeGreaterThanOrEqual(3)

    const up = contentRow.find('[title="上移"]')
    const down = contentRow.find('[title="下移"]')
    expect(up.exists()).toBe(true)
    expect(down.exists()).toBe(true)

    await up.trigger('click')
    expect(store.components.map((c) => c.id)).toEqual([second, basics?.id, third])
    await down.trigger('click')
    expect(store.components.map((c) => c.id)).toEqual([basics?.id, second, third])
  })

  it('拖拽悬停时画指示线（内联样式，不新增类名）', async () => {
    const { second, third, bar } = await mountLayers()
    const dt = new FakeDataTransfer()

    fireDrag(bar.find(`[data-testid="rc-layer-${second}"]`).element, 'dragstart', dt)
    const target = bar.find(`[data-testid="rc-layer-${third}"]`)
    fireDrag(target.element, 'dragover', dt)
    // Vue 的 :style 是异步 patch 的，等一帧再看 DOM
    await nextTick()

    expect(target.attributes('style')).toContain('border-top: 2px solid var(--rc-accent)')
    // 没有引入任何 drag-over 类名
    expect(target.classes()).not.toContain('layerrow--over')
  })
})

describe('C. 纸面片段拖动排序', () => {
  it('拖 .p-piece 到另一 .p-piece → moveComponentTo 生效', () => {
    const first = store.addComponent('skills')
    const second = store.addComponent('awards')
    const canvas = mount(CanvasView)
    // 先确认纸面片段真的渲染出来了，否则 find 到空节点会让后面的拖拽变成静默 no-op
    expect(canvas.findAll('.p-piece').length).toBeGreaterThanOrEqual(2)

    const dt = new FakeDataTransfer()
    const from = canvas.find(`[data-testid="rc-box-${first}"]`)
    const to = canvas.find(`[data-testid="rc-box-${second}"]`)
    expect(from.attributes('draggable')).toBe('true')

    fireDrag(from.element, 'dragstart', dt)
    fireDrag(to.element, 'dragover', dt)
    fireDrag(to.element, 'drop', dt)

    expect(store.components.map((c) => c.id)).toEqual([store.doc.components[0]?.id, second, first])
  })
})
