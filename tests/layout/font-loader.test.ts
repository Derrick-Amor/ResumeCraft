/**
 * TC-006 段③：字体加载器回归测试
 * 对照：CONTRACT §4（加载失败返回可判定降级标记，不得静默回退后声称可信）+ FR-TPL-005（license 不可为空）
 *
 * 全部用注入的假 FontEnv，不碰真实 FontFace —— 测试不该依赖机器上装了什么字体。
 */

import { describe, expect, it } from 'vitest'

import {
  describeFontReport,
  detectFontEnv,
  hasFontProblem,
  loadFonts,
} from '../../src/layout/font-loader'
import type { FontDescriptor, FontEnv } from '../../src/layout/font-loader'

const BASE: FontDescriptor[] = [
  { family: 'RcSans', url: '/fonts/rc-sans.woff2', license: 'SIL OFL 1.1' },
  { family: 'RcSerif', url: '/fonts/rc-serif.woff2', weight: 600, license: 'SIL OFL 1.1' },
]

/** 假环境：failFor 里的 family 会加载失败；calls 记录调用顺序 */
function makeEnv(failFor: string[] = []): FontEnv & { calls: string[]; added: string[] } {
  const calls: string[] = []
  const added: string[] = []
  return {
    calls,
    added,
    createFace: (family) => {
      calls.push(family)
      const face = {
        family,
        load: () => {
          if (failFor.includes(family)) return Promise.reject(new Error(`${family} 文件 404`))
          return Promise.resolve({ family })
        },
      }
      // FontEnv.createFace 的返回类型只承诺 load()，这里额外带上 family 供 addFace 记录
      return face as { load: () => Promise<unknown> }
    },
    addFace: (face) => {
      added.push((face as { family?: string }).family ?? 'unknown')
    },
  }
}

describe('环境能力缺失要单独表达', () => {
  it('env 为 null 时 supported=false，全部 unsupported，绝不假装成功', async () => {
    const report = await loadFonts(BASE, null)
    expect(report.supported).toBe(false)
    expect(report.ready).toBe(false)
    expect(report.entries).toHaveLength(2)
    expect(report.entries.every((e) => e.status === 'unsupported')).toBe(true)
    expect(report.failed).toEqual(['RcSans', 'RcSerif'])
  })

  it('不可用原因可读，不是空字符串', async () => {
    const report = await loadFonts(BASE, null)
    expect(report.entries[0]?.reason).toContain('FontFace')
  })

  it('Node 环境下 detectFontEnv 返回 null', () => {
    expect(detectFontEnv()).toBeNull()
  })
})

describe('正常路径', () => {
  it('全部成功时 ready=true、failed 为空、且都调用了 addFace', async () => {
    const env = makeEnv()
    const report = await loadFonts(BASE, env)

    expect(report.supported).toBe(true)
    expect(report.ready).toBe(true)
    expect(report.failed).toEqual([])
    expect(report.entries.every((e) => e.status === 'loaded')).toBe(true)
    expect(env.added).toEqual(['RcSans', 'RcSerif'])
  })

  it('按声明顺序逐个加载（不做并发）', async () => {
    const env = makeEnv()
    await loadFonts(BASE, env)
    expect(env.calls).toEqual(['RcSans', 'RcSerif'])
  })

  it('成功的 entry 不带 reason', async () => {
    const report = await loadFonts(BASE, makeEnv())
    expect(report.entries[0]?.reason).toBeUndefined()
  })
})

describe('失败必须可判定（契约 §4：不许静默降级）', () => {
  it('一个字体失败时 ready=false，failed 精确到 family', async () => {
    const report = await loadFonts(BASE, makeEnv(['RcSerif']))

    expect(report.ready).toBe(false)
    expect(report.failed).toEqual(['RcSerif'])
    expect(report.entries[0]?.status).toBe('loaded')
    expect(report.entries[1]?.status).toBe('failed')
    expect(report.entries[1]?.reason).toBe('RcSerif 文件 404')
  })

  it('失败的字体不会被 addFace', async () => {
    const env = makeEnv(['RcSerif'])
    await loadFonts(BASE, env)
    expect(env.added).toEqual(['RcSans'])
  })

  it('createFace 同步抛异常也被捕获成 failed，不冒泡', async () => {
    const env: FontEnv = {
      createFace: () => {
        throw new Error('构造 FontFace 失败')
      },
      addFace: () => {},
    }
    await expect(loadFonts(BASE, env)).resolves.toMatchObject({ ready: false })
    const report = await loadFonts(BASE, env)
    expect(report.entries[0]?.reason).toBe('构造 FontFace 失败')
  })
})

describe('license 必填（FR-TPL-005）', () => {
  it('license 为空时直接判失败，且不尝试加载', async () => {
    const env = makeEnv()
    const report = await loadFonts([{ family: 'NoLicense', url: '/x.woff2', license: '  ' }], env)

    expect(report.ready).toBe(false)
    expect(report.entries[0]?.status).toBe('failed')
    expect(report.entries[0]?.reason).toContain('许可证')
    expect(env.calls).toEqual([])
  })
})

describe('提示文案：降级必须能说清楚', () => {
  it('ready 时不产生提示', async () => {
    const report = await loadFonts(BASE, makeEnv())
    expect(describeFontReport(report)).toBeNull()
    expect(hasFontProblem(report)).toBe(false)
  })

  it('环境不支持时提示「仅供参考」，不能让用户以为准', async () => {
    const report = await loadFonts(BASE, null)
    const text = describeFontReport(report)
    expect(text).toContain('不支持')
    expect(text).toContain('仅供参考')
  })

  it('加载失败时点名是哪个字体，并说明后果', async () => {
    const report = await loadFonts(BASE, makeEnv(['RcSerif']))
    const text = describeFontReport(report)
    expect(text).toContain('RcSerif')
    expect(text).toContain('替代字体')
    expect(hasFontProblem(report)).toBe(true)
  })
})
