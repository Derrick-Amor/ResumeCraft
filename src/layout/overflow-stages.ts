/**
 * 溢出三阶段（TC-007 段③）
 * 契约 §5 不变量 3：溢出不自动删内容；三阶段**各自产出候选结果，不产 UI**：
 *   `compress(scope='component'|'page')` → `split()` → `pushDown()`
 *   压缩手段**只限**行距 / 字距 / 组件内留白微调。
 *
 * 为什么只产候选、不直接改版面：
 *   改行距或字距会让文字重新折行，高度必须**重新测量**才能知道。
 *   本层不持有 measure，所以只交「参数 + 预期方向」，由调用方重新布局后判定是否奏效。
 *   这也是为什么 `estimatedGainPx` 允许为 null —— 宁可返回"不知道"，也不编一个数糊弄界面。
 */

/** 压缩可调的三类参数。超出范围会被 clamp，不报错。 */
export interface CompressParams {
  /** 行高倍数 */
  lineHeight?: number
  /** 字距（px），负数收紧 */
  letterSpacingPx?: number
  /** 组件内上下留白（px） */
  paddingY?: number
}

/** 三阶段候选的共同外壳 */
export interface OverflowCandidateBase {
  /** 给人看的一句话，UI 直接显示 */
  rationale: string
}

export interface CompressCandidate extends OverflowCandidateBase {
  stage: 'compress'
  scope: 'component' | 'page'
  /** scope=component 时指明是哪个组件 */
  componentId?: string
  params: CompressParams
  /** 预计回收高度；无法估准时为 null（需重新布局确认） */
  estimatedGainPx: number | null
}

export interface SplitCandidate extends OverflowCandidateBase {
  stage: 'split'
  componentId: string
  /** 建议的拆分位置（相对内容区顶部的 y，px） */
  atY: number
}

export interface PushDownCandidate extends OverflowCandidateBase {
  stage: 'push-down'
  componentId: string
  /** 目标页序号 */
  targetPage: number
}

export type OverflowCandidate = CompressCandidate | SplitCandidate | PushDownCandidate

/** 压缩下限。到了这里就不能再压，否则开始难看甚至不可读。 */
export const COMPRESS_LIMITS = Object.freeze({
  minLineHeight: 1.2,
  maxLineHeightReduction: 0.15,
  minLetterSpacingPx: -0.2,
  minPaddingY: 0,
})

/** 当前排版参数基线。调用方按实际模板传入，缺省取这里。 */
export interface TypographyBaseline {
  lineHeight: number
  letterSpacingPx: number
  paddingY: number
  /** 字号 px，用于把行高倍数变化折成高度估计 */
  fontSizePx: number
  /** 该块预估行数；给了才算 estimatedGainPx，否则为 null */
  lineCountHint?: number
}

export const DEFAULT_BASELINE: Readonly<TypographyBaseline> = Object.freeze({
  lineHeight: 1.55,
  letterSpacingPx: 0,
  paddingY: 8,
  fontSizePx: 14,
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 只允许收紧，不允许放宽。
 * 若 baseline 本身就已越过下限（如 letterSpacing = -0.3），直接 clamp 会返回 -0.2
 * —— 反而把字距放宽了，与"压缩"的目的相反。取 min 保证上限永远是 baseline 本身。
 */
function shrinkTo(clamped: number, baseline: number): number {
  return Math.min(clamped, baseline)
}

/**
 * 阶段一：压缩。
 * 先组件级（只动溢出的那个块），再页级（整页一起收）——顺序不能反，
 * 否则整页被压扁只为了让一个块放得下，其他内容白白变丑。
 */
export function proposeCompress(
  overflowComponentIds: readonly string[],
  baseline: TypographyBaseline = DEFAULT_BASELINE,
): CompressCandidate[] {
  const candidates: CompressCandidate[] = []

  const nextLineHeight = shrinkTo(
    clamp(
      baseline.lineHeight - 0.05,
      Math.max(COMPRESS_LIMITS.minLineHeight, baseline.lineHeight - COMPRESS_LIMITS.maxLineHeightReduction),
      baseline.lineHeight,
    ),
    baseline.lineHeight,
  )
  const nextSpacing = shrinkTo(
    clamp(
      baseline.letterSpacingPx - 0.1,
      COMPRESS_LIMITS.minLetterSpacingPx,
      baseline.letterSpacingPx,
    ),
    baseline.letterSpacingPx,
  )
  const nextPadding = shrinkTo(
    clamp(baseline.paddingY - 2, COMPRESS_LIMITS.minPaddingY, baseline.paddingY),
    baseline.paddingY,
  )

  for (const componentId of overflowComponentIds) {
    const lines = baseline.lineCountHint
    const gain =
      lines !== undefined && nextLineHeight < baseline.lineHeight
        ? (baseline.lineHeight - nextLineHeight) * baseline.fontSizePx * lines +
          (baseline.paddingY - nextPadding)
        : null

    candidates.push({
      stage: 'compress',
      scope: 'component',
      componentId,
      params: {
        lineHeight: nextLineHeight,
        letterSpacingPx: nextSpacing,
        paddingY: nextPadding,
      },
      estimatedGainPx: gain === null ? null : Math.round(gain * 100) / 100,
      rationale:
        `收紧该组件的行距到 ${nextLineHeight.toFixed(2)}、字距 ${nextSpacing.toFixed(2)}px、` +
        `内留白 ${nextPadding}px`,
    })
  }

  if (overflowComponentIds.length > 1) {
    candidates.push({
      stage: 'compress',
      scope: 'page',
      params: {
        lineHeight: nextLineHeight,
        letterSpacingPx: nextSpacing,
        paddingY: nextPadding,
      },
      estimatedGainPx: null,
      rationale: '整页统一收紧行距与间距（会同时影响本页其他内容，最后才用）',
    })
  }

  return candidates
}

/** 阶段二：拆分。只在组件本身高于整页可用高度时才建议。 */
export function proposeSplit(
  entries: ReadonlyArray<{ componentId: string; height: number }>,
  contentHeight: number,
): SplitCandidate[] {
  const result: SplitCandidate[] = []
  for (const e of entries) {
    if (e.height <= contentHeight + 1e-9) continue
    result.push({
      stage: 'split',
      componentId: e.componentId,
      atY: contentHeight,
      rationale: '该组件高过整页，建议在自然段处分页，保留跨页续排标记',
    })
  }
  return result
}

/** 阶段三：下推。把整块挪到下一页，不改任何视觉参数。 */
export function proposePushDown(
  entries: ReadonlyArray<{ componentId: string; pageIndex: number }>,
): PushDownCandidate[] {
  return entries.map((e) => ({
    stage: 'push-down',
    componentId: e.componentId,
    targetPage: e.pageIndex + 1,
    rationale: '把该组件整体移到下一页，视觉上不做任何压缩',
  }))
}

/**
 * 三阶段按优先级串起来，**只产出候选**，不判断哪个生效。
 * 契约要求「各自产出候选结果」——选择权在调用方（通常是 UI 的溢出对话框）。
 */
export function proposeOverflowPlan(input: {
  overflow: ReadonlyArray<{ componentId: string; height: number; pageIndex: number }>
  contentHeight: number
  baseline?: TypographyBaseline
}): OverflowCandidate[] {
  const baseline = input.baseline ?? DEFAULT_BASELINE
  const ids = input.overflow.map((o) => o.componentId)

  return [
    ...proposeCompress(ids, baseline),
    ...proposeSplit(input.overflow, input.contentHeight),
    ...proposePushDown(input.overflow),
  ]
}
