/**
 * TC-006 第一段：单位换算层回归测试
 * 对照：CONTRACT §4（四向换算，唯一换算层）+ FR-LAY-010（确定性）
 *
 * 重点不是"能不能转换"，而是：
 *  1. 基准值必须精确（1in = 72pt = 96px = 25.4mm = 144halfPt）
 *  2. 连续换算不能掉精度（不许中途取整）
 *  3. 非有限输入返回 NaN 而不是抛
 */

import { describe, expect, it } from 'vitest'

import {
  A4_MM,
  MM_PER_INCH,
  PX_PER_INCH,
  PT_PER_INCH,
  UNITS_PER_INCH,
  a4SizePx,
  convert,
  fromPx,
  mmToPx,
  nearlyEqual,
  ptToPx,
  pxToMm,
  pxToPt,
  quantize,
  roundPx,
  toPx,
} from '../../src/layout/units'
import type { LengthUnit } from '../../src/layout/units'

const ALL_UNITS: LengthUnit[] = ['px', 'pt', 'mm', 'halfPt']

describe('基准：一英寸的四种表达必须精确互换', () => {
  it('1in = 96px = 72pt = 25.4mm = 144halfPt', () => {
    expect(convert(1, 'px', 'pt')).toBeCloseTo(0.75, 12)
    expect(convert(1, 'px', 'mm')).toBeCloseTo(25.4 / 96, 12)
    expect(convert(1, 'pt', 'px')).toBeCloseTo(4 / 3, 12)
    expect(convert(1, 'mm', 'px')).toBeCloseTo(96 / 25.4, 12)
    expect(convert(1, 'halfPt', 'pt')).toBe(0.5)
    expect(convert(1, 'pt', 'halfPt')).toBe(2)
  })

  it('常数与表一致', () => {
    expect(UNITS_PER_INCH.px).toBe(PX_PER_INCH)
    expect(UNITS_PER_INCH.pt).toBe(PT_PER_INCH)
    expect(UNITS_PER_INCH.mm).toBe(MM_PER_INCH)
    expect(UNITS_PER_INCH.halfPt).toBe(PT_PER_INCH * 2)
  })

  it('同单位换算是恒等', () => {
    for (const unit of ALL_UNITS) {
      expect(convert(37.5, unit, unit)).toBe(37.5)
    }
  })
})

describe('往返：任意两单位来回换不掉精度', () => {
  it('12 种组合各跑一遍', () => {
    const samples = [1, 10.5, 210, 1123, 0.25, 1234.5678]
    for (const from of ALL_UNITS) {
      for (const to of ALL_UNITS) {
        for (const value of samples) {
          const there = convert(value, from, to)
          const back = convert(there, to, from)
          // 不允许中途取整，所以相对误差应到 1e-10 以下
          expect(Math.abs(back - value)).toBeLessThan(Math.max(1e-9, Math.abs(value) * 1e-10))
        }
      }
    }
  })

  it('toPx / fromPx 互为逆运算', () => {
    for (const unit of ALL_UNITS) {
      const px = toPx(10.5, unit)
      expect(fromPx(px, unit)).toBeCloseTo(10.5, 10)
    }
  })
})

describe('具名换算函数', () => {
  it('mm ↔ px', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10)
    expect(pxToMm(96)).toBeCloseTo(25.4, 10)
  })

  it('pt ↔ px：10.5pt 字号 = 14px', () => {
    // 简历正文 10.5pt，屏幕上是 14px —— 这个值必须钉死
    expect(ptToPx(10.5)).toBeCloseTo(14, 10)
    expect(pxToPt(14)).toBeCloseTo(10.5, 10)
  })

  it('Word 半磅：五号字 21 halfPt = 10.5pt', () => {
    expect(convert(21, 'halfPt', 'pt')).toBe(10.5)
    expect(convert(21, 'halfPt', 'px')).toBeCloseTo(14, 10)
  })
})

describe('A4 尺寸', () => {
  it('物理尺寸是 210 × 297 mm', () => {
    expect(A4_MM.width).toBe(210)
    expect(A4_MM.height).toBe(297)
  })

  it('取整后与设计 token 的 794 × 1123 一致', () => {
    const size = a4SizePx('portrait', true)
    expect(size.width).toBe(794)
    expect(size.height).toBe(1123)
  })

  it('不取整时保留小数，且比取整值略小', () => {
    const raw = a4SizePx('portrait', false)
    expect(raw.width).toBeLessThan(794)
    expect(raw.width).toBeGreaterThan(793.6)
    expect(raw.height).toBeLessThan(1123)
  })

  it('横向交换宽高', () => {
    const portrait = a4SizePx('portrait')
    const landscape = a4SizePx('landscape')
    expect(landscape.width).toBe(portrait.height)
    expect(landscape.height).toBe(portrait.width)
  })
})

describe('取整与量化', () => {
  it('roundPx 走最近整数', () => {
    expect(roundPx(793.700787)).toBe(794)
    expect(roundPx(793.4)).toBe(793)
    expect(roundPx(-0.4)).toBe(-0)
  })

  it('quantize 压掉浮点尾巴', () => {
    expect(quantize(12.000000001, 3)).toBe(12)
    expect(quantize(12.34567, 2)).toBe(12.35)
    expect(quantize(12.34567, 0)).toBe(12)
  })

  it('quantize 的 digits 越界按边界处理，不抛', () => {
    expect(() => quantize(1.5, -3)).not.toThrow()
    expect(quantize(1.5, -3)).toBe(2)
    expect(() => quantize(1.5, 99)).not.toThrow()
    expect(quantize(1.5, 99)).toBe(1.5)
  })
})

describe('非有限输入：返回 NaN，不抛异常（契约 §11.1）', () => {
  it('NaN 与 Infinity 穿透为 NaN', () => {
    expect(Number.isNaN(convert(Number.NaN, 'pt', 'px'))).toBe(true)
    expect(Number.isNaN(convert(Number.POSITIVE_INFINITY, 'pt', 'px'))).toBe(true)
    expect(Number.isNaN(toPx(Number.NaN, 'mm'))).toBe(true)
    expect(Number.isNaN(fromPx(Number.POSITIVE_INFINITY, 'mm'))).toBe(true)
    expect(Number.isNaN(mmToPx(Number.NaN))).toBe(true)
    expect(Number.isNaN(roundPx(Number.NaN))).toBe(true)
    expect(Number.isNaN(quantize(Number.NaN))).toBe(true)
  })

  it('nearlyEqual 遇到非有限数返回 false', () => {
    expect(nearlyEqual(Number.NaN, Number.NaN)).toBe(false)
    expect(nearlyEqual(1, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('nearlyEqual 的容差语义', () => {
    expect(nearlyEqual(793.700787, 793.7)).toBe(true)
    expect(nearlyEqual(793.700787, 794)).toBe(false)
    expect(nearlyEqual(794, 794.01)).toBe(true)
    expect(nearlyEqual(794, 794.02)).toBe(false)
  })
})

describe('确定性（FR-LAY-010）', () => {
  it('同输入连跑十次结果完全一致', () => {
    const first = convert(1234.5678, 'mm', 'px')
    for (let i = 0; i < 10; i += 1) {
      expect(convert(1234.5678, 'mm', 'px')).toBe(first)
    }
  })
})
