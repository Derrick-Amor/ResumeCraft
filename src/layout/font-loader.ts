/**
 * 字体加载器（TC-006 段③）
 * 契约 §4：`FontLoader` —— 显式加载内置字体；**加载失败必须返回可判定的降级标记并触发界面提示，
 * 不得静默回退后仍声称测量可信**。
 *
 * 三条设计约束：
 *  1. 结果必须「可判定」：每个字体都有 status + reason，不存在"大概加载上了"这种状态
 *  2. 环境能力缺失要单独表达（Node / 老浏览器没有 FontFace）：`supported: false`，
 *     不是把它混进 "failed" 里当成普通错误
 *  3. `license` 字段必填（FR-TPL-005：模板授权登记不可为空）。缺许可证的字体直接判失败，
 *     不允许"先加载再说"
 */

/** 一个待加载的字体。license 必须是可核验的标识（如 SIL OFL 1.1），不接受空串。 */
export interface FontDescriptor {
  family: string
  url: string
  weight?: number
  style?: 'normal' | 'italic'
  /** 许可证标识，必填 */
  license: string
}

export type FontLoadStatus = 'loaded' | 'failed' | 'unsupported'

export interface FontLoadEntry {
  family: string
  status: FontLoadStatus
  /** 失败或不可用时的可读原因，成功时为 undefined */
  reason?: string
}

export interface FontLoadReport {
  /** 运行环境是否支持 FontFace + document.fonts */
  supported: boolean
  entries: FontLoadEntry[]
  /** 全部成功才为 true。有任何一个 failed / unsupported 都必须为 false */
  ready: boolean
  /** 失败的 family 列表，方便 UI 直接展示 */
  failed: string[]
}

/** 最小可注入面：只依赖 load + fonts.add，测试给假实现即可 */
export interface FontEnv {
  createFace: (family: string, source: string, descriptors: { weight?: string; style?: string }) => {
    load: () => Promise<unknown>
  }
  addFace: (face: unknown) => void
}

const DEFAULT_WEIGHT = 400

/** 从全局环境取真实实现；取不到返回 null，由调用方判定为 unsupported */
export function detectFontEnv(): FontEnv | null {
  const FaceCtor = (globalThis as { FontFace?: unknown }).FontFace
  if (typeof FaceCtor !== 'function') return null

  const doc = (globalThis as { document?: Document }).document
  const fontSet = doc?.fonts
  if (!fontSet || typeof fontSet.add !== 'function') return null

  return {
    createFace: (family, source, descriptors) =>
      new (FaceCtor as unknown as new (
        f: string,
        s: string,
        d: unknown,
      ) => { load: () => Promise<unknown> })(family, source, descriptors),
    addFace: (face) => fontSet.add(face as FontFace),
  }
}

/**
 * 加载一组字体。**永不抛异常**，失败进 entries。
 * 顺序加载而非并发：字体文件通常几 MB，并发容易在弱网下一起超时。
 */
export async function loadFonts(
  descriptors: readonly FontDescriptor[],
  env: FontEnv | null = detectFontEnv(),
): Promise<FontLoadReport> {
  if (!env) {
    return {
      supported: false,
      entries: descriptors.map((d) => ({
        family: d.family,
        status: 'unsupported' as const,
        reason: '当前环境不支持 FontFace，无法加载内置字体',
      })),
      ready: false,
      failed: descriptors.map((d) => d.family),
    }
  }

  const entries: FontLoadEntry[] = []

  for (const descriptor of descriptors) {
    if (!descriptor.license || descriptor.license.trim() === '') {
      entries.push({
        family: descriptor.family,
        status: 'failed',
        reason: '缺少许可证标识，按 FR-TPL-005 不允许加载',
      })
      continue
    }

    try {
      const face = env.createFace(descriptor.family, `url(${descriptor.url})`, {
        weight: String(descriptor.weight ?? DEFAULT_WEIGHT),
        style: descriptor.style ?? 'normal',
      })
      await face.load()
      env.addFace(face)
      entries.push({ family: descriptor.family, status: 'loaded' })
    } catch (cause) {
      entries.push({
        family: descriptor.family,
        status: 'failed',
        reason: cause instanceof Error ? cause.message : '字体文件加载失败',
      })
    }
  }

  const failed = entries.filter((e) => e.status !== 'loaded').map((e) => e.family)

  return {
    supported: true,
    entries,
    ready: failed.length === 0,
    failed,
  }
}

/**
 * 界面提示文案。降级必须显式（契约 §4）——把 report 翻成用户能读懂的一句话。
 * ready 时返回 null，调用方就不渲染提示条。
 */
export function describeFontReport(report: FontLoadReport): string | null {
  if (report.ready) return null

  if (!report.supported) {
    return '当前浏览器不支持内置字体加载，预览与导出可能使用替代字体，排版仅供参考。'
  }

  const names = report.failed.join('、')
  return `字体「${names}」加载失败，预览与导出将使用替代字体，排版结果可能与最终文件不一致。`
}

/** 只是想知道"这批字体里有没有问题"，不关心细节时用这个 */
export function hasFontProblem(report: FontLoadReport): boolean {
  return !report.ready
}
