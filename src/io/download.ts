/**
 * 浏览器下载工具（导出层小工具）
 *
 * 职责：把已经生成好的字节数组变成一次文件下载，并给出合规的文件名。
 *
 * 为什么单独成文件：
 *   PDF / DOCX / JSON 备份三条导出路径都要「造一个 Blob → 造一个 a[download] → 点它 → 收垃圾」，
 *   各写一遍最容易漏掉 `URL.revokeObjectURL`（每导一次漏几十 KB，长会话能漏出上百 MB）。
 *
 * 约束：
 *  - node 环境（测试 / SSR）没有 document，必须静默返回，不能抛
 *  - 不读写 DOM 之外的状态，不读时钟与随机数（文件名由调用方给）
 */

/** 文件名里不允许出现的字符（Windows 已禁 + 常见 shell 元字符），统一替换成下划线 */
const ILLEGAL_FILE_CHARS = /[\\/:*?"<>|]/g

/** 控制字符（0x00-0x1F）单独处理：写进正则字面量会触发 no-control-regex */
function stripControlChars(text: string): string {
  let out = ''
  for (const char of text) {
    out += char.charCodeAt(0) < 0x20 ? '_' : char
  }
  return out
}

const FALLBACK_TITLE = '未命名简历'

/** 由文档标题推断下载文件名。空标题、全是非法字符都兜底成「未命名简历」。 */
export function suggestFileName(title: string, ext: 'pdf' | 'docx'): string {
  const trimmed = title.trim()
  const safe = stripControlChars(trimmed).replace(ILLEGAL_FILE_CHARS, '_').replace(/\s+/g, ' ').trim()
  const base = safe === '' || /^_+$/.test(safe) ? FALLBACK_TITLE : safe
  return `${base}.${ext}`
}

/**
 * 触发一次下载。node 环境静默返回（导出层的单元测试不关心下载）。
 * 用临时 `<a>` 而不是 `window.open`：后者会被弹窗拦截，而且在 Safari 上拿不到文件名。
 */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return

  // Blob 只接受 ArrayBufferView；Uint8Array 的 buffer 可能比视图大（subarray 场景），
  // 必须按 byteOffset/byteLength 切一份，否则会把相邻数据一起打进文件。
  const view = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([view], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // 立刻 revoke 在部分浏览器会让下载中断，推迟到下一轮事件循环
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
