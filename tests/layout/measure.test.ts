/**
 * TC-006 段②：测量层回归测试
 * 对照：CONTRACT §4（纯函数 / 不读 DOM 布局 / 降级必须显式）+ FR-LAY-010（确定性）
 *
 * 策略：换行逻辑用**等宽假后端**测（10px/字符看得很清楚），
 *       不使用真实 canvas —— 真实测量的绝对值依赖字体，不适合做断言。
 */

import { describe, expect, it } from 'vitest'

import {
  createApproximateBackend,
  createCanvasBackend,
  createDefaultBackend,
  createMeasurer,
  fontCss,
  fontSizePx,
  pxWidthToPt,
  wrapText,
} from '../../src/layout/measure'
import type { MeasureBackend, TextStyle } from '../../src/layout/measure'

const STYLE: TextStyle = { fontFamily: 'Inter, sans-serif', fontSizePt: 10.5 }

/** 每字符 10px 的假后端，换行边界一眼可见 */
const FIXED: MeasureBackend = {
  kind: 'canvas2d',
  measureWidth: (text) => text.length * 10,
}

const fixedWidth = (text: string) => text.length * 10

describe('字号与 font 串', () => {
  it('10.5pt 换算成 14px', () => {
    expect(fontSizePx(STYLE)).toBeCloseTo(14, 10)
  })

  it('fontCss 默认 400 字重、两位小数', () => {
    expect(fontCss(STYLE)).toBe('400 14px Inter, sans-serif')
    expect(fontCss({ ...STYLE, fontWeight: 600 })).toBe('600 14px Inter, sans-serif')
  })
})

describe('wrapText：贪心换行', () => {
  it('纯拉丁无空格时按宽度硬断', () => {
    const { lines, lineBreaks } = wrapText('abcdefghijklmno', 100, fixedWidth)
    expect(lines).toEqual(['abcdefghij', 'klmno'])
    expect(lineBreaks).toEqual([10, 15])
  })

  it('空格处优先断行，空格留在行尾', () => {
    const { lines } = wrapText('hello world', 60, fixedWidth)
    expect(lines).toEqual(['hello ', 'world'])
  })

  it('CJK 逐字可断', () => {
    const text = '一二三四五六七八九十一二' // 12 个字
    const { lines, lineBreaks } = wrapText(text, 70, fixedWidth)
    // 每字 10px，70px 一行装 7 字；余下 5 字（八九十一二）进第二行
    expect(text).toHaveLength(12)
    expect(lines).toEqual(['一二三四五六七', '八九十一二'])
    expect(lines[0]).toHaveLength(7)
    expect(lines[1]).toHaveLength(5)
    expect(lineBreaks).toEqual([7, 12])
  })

  it('lineBreaks 与各行长度累计一致', () => {
    const text = '一二三四五六七八九十一二'
    const { lines, lineBreaks } = wrapText(text, 70, fixedWidth)
    let cursor = 0
    for (let i = 0; i < lines.length; i += 1) {
      cursor += lines[i]!.length
      expect(lineBreaks[i]).toBe(cursor)
    }
    expect(cursor).toBe(text.length)
  })

  it('空串返回一个空行', () => {
    expect(wrapText('', 100, fixedWidth)).toEqual({ lines: [''], lineBreaks: [0] })
  })

  it('maxWidth 非正或非有限时不分行', () => {
    expect(wrapText('abcdef', 0, fixedWidth).lines).toEqual(['abcdef'])
    expect(wrapText('abcdef', Number.NaN, fixedWidth).lines).toEqual(['abcdef'])
  })

  it('超长单词不撑破版面（无断点也强制断）', () => {
    const { lines } = wrapText('abcdefghij', 30, fixedWidth)
    expect(lines).toEqual(['abc', 'def', 'ghi', 'j'])
  })
})

describe('createMeasurer：度量结果', () => {
  it('高度 = 行数 × 字号px × 行高倍数', () => {
    const { measure } = createMeasurer(FIXED)
    const m = measure('abcdefghijklmno', STYLE, 100)
    expect(m.lines).toHaveLength(2)
    // 14px × 1.55 = 21.7
    expect(m.height).toBeCloseTo(2 * 14 * 1.55, 10)
  })

  it('宽度取最宽一行', () => {
    const { measure } = createMeasurer(FIXED)
    const m = measure('abcdefghijklmno', STYLE, 100)
    expect(m.width).toBe(100)
  })

  it('自定义行高倍数生效', () => {
    const { measure } = createMeasurer(FIXED)
    const m = measure('abc', { ...STYLE, lineHeight: 1 }, 100)
    expect(m.height).toBeCloseTo(14, 10)
  })

  it('字距按「字符数」累加（含行尾，与 CSS 一致）', () => {
    // 依据：docs/verify/canvas-vs-dom.md §7 实测，CSS 的 letter-spacing 在每个字符后都加，
    // 按 (n-1) 算最大偏差 1.0043px，按 n 算 0.0093px。这里钉住 n 的语义，防止退回。
    const { measure } = createMeasurer(FIXED)
    const m = measure('abc', { ...STYLE, letterSpacingPx: 2 }, 1000)
    // 3 字符 = 30，加 3×2 字距 = 36（不是 34）
    expect(m.width).toBeCloseTo(36, 10)
  })

  it('单字符也带一个字距（行尾不吞）', () => {
    const { measure } = createMeasurer(FIXED)
    const m = measure('a', { ...STYLE, letterSpacingPx: 2 }, 1000)
    expect(m.width).toBeCloseTo(12, 10)
  })

  it('canvas2d 后端标记为可信', () => {
    const { measure } = createMeasurer(FIXED)
    expect(measure('a', STYLE, 100).backend).toBe('canvas2d')
    expect(measure('a', STYLE, 100).reliable).toBe(true)
  })

  it('近似后端标记为不可信（契约 §4：不许静默降级还声称可信）', () => {
    const { measure } = createMeasurer(createApproximateBackend())
    const m = measure('张明', STYLE, 100)
    expect(m.backend).toBe('approximate')
    expect(m.reliable).toBe(false)
  })
})

describe('缓存：只影响 cached，不影响数值', () => {
  it('第二次命中缓存且数值完全一致', () => {
    const { measure } = createMeasurer(FIXED)
    const first = measure('hello world', STYLE, 60)
    const second = measure('hello world', STYLE, 60)

    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(second.width).toBe(first.width)
    expect(second.height).toBe(first.height)
    expect(second.lines).toEqual(first.lines)
    expect(second.lineBreaks).toEqual(first.lineBreaks)
  })

  it('clearCache 后重新计为未命中', () => {
    const { measure, clearCache } = createMeasurer(FIXED)
    measure('hello', STYLE, 100)
    clearCache()
    expect(measure('hello', STYLE, 100).cached).toBe(false)
  })

  it('cacheSize 为 0 时不缓存', () => {
    const { measure } = createMeasurer(FIXED, { cacheSize: 0 })
    measure('hello', STYLE, 100)
    expect(measure('hello', STYLE, 100).cached).toBe(false)
  })

  it('不同 maxWidth 各自成键', () => {
    const { measure } = createMeasurer(FIXED)
    measure('hello world', STYLE, 60)
    expect(measure('hello world', STYLE, 120).cached).toBe(false)
  })
})

describe('后端选择', () => {
  it('createCanvasBackend 拿不到 context 时返回 null，不静默兜底', () => {
    expect(createCanvasBackend(() => null)).toBeNull()
  })

  it('注入假 context 时能用它测量', () => {
    let assignedFont = ''
    const backend = createCanvasBackend(() => ({
      set font(value: string) {
        assignedFont = value
      },
      get font() {
        return assignedFont
      },
      measureText: (text: string) => ({ width: text.length * 7 }),
    }))

    expect(backend).not.toBeNull()
    expect(backend?.kind).toBe('canvas2d')
    expect(backend?.measureWidth('abcd', STYLE)).toBe(28)
    expect(assignedFont).toBe('400 14px Inter, sans-serif')
  })

  it('Node 环境下默认后端是近似（无 document），且显式标记', () => {
    const backend = createDefaultBackend()
    expect(backend.kind).toBe('approximate')
  })
})

describe('确定性（FR-LAY-010）', () => {
  it('同输入连跑十次结果完全一致', () => {
    const { measure } = createMeasurer(FIXED)
    const first = measure('一二三四五六七八九十一二', STYLE, 70)
    for (let i = 0; i < 10; i += 1) {
      const again = measure('一二三四五六七八九十一二', STYLE, 70)
      expect(again.lines).toEqual(first.lines)
      expect(again.width).toBe(first.width)
      expect(again.height).toBe(first.height)
    }
  })

  it('近似后端对同串给出稳定值', () => {
    const backend = createApproximateBackend()
    const a = backend.measureWidth('张明 Zhang', STYLE)
    const b = backend.measureWidth('张明 Zhang', STYLE)
    expect(a).toBe(b)
    expect(a).toBeGreaterThan(0)
  })
})

describe('导出单位换算', () => {
  it('96px 宽度换成 72pt', () => {
    expect(pxWidthToPt(96)).toBe(72)
  })
})
