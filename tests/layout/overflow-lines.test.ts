/**
 * overLines（layout-3）回归测试
 *
 * 钉住 team-lead 2026-10-30 的限缩裁决：
 *  1. **只在 `overflow-page` 产出**（分页续排不是溢出，不标红）
 *  2. 内容逐字取自 `TextRunSpec.text`（与纸面/导出同一份文本）
 *  3. 取不到就是 `undefined`，禁止空数组冒充
 *  4. `LAYOUT_ENGINE_VERSION` 升到 `layout-3`（行为变了）
 */

import { describe, expect, it } from 'vitest'

import { LAYOUT_ENGINE_VERSION, composeLayout } from '../../src/layout/compose'
import type { Measurer } from '../../src/layout/compose'
import { documentTextBlocks } from '../../src/layout/text-runs'
import { createComponent, createDocument } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'

const NOW = '2026-10-30T00:00:00.000Z'

/** 确定性测量器：等宽近似，与 tests/layout/compose.test.ts 同款（jsdom/node 都稳定） */
const measurer: Measurer = (text, style, maxWidth) => {
  const em = (style.fontSizePt / 72) * 96
  const lineHeightPx = (style.lineHeight ?? 1.55) * em
  const width = text.length * em * 0.55
  const safeMax = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : Number.POSITIVE_INFINITY
  const lines = Math.max(1, Math.ceil(width / safeMax))
  return {
    width: Math.min(width, safeMax),
    height: lines * lineHeightPx,
    lineBreaks: [],
    lines: [],
    cached: false,
    backend: 'approximate',
    reliable: false,
  }
}

/** 构造一个"单块高过整页"的文档 → 必然产出 overflow-page */
function makeOverflowDoc(): ResumeDocument {
  return createDocument({
    documentId: 'doc_ovf',
    now: NOW,
    createdAt: NOW,
    components: [
      createComponent({
        id: 'c_edu',
        type: 'education',
        order: 0,
        fields: {
          school: '华南理工大学',
          major: '计算机',
          courses: Array.from({ length: 12 }, (_, i) => `课程 ${i + 1}`),
        },
      }),
    ],
    // 内容区只有 20mm：MIN_FRAGMENT 是 24，任何块都塞不进，走"空页都放不下"分支
    pageSettings: {
      heightMm: 60,
      marginTopMm: 20,
      marginRightMm: 20,
      marginBottomMm: 20,
      marginLeftMm: 20,
    },
  })
}

describe('overLines 只在 overflow-page 出现', () => {
  it('overflow-page 有 overLines；其他警告类型一律 undefined', () => {
    // 场景一：溢出
    const overflowed = composeLayout(makeOverflowDoc(), { measurer })
    const overflows = overflowed.warnings.filter((w) => w.type === 'overflow-page')
    expect(overflows.length).toBeGreaterThan(0)
    for (const warning of overflows) {
      expect(warning.overLines).toBeDefined()
      expect((warning.overLines ?? []).length).toBeGreaterThan(0)
    }

    // 场景二：多页 → page-count（suggestion），它必须是 undefined
    const doc = createDocument({
      documentId: 'doc_many',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({
          id: 'c_long',
          type: 'experience',
          order: 0,
          fields: {
            company: '某公司',
            bullets: Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 条：${'内容'.repeat(60)}`),
          },
        }),
      ],
    })
    const crowded = composeLayout(doc, { measurer, suggestedMaxPages: 1 })
    const other = crowded.warnings.filter((w) => w.type !== 'overflow-page')
    expect(other.length).toBeGreaterThan(0) // 至少有 page-count
    for (const warning of other) {
      expect(warning.overLines).toBeUndefined()
    }
  })

  it('分页续排不是溢出：跨页组件不产生 overLines', () => {
    const doc = createDocument({
      documentId: 'doc_split',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({
          id: 'c_long',
          type: 'experience',
          order: 0,
          fields: {
            company: '某公司',
            bullets: Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 条：${'内容'.repeat(60)}`),
          },
        }),
      ],
    })
    const result = composeLayout(doc, { measurer })
    // 跨页了（多个片段）
    const fragments = result.boxes.filter((b) => b.componentId === 'c_long')
    expect(fragments.length).toBeGreaterThan(1)
    // 但没有任何 overflow-page，也就没有任何 overLines
    expect(result.warnings.filter((w) => w.type === 'overflow-page')).toHaveLength(0)
    expect(result.warnings.every((w) => w.overLines === undefined)).toBe(true)
  })
})

describe('overLines 的内容口径', () => {
  it('逐字取自 run.text（与纸面/导出同一份文本）', () => {
    const doc = makeOverflowDoc()
    const result = composeLayout(doc, { measurer })
    const warning = result.warnings.find((w) => w.type === 'overflow-page')
    expect(warning).toBeDefined()

    const runTexts = new Set(
      documentTextBlocks(doc)
        .flatMap((block) => block.runs)
        .map((run) => run.text),
    )
    for (const line of warning?.overLines ?? []) {
      expect(runTexts.has(line)).toBe(true)
    }
  })

  it('取不到就 undefined，不给空数组（[] 与 undefined 语义不同）', () => {
    // 只有一个短组件的文档：没有溢出，也就没有 overLines —— 且不是 []
    const doc = createDocument({
      documentId: 'doc_short',
      now: NOW,
      createdAt: NOW,
      components: [createComponent({ id: 'c_one', type: 'basics', order: 0, fields: { name: '张明' } })],
    })
    const result = composeLayout(doc, { measurer })
    expect(result.warnings.every((w) => w.overLines === undefined)).toBe(true)
  })
})

describe('引擎版本', () => {
  it('LAYOUT_ENGINE_VERSION = layout-3，inputHash 带版本前缀', () => {
    const result = composeLayout(makeOverflowDoc(), { measurer })
    expect(LAYOUT_ENGINE_VERSION).toBe('layout-3')
    expect(result.engineVersion).toBe('layout-3')
    expect(result.inputHash.startsWith('layout-3:')).toBe(true)
  })
})
