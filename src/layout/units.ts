/**
 * 单位换算层（TC-006）
 * 契约 §4：pt（PDF 点）/ px（CSS 像素）/ mm（页面物理尺寸）/ Word 半磅 四向换算，
 * **唯一换算层**——其它模块不许自己乘 96/25.4。
 *
 * 三条设计约束：
 *  1. 纯函数、无 DOM、无时钟、无随机数（FR-LAY-010 确定性）
 *  2. **换算过程不做中间取整**。取整只在"落到屏幕像素"那一步做，否则连续换两次会累积误差
 *  3. 输入非有限数（NaN / Infinity）时返回 NaN 而不是抛异常（契约 §11.1 返回结果不抛）
 *
 * 基准（英寸）：
 *   1 in = 72 pt = 96 px = 25.4 mm = 144 halfPt
 */

/** 长度单位。`halfPt` 是 Word 的字号单位（半磅），1 halfPt = 0.5 pt。 */
export type LengthUnit = 'pt' | 'px' | 'mm' | 'halfPt'

/** 每英寸对应的各单位数量。数值来源见文件头。 */
export const UNITS_PER_INCH: Readonly<Record<LengthUnit, number>> = Object.freeze({
  px: 96,
  pt: 72,
  mm: 25.4,
  halfPt: 144,
})

export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72
export const PX_PER_INCH = 96

/** A4 物理尺寸（mm）。纵向为基准，横向交换宽高。 */
export const A4_MM = Object.freeze({ width: 210, height: 297 })

/**
 * A4 在 96dpi 下的像素尺寸。`round` 后即设计 token 的 794 × 1123。
 * 注意 210mm 精确值是 793.700787…px，布局内部保留小数，只在渲染取整。
 */
export function mmToPx(mm: number): number {
  if (!Number.isFinite(mm)) return Number.NaN
  return (mm / MM_PER_INCH) * PX_PER_INCH
}

export function pxToMm(px: number): number {
  if (!Number.isFinite(px)) return Number.NaN
  return (px / PX_PER_INCH) * MM_PER_INCH
}

export function ptToPx(pt: number): number {
  if (!Number.isFinite(pt)) return Number.NaN
  return (pt / PT_PER_INCH) * PX_PER_INCH
}

export function pxToPt(px: number): number {
  if (!Number.isFinite(px)) return Number.NaN
  return (px / PX_PER_INCH) * PT_PER_INCH
}

/** 四向通用换算。先归一到英寸再乘目标比例，避免 12 条两两映射各写一遍。 */
export function convert(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) return Number.NaN
  if (from === to) return value
  const inches = value / UNITS_PER_INCH[from]
  return inches * UNITS_PER_INCH[to]
}

/** 归一到 CSS 像素，度量层内部统一用 px。 */
export function toPx(value: number, unit: LengthUnit): number {
  return convert(value, unit, 'px')
}

/** 从 CSS 像素换回目标单位，用于导出与界面显示。 */
export function fromPx(px: number, unit: LengthUnit): number {
  return convert(px, 'px', unit)
}

/**
 * 落到屏幕像素：最近整数。
 * 只用于「真正画到屏幕上」的最后一步；文档模型与布局结果必须保留小数。
 */
export function roundPx(px: number): number {
  if (!Number.isFinite(px)) return Number.NaN
  return Math.round(px)
}

/**
 * 量化到指定小数位。用于导出 PDF/DOCX 时压掉浮点尾巴（如 12.000000001）。
 * digits 取 0–6，超出范围按边界处理，不抛。
 */
export function quantize(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return Number.NaN
  const d = Math.min(6, Math.max(0, Math.trunc(digits)))
  const factor = 10 ** d
  return Math.round(value * factor) / factor
}

/** 判断两个长度在容差内相等。默认 0.01px，约等于「肉眼不可见」。 */
export function nearlyEqual(a: number, b: number, tolerance = 0.01): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= tolerance
}

export interface PageSizePx {
  width: number
  height: number
}

/**
 * A4 像素尺寸。`rounded` 默认 true（794 × 1123，与设计 token 一致）；
 * 布局引擎内部请传 false 拿精确值。
 */
export function a4SizePx(
  orientation: 'portrait' | 'landscape' = 'portrait',
  rounded = true,
): PageSizePx {
  const rawW = mmToPx(A4_MM.width)
  const rawH = mmToPx(A4_MM.height)
  const w = orientation === 'landscape' ? rawH : rawW
  const h = orientation === 'landscape' ? rawW : rawH
  return rounded ? { width: roundPx(w), height: roundPx(h) } : { width: w, height: h }
}
