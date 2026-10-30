// @vitest-environment jsdom
/**
 * 03 导入向导「预览确认」屏回归测试（矩阵 P2 第一项）
 *
 * 唯一事实源：docs/design/mockups/figma/03-import.html。验收点：
 *  1. 预览屏 DOM 照设计稿：.importgrid 双栏、左栏 .docpaper 完整原文、右栏
 *     .rcard 数量 = blocks + pending，待确认卡带 .rcard--pending
 *  2. stepper 收敛为设计稿 3 步（选择文件 / 解析中 / 预览确认），当前高亮第 3 步
 *  3. 确认导入门控：待确认队列 = 低置信度块 + 全部 pending 项，有未决策项时
 *     disabled（只决策 pending 不够，低置信度块也是真决策）；队列清空才 enabled
 *  4. emit 载荷：blocks = 高置信度块 + 被接受的低置信度块（跳过的不在）；
 *     pending 只含被接受的（跳过的不在）
 *  5. 决策是纯 UI 态：不产生 store commit（canUndo 不变），也不提前 emit
 *
 * 向导内解析用 setTimeout 1500ms，测试用 fake timers 推进。
 */

import { mount } from '@vue/test-utils'
import type { DOMWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { PendingItem, RecognizedBlock } from '../../src/io/recognition-provider'
import { useEditorStore } from '../../src/state/editor-store'
import ImportWizard from '../../src/ui/import-wizard/ImportWizard.vue'

type Store = ReturnType<typeof useEditorStore>

let store: Store

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** 走完 select → progress → preview：给隐藏的 file input 塞一个文件再推进 1500ms 模拟解析 */
async function gotoPreview() {
  const wrapper = mount(ImportWizard)

  const input = wrapper.find('input[type="file"]')
  const file = new File(['dummy'], '张明_原始简历.docx')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')

  // 解析中步
  expect(wrapper.find('.checkitem').exists()).toBe(true)
  expect(wrapper.text()).toContain('正在解析')

  await vi.advanceTimersByTimeAsync(1500)
  await nextTick()
  return wrapper
}

/** pending 卡 = 带 .rcard__hint 的卡（识别块卡没有 hint） */
function pendingCardsOf(cards: DOMWrapper<Element>[]): DOMWrapper<Element>[] {
  return cards.filter((card) => card.find('.rcard__hint').exists())
}

/** 按显示名找块卡（work 块经别名归一后显示名为「工作 / 实习经历」） */
function blockCardNamed(cards: DOMWrapper<Element>[], name: string): DOMWrapper<Element> {
  const found = cards.find((card) => card.find('.rcard__name').text() === name)
  if (found === undefined) throw new Error(`找不到块卡：${name}`)
  return found
}

/** 在指定卡上点「接受 / 跳过」（真决策：进门控与 emit 载荷） */
async function decideInCard(card: DOMWrapper<Element>, label: '接受' | '跳过'): Promise<void> {
  const btn = card.findAll('button').find((b) => b.text() === label)
  if (btn === undefined) throw new Error(`卡上找不到「${label}」按钮`)
  await btn.trigger('click')
}

describe('03 导入向导 · 预览确认（照 03-import.html）', () => {
  it('预览屏 DOM 照设计稿：.importgrid 双栏 + .docpaper 原文 + .rcard × (blocks + pending)', async () => {
    const wrapper = await gotoPreview()

    // 双栏结构
    expect(wrapper.find('.importgrid').exists()).toBe(true)
    const panels = wrapper.findAll('.panel')
    expect(panels).toHaveLength(2)

    // 左栏：原始文档
    expect(panels[0]?.find('.panel__title').text()).toContain('原始文档')
    expect(panels[0]?.find('.panel__head').text()).toContain('第三方导入 · 3 个内容块')
    const docpaper = panels[0]?.find('.docpaper')
    expect(docpaper?.exists()).toBe(true)
    expect(docpaper?.find('.docpaper__photo').text()).toContain('照片占位')
    expect(docpaper?.find('.docpaper__name').text()).toBe('张明')

    // 左栏完整原文：三个块的文字 + 两个 pending 的 raw 一个字节不丢
    expect(docpaper?.text()).toContain('张明 · 前端工程师')
    expect(docpaper?.text()).toContain('华南理工大学 · 软件工程')
    expect(docpaper?.text()).toContain('字节跳动 · 前端工程师')
    expect(docpaper?.text()).toContain('一段无法识别的文字内容')
    expect(docpaper?.text()).toContain('另一段待处理内容')

    // 章节型块进 h3（经别名归一的注册表 displayName）；basics 不进 h3
    const headings = docpaper?.findAll('h3').map((h) => h.text()) ?? []
    expect(headings).toEqual(['教育经历', '工作 / 实习经历'])

    // 低置信度块（work 0.7 < 0.8）的文字行带 .doc-hl
    expect((docpaper?.findAll('.doc-hl').length ?? 0) > 0).toBe(true)

    // 右栏：识别到的结构化结果
    expect(panels[1]?.find('.panel__title').text()).toContain('识别到的结构化结果')
    // 已确认 N / M：M = 块数 + pending 数（3 + 2 = 5，设计稿 4/6 的 6 即总卡数）；
    // N = 高置信度块数（basics 0.9、education 0.8）+ 已接受决策数（初始 0）= 2
    expect(wrapper.text()).toContain('已确认 2 / 5')
    expect(wrapper.text()).toContain('请逐项核对。表格、文本框与浮动图片需要人工确认。')

    // rcard 数量 = blocks(3) + pending(2)；待确认 = work 块 + 2 个 pending 项
    expect(wrapper.findAll('.rcard')).toHaveLength(5)
    expect(wrapper.findAll('.rcard--pending')).toHaveLength(3)
    // 待确认徽标：work 块 + 2 个 pending 项各一张 badge--warn
    expect(wrapper.findAll('.badge--warn')).toHaveLength(3)

    // 识别块卡名走注册表 displayName（work 经别名归一 → experience）
    expect(wrapper.text()).toContain('基本信息')
    expect(wrapper.text()).toContain('工作 / 实习经历')
    // pending 卡无 suggestedType → 「未识别内容」；无置信度故不显示 conf
    expect(wrapper.findAll('.rcard__conf')).toHaveLength(3)
    expect(wrapper.text()).toContain('未识别内容')
    expect(wrapper.text()).toContain('无法识别所属组件')
  })

  it('stepper 收敛为设计稿 3 步：选择文件 / 解析中 / 预览确认，当前高亮第 3 步', async () => {
    const wrapper = await gotoPreview()

    const steps = wrapper.findAll('.step')
    expect(steps).toHaveLength(3)
    expect(steps[0]?.text()).toBe('选择文件')
    expect(steps[1]?.text()).toBe('解析中')
    expect(steps[2]?.text()).toContain('预览确认')

    // 前两步 done：step__no 里是 check 图标（不是数字）
    expect(wrapper.findAll('.step--done')).toHaveLength(2)
    expect(wrapper.find('.step--done .step__no .ic').exists()).toBe(true)
    // 当前态放数字
    expect(wrapper.find('.step--on .step__no').text()).toBe('3')
    // 步骤间 step__line（两步各一条，均已完成的连线带 --done）
    expect(wrapper.findAll('.step__line')).toHaveLength(2)
    expect(wrapper.findAll('.step__line--done')).toHaveLength(2)
  })

  it('确认导入门控：队列含低置信度块，未决策 disabled；只决策 pending 不够；清空才 enabled', async () => {
    const wrapper = await gotoPreview()
    const cards = () => wrapper.findAll('.rcard')
    const confirmBtn = () => wrapper.find('.dialog__foot .btn--primary')

    // 待确认队列 = work 块（0.7 < 0.8）+ 2 个 pending 项 = 3 项
    expect(wrapper.find('.actionbar__desc').text()).toBe('还有 3 项待确认，确认后可导入')
    expect(confirmBtn().attributes('aria-disabled')).toBe('true')

    // 只把两个 pending 项决策掉：低置信度块仍未决策，门控不放行（块也是真决策）
    await decideInCard(pendingCardsOf(cards())[0]!, '接受')
    await decideInCard(pendingCardsOf(cards())[1]!, '跳过')
    expect(wrapper.find('.actionbar__desc').text()).toBe('还有 1 项待确认，确认后可导入')
    expect(confirmBtn().attributes('aria-disabled')).toBe('true')

    // 低置信度块也决策掉：队列清空，放行
    await decideInCard(blockCardNamed(cards(), '工作 / 实习经历'), '接受')
    expect(wrapper.find('.actionbar__desc').text()).toBe('还有 0 项待确认，确认后可导入')
    expect(confirmBtn().attributes('aria-disabled')).toBeUndefined()
  })

  it('emit 载荷：跳过低置信度块 → blocks 不含它；pending 只含被接受的', async () => {
    const wrapper = await gotoPreview()
    const cards = () => wrapper.findAll('.rcard')

    // work 块（0.7 低置信度）跳过；pending0 接受、pending1 跳过
    await decideInCard(blockCardNamed(cards(), '工作 / 实习经历'), '跳过')
    await decideInCard(pendingCardsOf(cards())[0]!, '接受')
    await decideInCard(pendingCardsOf(cards())[1]!, '跳过')

    await wrapper.find('.dialog__foot .btn--primary').trigger('click')

    const emitted = wrapper.emitted('import') as unknown[][] | undefined
    expect(emitted).toHaveLength(1)
    const [blocks, pending] = emitted![0] as [RecognizedBlock[], PendingItem[]]

    // 跳过的 work 块不在载荷里；高置信度块全量在（跳过不再是假状态）
    expect(blocks.map((b) => b.type)).toEqual(['basics', 'education'])
    // pending 只含被接受的那条；跳过的由用户显式放弃，不在载荷里
    expect(pending).toHaveLength(1)
    expect(pending[0]?.raw).toBe('一段无法识别的文字内容')
  })

  it('emit 载荷：接受低置信度块 → blocks 含它', async () => {
    const wrapper = await gotoPreview()
    const cards = () => wrapper.findAll('.rcard')

    // work 块接受；pending0 接受、pending1 跳过
    await decideInCard(blockCardNamed(cards(), '工作 / 实习经历'), '接受')
    await decideInCard(pendingCardsOf(cards())[0]!, '接受')
    await decideInCard(pendingCardsOf(cards())[1]!, '跳过')

    await wrapper.find('.dialog__foot .btn--primary').trigger('click')

    const emitted = wrapper.emitted('import') as unknown[][] | undefined
    expect(emitted).toHaveLength(1)
    const [blocks, pending] = emitted![0] as [RecognizedBlock[], PendingItem[]]

    expect(blocks.map((b) => b.type)).toEqual(['basics', 'education', 'work'])
    expect(pending.map((p) => p.raw)).toEqual(['一段无法识别的文字内容'])
  })

  it('决策过程是纯 UI 态：不产生 store commit（canUndo 不变），也不提前 emit', async () => {
    const wrapper = await gotoPreview()
    const cards = () => wrapper.findAll('.rcard')

    // 造一段有历史记录的文档，让 canUndo 为 true（否则「不变」没有区分度）
    store.newDocument('blank')
    store.addComponent('education')
    expect(store.canUndo).toBe(true)
    const docBefore = JSON.stringify(store.doc)

    await decideInCard(blockCardNamed(cards(), '工作 / 实习经历'), '跳过')
    await decideInCard(pendingCardsOf(cards())[0]!, '接受')
    await decideInCard(pendingCardsOf(cards())[1]!, '跳过')

    // 契约 §10.4：决策不进文档模型、不进 undo 栈
    expect(JSON.stringify(store.doc)).toBe(docBefore)
    expect(store.canUndo).toBe(true)
    // 只有点「确认导入」才 emit（落盘由调用方一次 commit 完成）
    expect(wrapper.emitted('import')).toBeUndefined()
  })
})
