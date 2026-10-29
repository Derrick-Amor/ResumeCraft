/**
 * 字体子集守卫（2026-10-29）
 *
 * 子集化把字库从 6808 字形收到 3836（GB2312 一级 + 标点 + 项目自有文本），
 * 代价是**超出字集的字会变豆腐块** —— 界面能显示（回退系统字体），但 PDF 导出
 * 嵌入的是同一份子集 TTF，缺字就是方框，而这种问题在开发期完全看不出来。
 *
 * 所以规则是：**源码里出现的每一个非 ASCII 字符，都必须在子集字集里。**
 * 新增生僻字（姓名用字、学校简称之类）时本测试会红，提示去跑
 * `python scripts/subset-fonts.py` 重新生成字库，而不是等到用户导出 PDF 才发现。
 *
 * 本测试只核「代码里写死的文本」。用户运行时输入的字无法预知 ——
 * 那部分的风险由产品侧的导出前提示承担（见 PRD 的质量检查），不在这里兜。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CHARSET_FILE = join(ROOT, 'scripts', 'font-charset.txt')
const SRC_DIR = join(ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'assets' || name === 'node_modules') continue
      walk(full, out)
      continue
    }
    if (/\.(ts|vue|css|json)$/.test(name)) out.push(full)
  }
  return out
}

describe('字体子集守卫', () => {
  const charset = new Set(readFileSync(CHARSET_FILE, 'utf8'))

  it('字集文件存在且规模合理（GB2312 一二级 + 标点 + 项目文本，约 7000 字符）', () => {
    // 2026-10-29 Amor 裁决取一二级（含姓名/地名生僻字），不是只取一级。
    // 下限防"字集意外缩水"，上限防"把整个 Unicode 收进来导致子集失效"。
    expect(charset.size).toBeGreaterThan(6500)
    expect(charset.size).toBeLessThan(8000)
  })

  it('src 下所有源码文本的字符都在字集内', () => {
    const missing = new Map<string, string[]>()
    for (const file of walk(SRC_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const ch of text) {
        if (ch.charCodeAt(0) < 0x80) continue // ASCII 一定在
        if (charset.has(ch)) continue
        const list = missing.get(ch) ?? []
        if (list.length < 3) list.push(file.replace(ROOT, ''))
        missing.set(ch, list)
      }
    }

    const summary = [...missing.entries()]
      .map(([ch, files]) => `「${ch}」→ ${files.join(', ')}`)
      .join('\n')
    expect(
      missing.size,
      `以下字符不在字体子集里，导出 PDF 会变豆腐块。\n` +
        `跑 ` + '`python scripts/subset-fonts.py' + '` 重新生成字库后重跑本测试：\n' + summary,
    ).toBe(0)
  })
})
