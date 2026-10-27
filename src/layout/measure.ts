/**
 * 测量层（TC-006 段②）
 * 契约 §4：`measure(text, style) → { width, height, lineBreaks, cached }`，纯函数，同输入必同输出。
 *
 * 四条设计约束，全都写进类型里：
 *  1. **不读 DOM 布局**。只允许 Canvas2D `measureText`；DOM 读数必须过 canvas-vs-dom 对照（契约 §4 不变量）
 *  2. **后端可注入**。测试与 Node 环境没有 canvas，用近似后端跑通换行逻辑；真实渲染用 canvas2d
 *  3. **降级必须显式**。不能用近似值却声称测量可信 —— 结果里带 `backend` 与 `reliable`
 *     （契约 §4：不得静默回退后仍声称测量可信）
 *  4. 缓存不改变确定性：命中与未命中的数值必须完全一致
 *
 * 换行策略：贪心。遇到超宽时优先回退到最近的断点（空格 / CJK 字符边界），
 * 若当前行没有断点则强制在当前位置断（长英文单词不撑破版面）。
 */

import { ptToPx, roundPx } from './units'

export type MeasureBackendKind = 'canvas2d' | 'approximate'

export interface TextStyle {
  /** CSS font-family 串，可含多个回退 */
  fontFamily: string
  /** 字号，单位 pt（简历正文 10.5pt） */
  fontSizePt: number
  /** 字重，默认 400 */
  fontWeight?: number
  /** 字距，单位 px，可为负 */
  letterSpacingPx?: number
  /** 行高倍数，默认 1.55 */
  lineHeight?: number
}

export interface TextMetrics {
  /** 最宽一行的宽度（px） */
  width: number
  /** 行数 × 行高（px） */
  height: number
  /** 每行结束处的字符索引（左闭右开），共 lines.length 个 */
  lineBreaks: number[]
  lines: string[]
  /** 是否命中缓存 */
  cached: boolean
  backend: MeasureBackendKind
  /** false 表示这是近似值，不能当作可信度量使用 */
  reliable: boolean
}

/** 后端只需要能回答"这段文字在给定样式下多宽" */
export interface MeasureBackend {
  kind: MeasureBackendKind
  measureWidth(text: string, style: TextStyle): number
}

const DEFAULT_WEIGHT = 400
const DEFAULT_LINE_HEIGHT = 1.55
const DEFAULT_CACHE_SIZE = 512

/** 字号 pt → 屏幕上用作测量的 px。不取整，避免 10.5pt 被截成 10.5→14 的误差累积 */
export function fontSizePx(style: TextStyle): number {
  return ptToPx(style.fontSizePt)
}

/** 拼 CSS font 简写。font-size 保留两位小数，避免浮点尾巴影响缓存键与测量一致性 */
export function fontCss(style: TextStyle): string {
  const weight = style.fontWeight ?? DEFAULT_WEIGHT
  const size = Math.round(fontSizePx(style) * 100) / 100
  return `${weight} ${size}px ${style.fontFamily}`
}

function cacheKey(text: string, style: TextStyle, maxWidth: number): string {
  const weight = style.fontWeight ?? DEFAULT_WEIGHT
  const spacing = style.letterSpacingPx ?? 0
  const lineHeight = style.lineHeight ?? DEFAULT_LINE_HEIGHT
  return `${fontCss(style)}|${weight}|${spacing}|${lineHeight}|${maxWidth}|${text}`
}

/** 断点判定：空格之后、CJK 字符之后都算可断 */
function isCjk(code: number): boolean {
  return (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x3000 && code <= 0x303f)
  )
}

/** 贪心换行。宽度回调可注入，便于测试与后端切换。 */
export function wrapText(
  text: string,
  maxWidth: number,
  widthOf: (slice: string) => number,
): { lines: string[]; lineBreaks: number[] } {
  if (text.length === 0) return { lines: [''], lineBreaks: [0] }
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return { lines: [text], lineBreaks: [text.length] }

  const lines: string[] = []
  const lineBreaks: number[] = []
  let start = 0

  while (start < text.length) {
    let end = start
    let lastBreak = -1

    while (end < text.length) {
      const candidate = text.slice(start, end + 1)
      if (widthOf(candidate) > maxWidth && end > start) break
      const code = text.charCodeAt(end)
      if (code === 0x20 || code === 0x09) lastBreak = end + 1
      else if (isCjk(code)) lastBreak = end + 1
      end += 1
    }

    // 本行还能再塞一点；若超宽且存在断点，回退到断点
    if (end < text.length && lastBreak > start) {
      end = lastBreak
    }

    lines.push(text.slice(start, end))
    lineBreaks.push(end)
    start = end
  }

  return { lines, lineBreaks }
}

/**
 * 创建测量器。缓存按「font + 字距 + 行高 + 最大宽 + 原文」做键；
 * 缓存只影响 `cached` 字段，不影响数值。
 */
export function createMeasurer(
  backend: MeasureBackend,
  options: { cacheSize?: number } = {},
): {
  measure: (text: string, style: TextStyle, maxWidth: number) => TextMetrics
  clearCache: () => void
} {
  const cacheSize = Math.max(0, options.cacheSize ?? DEFAULT_CACHE_SIZE)
  const cache = new Map<string, TextMetrics>()

  function measure(text: string, style: TextStyle, maxWidth: number): TextMetrics {
    const key = cacheKey(text, style, maxWidth)
    const hit = cache.get(key)
    if (hit) return { ...hit, cached: true }

    const spacing = style.letterSpacingPx ?? 0
    const lineHeight = (style.lineHeight ?? DEFAULT_LINE_HEIGHT) * fontSizePx(style)

    // 字距按**字符数**累加，不是 (字符数-1)。
    // CSS 的 letter-spacing 在每个字符之后都加、含行尾；实测（docs/verify/canvas-vs-dom.md §7）：
    // 按 (n-1) 算最大偏差 1.0043px，按 n 算 0.0093px。差的那一个 spacing 会长行累积，足以错一页。
    const widthOf = (slice: string): number =>
      backend.measureWidth(slice, style) + slice.length * spacing

    const { lines, lineBreaks } = wrapText(text, maxWidth, widthOf)
    let widest = 0
    for (const line of lines) {
      const w = widthOf(line)
      if (w > widest) widest = w
    }

    const result: TextMetrics = {
      width: widest,
      height: lines.length * lineHeight,
      lineBreaks,
      lines,
      cached: false,
      backend: backend.kind,
      reliable: backend.kind === 'canvas2d',
    }

    if (cacheSize > 0) {
      if (cache.size >= cacheSize) {
        const oldest = cache.keys().next()
        if (!oldest.done) cache.delete(oldest.value)
      }
      cache.set(key, result)
    }

    return result
  }

  return {
    measure,
    clearCache: () => cache.clear(),
  }
}

/**
 * 近似后端：没有 canvas 时（Node / jsdom / 字体未就绪）用等宽近似。
 * **结果不可信**，只用来跑通换行逻辑与占位排版；`reliable` 会是 false。
 */
export function createApproximateBackend(): MeasureBackend {
  return {
    kind: 'approximate',
    measureWidth(text: string, style: TextStyle): number {
      const em = fontSizePx(style)
      let total = 0
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i)
        let factor = 0.55
        if (isCjk(code)) factor = 1
        else if (code === 0x20) factor = 0.28
        else if (code >= 0x30 && code <= 0x39) factor = 0.56
        else if (code >= 0x41 && code <= 0x5a) factor = 0.66
        else if (code >= 0x61 && code <= 0x7a) factor = 0.52
        else if (code < 0x20) factor = 0
        else if (code < 0x7f) factor = 0.32
        total += em * factor
      }
      return total
    },
  }
}

export interface CanvasContextLike {
  font: string
  measureText: (text: string) => { width: number }
}

/**
 * Canvas2D 后端。拿不到 2d context 时返回 null，由调用方决定降级策略 —— 不在这里静默兜底。
 * `create` 参数允许注入（测试用一个确定的假 context）。
 */
export function createCanvasBackend(
  create?: () => CanvasContextLike | null,
): MeasureBackend | null {
  let ctx: CanvasContextLike | null = null

  if (create) {
    ctx = create()
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas')
    const raw = canvas.getContext('2d')
    ctx = raw ? (raw as unknown as CanvasContextLike) : null
  }

  if (!ctx) return null
  const context = ctx

  return {
    kind: 'canvas2d',
    measureWidth(text: string, style: TextStyle): number {
      context.font = fontCss(style)
      return context.measureText(text).width
    },
  }
}

/**
 * 默认后端：优先 canvas2d，拿不到就退回近似并**显式标记**。
 * 调用方可读 `backend.kind` 决定是否在界面提示「字体未就绪，预览为近似排版」。
 */
export function createDefaultBackend(): MeasureBackend {
  return createCanvasBackend() ?? createApproximateBackend()
}

/** 把像素宽换算成 pt，用于导出层（PDF 用 pt） */
export function pxWidthToPt(widthPx: number): number {
  return roundPx((widthPx / 96) * 72 * 1000) / 1000
}
