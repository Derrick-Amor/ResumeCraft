/**
 * 字体就绪等待（布局层，TC-006 补）
 *
 * 职责：在开始测量之前，把简历字体真正加载好，并给出**可判定**的结果。
 *
 * 为什么不能只 `await document.fonts.ready`：
 *   `document.fonts.ready` 只等「已经在加载中」的字体。如果页面上还没有任何元素用到
 *   `Rc Sans`，字体压根不会被触发加载，`fonts.ready` 立刻 resolve ——
 *   于是第一次测量用的是回退字体，行宽偏小，分页结果跟最终渲染对不上。
 *   所以必须显式 `document.fonts.load(...)` 把加载触发起来，再等 ready。
 *
 * 为什么结果要带 `failed` / `supported`：
 *   契约 §4 要求「降级必须显式」。字体没加载上时界面要能说清是哪几个字体缺了，
 *   而不是静默用回退字体渲染一份看起来正常、导出却错位的版面。
 */

/**
 * 需要**预热**的字体族（与 `src/design/fonts.css` 的 @font-face family 名一致）。
 *
 * 2026-10-29：只预热 `Rc Sans`，**不预热 `Rc Serif`**。
 * 实测 `Rc Serif` 的两个 woff2（子集化后仍 1.4MB）在 DOM 里**没有任何元素使用** ——
 * 它只是导出层的逻辑名（PDF 的 `fontKey` / DOCX 的字体名映射），PDF 走的是
 * `src/io/font-assets.ts` 单独加载的 TTF。预热它等于白白下载 1.4MB。
 *
 * `Rc Serif` 的 @font-face 仍然保留（将来正文要用衬线时无需改这里），
 * 真被某个元素用到时浏览器会自行按需加载 —— 那是正确的取用时机。
 */
export const RESUME_FONT_FAMILIES = ['Rc Sans'] as const

/** 预热用的字重档。字体度量随字重变，粗体不预热就会在第一次加粗时现取 */
const PRELOAD_WEIGHTS = [400, 500, 700] as const

/** 预热用的探针字号。用 16px 即可，字号本身不影响是否加载 */
const PROBE_SIZE_PX = 16

export interface ResumeFontReadiness {
  /** 声明的字体全部可用才为 true */
  ready: boolean
  /** 不可用的字体族（含环境不支持的情况） */
  failed: string[]
  /** 运行环境是否具备 FontFace / document.fonts */
  supported: boolean
}

interface FontFaceSetLike {
  load: (font: string) => Promise<unknown>
  check: (font: string) => boolean
  ready: Promise<unknown>
}

function getFontFaceSet(): FontFaceSetLike | null {
  const doc = (globalThis as { document?: Document }).document
  const fonts = doc?.fonts as unknown as FontFaceSetLike | undefined
  if (!fonts || typeof fonts.load !== 'function' || typeof fonts.check !== 'function') return null
  return fonts
}

/**
 * 显式预加载简历字体并等待就绪。**永不抛异常**。
 * node / 无 FS FontFace 的环境返回 `{ ready: false, supported: false }`，调用方据此跳过重排。
 */
export async function ensureResumeFontsLoaded(): Promise<ResumeFontReadiness> {
  const fonts = getFontFaceSet()
  if (fonts === null) {
    return { ready: false, failed: [...RESUME_FONT_FAMILIES], supported: false }
  }

  const probes: string[] = []
  for (const family of RESUME_FONT_FAMILIES) {
    for (const weight of PRELOAD_WEIGHTS) {
      probes.push(`${weight} ${PROBE_SIZE_PX}px "${family}"`)
    }
  }

  // 先触发加载，再整体等待。失败不抛：某个字体 404 不该让整个编辑流程停摆
  await Promise.all(
    probes.map(async (probe) => {
      try {
        await fonts.load(probe)
      } catch {
        // 单个字体加载失败在下面的 check() 里统一汇总，这里不重复报
      }
    }),
  )

  try {
    await fonts.ready
  } catch {
    // ready 异常同样不阻断，交给 check() 判定实际可用性
  }

  const failed = RESUME_FONT_FAMILIES.filter(
    (family) => !fonts.check(`${PROBE_SIZE_PX}px "${family}"`),
  )

  return { ready: failed.length === 0, failed: [...failed], supported: true }
}
