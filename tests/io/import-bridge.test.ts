/**
 * 导入落盘桥（🔴）回归测试
 *
 * 钉住「一个字节都不能丢」的四条：
 *  1. 类型映射正确（含 work→experience 等别名归一）
 *  2. 识别不到的字段留 `''` / `[]`，不编造
 *  3. 未知块进 `UnknownComponent`，`raw` 保留原文
 *  4. 一次 commit：`undo()` 整体回退
 *  5. 往返：`documentTextBlocks` 的文本 ⊆ 识别块原文
 */

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { pendingItemsToComponents, recognizedBlocksToComponents } from '../../src/io/import-bridge'
import type { RecognizedBlock } from '../../src/io/recognition-provider'
import { documentTextBlocks } from '../../src/layout/text-runs'
import type { AnyComponent, ResumeComponent, UnknownComponent } from '../../src/model/types'
import { useEditorStore } from '../../src/state/editor-store'

type Store = ReturnType<typeof useEditorStore>

let store: Store

function makeBlock(
  type: string,
  text: string,
  fields: Record<string, string>,
): RecognizedBlock {
  return { type, text, confidence: 0.9, sourceLocation: 'p0', fields }
}

function asKnown(component: AnyComponent): ResumeComponent {
  if ('unknown' in component) throw new Error('期望已知组件')
  return component
}

function asUnknown(component: AnyComponent): UnknownComponent {
  if (!('unknown' in component)) throw new Error('期望 UnknownComponent')
  return component
}

const BLOCKS: RecognizedBlock[] = [
  makeBlock('basics', '张明 · 138 0013 8000', { name: '张明', phone: '138 0013 8000' }),
  makeBlock('education', '华南理工大学 · 软件工程', { school: '华南理工大学', major: '软件工程' }),
  makeBlock('work', '字节跳动 · 前端工程师', { company: '字节跳动', role: '前端工程师' }),
  makeBlock('project', '校招通', { name: '校招通', role: '前端负责人' }),
  makeBlock('skills', 'TypeScript / React', { name: 'TypeScript / React' }),
  makeBlock('award', '国家奖学金', { name: '国家奖学金' }),
  makeBlock('future-widget', '一段看不懂的内容', { note: '原样保留' }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  store = useEditorStore()
})

describe('类型映射', () => {
  it('识别块类型正确映射（含 work→experience / project→projects / award→awards）', () => {
    const components = recognizedBlocksToComponents(BLOCKS, 0, 'zh')
    const types = components.map((c) => c.type)
    expect(types).toEqual([
      'basics',
      'education',
      'experience',
      'projects',
      'skills',
      'awards',
      'future-widget',
    ])
  })

  it('order 从 orderStart 起连续编号', () => {
    const components = recognizedBlocksToComponents(BLOCKS.slice(0, 3), 5, 'zh')
    expect(components.map((c) => c.order)).toEqual([5, 6, 7])
  })
})

describe('不编造', () => {
  it('识别不到的字段留空串/空数组，不是 undefined', () => {
    const components = recognizedBlocksToComponents([BLOCKS[2]!], 0, 'zh')
    const fields = asKnown(components[0]!).fields

    // work → experience 的 schema：company / role 被填上，bullets 等留默认
    expect(fields.company).toBe('字节跳动')
    expect(fields.role).toBe('前端工程师')
    expect(fields.bullets).toEqual([])
    expect(fields.start).toBe('')
    expect(fields.end).toBe('')
    // 一个 undefined 都不许有
    for (const value of Object.values(fields)) {
      expect(value).not.toBeUndefined()
    }
  })

  it('列表字段按行拆，空行不制造条目', () => {
    const block = makeBlock('work', 'x', { company: 'A', bullets: '第一条\n\n第二条\n' })
    const components = recognizedBlocksToComponents([block], 0, 'zh')
    expect(asKnown(components[0]!).fields.bullets).toEqual(['第一条', '第二条'])
  })
})

describe('未知块与待处理项', () => {
  it('未知类型进 UnknownComponent，raw 保留原文与未识别字段', () => {
    const components = recognizedBlocksToComponents([BLOCKS[6]!], 0, 'zh')
    const unknown = asUnknown(components[0]!)

    expect(unknown.unknown).toBe(true)
    expect(unknown.originalType).toBe('future-widget')
    expect(unknown.raw.text).toBe('一段看不懂的内容')
    expect(unknown.raw.note).toBe('原样保留')
    expect(unknown.raw.confidence).toBe(0.9)
  })

  it('pending 项落成 UnknownComponent，原文与原因都在', () => {
    const pending = pendingItemsToComponents(
      [{ raw: '一段无法识别的文字内容', reason: '无法识别所属组件' }],
      3,
    )
    expect(pending).toHaveLength(1)
    expect(pending[0]!.unknown).toBe(true)
    expect(pending[0]!.order).toBe(3)
    expect(pending[0]!.raw.text).toBe('一段无法识别的文字内容')
    expect(pending[0]!.raw.reason).toBe('无法识别所属组件')
  })
})

describe('一次 commit（单步可撤销）', () => {
  it('整批导入后 undo 一次全部回退', () => {
    const before = store.components.length
    const incoming = [
      ...recognizedBlocksToComponents(BLOCKS, before, 'zh'),
      ...pendingItemsToComponents([{ raw: '没识别的内容', reason: 'x' }], before + BLOCKS.length),
    ]
    store.importComponents(incoming)

    expect(store.components.length).toBe(before + BLOCKS.length + 1)

    // 一步撤销：整批回退（若是逐个 commit，第一次 undo 只会少一个）
    store.undo()
    expect(store.components.length).toBe(before)
  })

  it('空列表不产生 commit', () => {
    store.importComponents([])
    expect(store.canUndo).toBe(false)
  })
})

describe('往返：文本不丢', () => {
  /**
   * 「没有丢字」的可判定口径（v2 的 contact / 日期是多字段合并成一行的，
   * 所以不能要求"整行等于某段原文"，要按**片段**核）：
   *  A. 每个非空识别字段值都能在文档里找到（没丢）
   *  B. 渲染文本按 `·` 拆成片段后，每片都能在原文里找到（没编）
   * 例外：`section` 角色是引擎合成的小节标题（displayName），不在识别块里。
   */
  it('识别块原文一字不丢，渲染文本一字不编', () => {
    const before = store.components.length
    const incoming = [
      ...recognizedBlocksToComponents(BLOCKS, before, 'zh'),
      ...pendingItemsToComponents([{ raw: '没识别的内容', reason: 'x' }], before + BLOCKS.length),
    ]
    store.importComponents(incoming)

    // 原文清单要覆盖**所有会被渲染的文本叶子**：字段值 + 未知块的 text/reason/sourceLocation
    // （unknown 组件的 raw 会被 text-runs 递归收叶子，所以 reason/sourceLocation 也会渲染）
    const sourceText: string[] = []
    for (const block of BLOCKS) {
      const values = Object.values(block.fields).filter((value) => value !== '')
      if (values.length === 0) {
        // 无字段的块：整条原文必须能在文档里找到
        sourceText.push(block.text)
      } else {
        // 有字段的块：原文被拆进各字段（如「张明 · 138…」→ name + phone），
        // 逐个字段值核就够，不苛求整行原样重现
        sourceText.push(...values)
      }
      sourceText.push(block.sourceLocation)
    }
    sourceText.push('没识别的内容')
    sourceText.push('x')

    // B 用的超集：未知块的 raw.text / raw.note 也会被渲染，所以 block.text 必须进清单
    // （A 的口径更严：有字段的块按字段值核，无字段的块按整条原文核）
    const sourceSuperset = [...sourceText]
    for (const block of BLOCKS) sourceSuperset.push(block.text)

    const rendered = documentTextBlocks(store.doc).flatMap((block) => block.runs)
    const renderedText = rendered.map((run) => run.text).join('\n')

    // A. 没丢：字段值与 pending 原文都要能在文档里找到
    for (const source of sourceText) {
      if (source === '') continue
      const inDoc =
        renderedText.includes(source) ||
        store.doc.components.some(
          (c) => 'unknown' in c && c.unknown === true && String(c.raw.text ?? '').includes(source),
        )
      expect(inDoc).toBe(true)
    }

    // B. 没编：渲染文本（除 section 外）按 · 拆片后都在原文里
    for (const run of rendered) {
      if (run.role === 'section') continue
      const segments = run.text
        .split('\u00b7')
        .map((seg) => seg.trim())
        .filter((seg) => seg !== '')
      for (const segment of segments) {
        const found = sourceSuperset.some(
          (source) => source.includes(segment) || segment.includes(source),
        )
        expect(found).toBe(true)
      }
    }
  })
})
