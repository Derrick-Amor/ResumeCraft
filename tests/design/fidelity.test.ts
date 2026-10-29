/**
 * 设计稿保真守卫（A/B 段验收）
 *
 * 为什么要这组测试：本轮把设计稿的三层样式（tokens / app / glass）真正接进项目，
 * 但以后任何人"顺手优化"（把 30px 改成 32px、把 padding:0 改回设计稿原值、
 * 把 .paper 的 scale 改成 zoom）都会让页面重新偏离定稿，而这种偏离在 code review 里
 * 极难发现。所以把关键声明写成断言钉住。
 *
 * 断言对象是**文件文本**而不是渲染结果：这些是"声明是否存在"的守卫，
 * 像素级比对交给截图流程（见 ui-restore-plan.md §8.2）。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

function readDesign(relativePath: string): string {
  return readFileSync(`${ROOT}src/design/${relativePath}`, 'utf8')
}

/**
 * 取出某个选择器的规则块体（选择器必须整行匹配 `selector {`）
 *
 * ⚠ 想验证这里的断言"真的能拦住错误"时（变异自检：把 `padding: 0` 改成 `padding: 0 8px`
 * 之类，看测试是否变红），**必须改 `ruleBody(css, '.paper')` 范围内的那一条**，
 * 不能用全局"替换第一处 `padding: 0;`"——文件里 `.topbar` / `.statusbar` 等也有
 * `padding: 0 var(--rc-s4);`，按"第一次出现"替换会改错规则，污染基线。
 * 改完必须还原并复跑一次，确认回到全绿。
 */
function ruleBody(css: string, selector: string): string {
  const marker = `${selector} {`
  const start = css.indexOf(marker)
  if (start === -1) return ''
  const bodyStart = start + marker.length
  const end = css.indexOf('}', bodyStart)
  if (end === -1) return ''
  return css.slice(bodyStart, end)
}

describe('app.css —— 设计稿关键声明', () => {
  const app = readDesign('app.css')

  it('.topbar 用设计稿高度 token', () => {
    expect(ruleBody(app, '.topbar')).toContain('height: var(--rc-topbar-h)')
  })

  it('.side 与 .inspector 用设计稿左右栏宽度 token', () => {
    expect(ruleBody(app, '.side')).toContain('width: var(--rc-left-w)')
    expect(ruleBody(app, '.inspector')).toContain('width: var(--rc-right-w)')
  })

  it('.paper 用 794×1123 纸面尺寸 + scale 缩放（不是 zoom，也不是自然流）', () => {
    const paper = ruleBody(app, '.paper')
    expect(paper).toContain('width: var(--rc-paper-w)')
    expect(paper).toContain('height: var(--rc-paper-h)')
    expect(paper).toContain('transform: scale(var(--rc-zoom))')
    expect(paper).toContain('transform-origin: top left')
  })

  it('.paper 的 padding 必须是 0（本方案的刻意改动，防回退）', () => {
    // 设计稿原值 54px 60px 44px；我们的 boxes 已含页边距，保留 padding 会二次偏移。
    // 用正则而不是 toContain：`padding: 0 8px` / `padding: 0px` 这类半截写法也是错的，
    // 子串匹配会把它们放过去（`0` 后面跟任何东西都能命中）。
    expect(ruleBody(app, '.paper')).toMatch(/padding:\s*0\s*;/)
  })

  it('.btn 高度是设计稿的 30px', () => {
    expect(ruleBody(app, '.btn')).toContain('height: 30px')
  })

  it('.p-sec__title 用纸面小节字号 token', () => {
    expect(ruleBody(app, '.p-sec__title')).toContain('font-size: var(--rc-p-fz-sec)')
  })

  it('稿子专用的说明书页/索引页/色卡工具类已删除', () => {
    expect(app).not.toContain('.specwrap')
    expect(app).not.toContain('.idxcard')
    expect(app).not.toContain('.dot-accent')
    expect(app).not.toContain('.navhint')
  })

  it('产品增补只允许方案 §2.2 列出的那几类', () => {
    for (const className of [
      '.field__req',
      '.card__media',
      '.hintbar--ok',
      '.hintbar--warn',
      '.hintbar--danger',
    ]) {
      expect(app).toContain(className)
    }
  })
})

describe('tokens.css —— 数值事实源', () => {
  const tokens = readDesign('tokens.css')

  it('品牌蓝 / 缩放 / 纸面宽度三个基准值', () => {
    expect(tokens).toContain('--rc-accent: #2f76d2;')
    expect(tokens).toContain('--rc-zoom: 0.6;')
    expect(tokens).toContain('--rc-paper-w: 794px;')
  })

  it('不再依赖 Google Fonts（字体改本地 @font-face）', () => {
    expect(tokens).not.toContain('fonts.googleapis.com')
  })

  it('保留 EP 桥接兼容别名（否则 element-plus-bridge.css 会全线落空）', () => {
    for (const name of [
      '--rc-color-primary:',
      '--rc-color-text:',
      '--rc-color-primary-light-9:',
      '--rc-color-border:',
      '--rc-space-base:',
      '--rc-radius:',
    ]) {
      expect(tokens).toContain(name)
    }
  })
})

describe('glass.css —— 材质层是设计稿版本', () => {
  const glass = readDesign('glass.css')

  it('不再是 151 行的分叉产物（设计稿版 300 行，去掉 idx/specwrap 后仍远多于 151）', () => {
    expect(glass.split('\n').length).toBeGreaterThan(280)
  })

  it('只给 .app 提升层级，稿子的 .idx / .specwrap 已去掉', () => {
    expect(glass).toContain('.app { position: relative; z-index: 1; }')
    expect(glass).not.toContain('.specwrap')
  })
})

describe('fonts.css —— 本地字形', () => {
  const fonts = readDesign('fonts.css')

  it('Rc Sans 三档 + Rc Serif 两档 + Inter 别名三档 @font-face', () => {
    // 5 条真实族名（Rc Sans ×3 / Rc Serif ×2）
    // + 3 条别名（'Inter' → 同一份 rc-sans 文件，让 tokens.css 的 --rc-font 能落到本地字库）
    // 见 src/design/fonts.css 的「设计稿族名别名」注释块。
    expect(fonts.match(/@font-face \{/g) ?? []).toHaveLength(8)
    expect(fonts).toContain("font-family: 'Rc Sans'")
    expect(fonts).toContain("font-family: 'Rc Serif'")
    expect(fonts).toContain('font-display: swap')
  })

  it("'Inter' 是本地字库的别名，不是真的 Inter（防有人误以为装了 Inter 而改掉它）", () => {
    // 设计稿 --rc-font 的首项是 'Inter'；本地没有 Inter，所以别名到 rc-sans。
    // 若这段被删，界面会静默回退系统字体，而 computedStyle 仍然显示 'Inter' —— 查不出来。
    const interFaces = fonts
      .split('@font-face')
      .filter((block) => block.includes("font-family: 'Inter'"))
    expect(interFaces).toHaveLength(3)
    for (const block of interFaces) {
      expect(block).toContain('rc-sans-')
    }
  })

  it('指向本地 woff2，不走网络', () => {
    expect(fonts).toContain('../assets/fonts/woff2/rc-sans-400.woff2')
    expect(fonts).not.toContain('http')
  })
})

describe('图标体系', () => {
  it('icons.ts 的 path 条数与设计稿一致（52 条）', async () => {
    const { ICON_PATHS } = await import('../../src/ui/controls/icons')
    expect(Object.keys(ICON_PATHS)).toHaveLength(52)
    // 抽查三条，防止"条数对但内容是别的"
    expect(ICON_PATHS.download).toContain('<path')
    expect(ICON_PATHS['file-text']).toContain('<path')
    expect(ICON_PATHS['chevron-down']).toContain('<path')
  })
})
