/**
 * PDF 字体资源加载（导出层）
 *
 * 职责：把 `src/assets/fonts/ttf/` 下的 TTF 读成 `Uint8Array`，交给 `exportPdf` 嵌入。
 *
 * 为什么必须是「函数内部动态取资源」：
 *   测试跑在 node 环境里，既没有 `fetch` 可用的相对 URL，也不该为了跑单测去解析几 MB 字体。
 *   把资源引用写在函数体内、调用时才解析，node 侧只要不调这个函数就完全无感。
 *
 * 为什么失败返回 null 而不是抛：
 *   字体缺失不该让导出流程崩掉 —— 但**必须由调用方显式提示**「本次导出未嵌入中文字体，
 *   字形可能与预览不同」（契约 §4 降级显式）。所以这里只表达"没拿到"，不替调用方决定文案。
 *
 * 键名与 `exportPdf` 的 `FontBytesMap` 对齐：rc-sans / rc-sans-bold / rc-serif。
 */

export interface PdfFontSet {
  'rc-sans': Uint8Array
  'rc-sans-bold': Uint8Array
  'rc-serif': Uint8Array
  /** 索引签名：`exportPdf` 收的是 `Record<string, Uint8Array>`，没有它整个 Set 传不进去 */
  [key: string]: Uint8Array
}

/** 资源地址。用 `new URL(..., import.meta.url)` 让 Vite 在构建期把文件指纹化并重写路径。 */
const FONT_URLS = {
  'rc-sans': '../assets/fonts/ttf/rc-sans-400.ttf',
  'rc-sans-bold': '../assets/fonts/ttf/rc-sans-700.ttf',
  'rc-serif': '../assets/fonts/ttf/rc-serif-400.ttf',
} as const

async function fetchFont(relativePath: string): Promise<Uint8Array | null> {
  try {
    const url = new URL(relativePath, import.meta.url).href
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    // 网络/权限/编码问题一律视为"这个字体没拿到"，由调用方决定是否降级
    return null
  }
}

/**
 * 加载三份 PDF 字体。任意一份失败即整体返回 null ——
 * 只嵌入一半字体比完全不嵌入更难看（同一份简历里两套字形）。
 */
export async function loadPdfFonts(): Promise<PdfFontSet | null> {
  const [sans, sansBold, serif] = await Promise.all([
    fetchFont(FONT_URLS['rc-sans']),
    fetchFont(FONT_URLS['rc-sans-bold']),
    fetchFont(FONT_URLS['rc-serif']),
  ])

  if (sans === null || sansBold === null || serif === null) return null

  return { 'rc-sans': sans, 'rc-sans-bold': sansBold, 'rc-serif': serif }
}
