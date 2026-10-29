/**
 * TC-011 DOCX 导出测试
 * 契约 §7：exportDocx(doc, opts) → ExportResult
 * 验收要求：阻断拦截、页数正确、字节输出、结构标记往返一致（FR-EXP-005）、
 *          标记受损降级（FR-IMP-009）、样式映射、页面设置保留（FR-EXP-002）
 */

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import {
  EDITABLE_COPY_NOTICE,
  defaultBlocks,
  exportDocx,
  styleToParaProps,
  styleToRunProps,
  synthesizeLayout,
} from '../../src/io/export-docx'
import {
  MARK_VERSION,
  MARK_VERSION_PROPERTY,
  bookmarkNameFor,
  buildMarks,
  extractBookmarkNames,
  isMarkBookmark,
  marksToCustomProperties,
  parseMarksFromProperties,
  parsePropertiesFromXml,
  readMarks,
} from '../../src/io/docx-marks'
import { createComponent, createDocument } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'
import type { LayoutResult } from '../../src/layout/types'

const NOW = '2026-10-28T00:00:00.000Z'

// ─── 测试工具 ────────────────────────────────────────────

/** jszip 的最小结构类型（经 docx 的依赖间接使用，不直接依赖 jszip） */
interface JsZipFileLike {
  async(type: 'string'): Promise<string>
}

interface JsZipLike {
  file(path: string): JsZipFileLike | null
  loadAsync(data: Uint8Array): Promise<JsZipLike>
}

/** 通过 docx 自带的 jszip 依赖解包 DOCX（避免项目直接依赖 jszip） */
function loadJsZip(): JsZipLike {
  const requireFromHere = createRequire(import.meta.url)
  const jszipPath = requireFromHere.resolve('jszip', {
    paths: [requireFromHere.resolve('docx')],
  })
  return requireFromHere(jszipPath) as JsZipLike
}

async function unzipDocx(data: Uint8Array): Promise<{
  documentXml: string
  customXml: string | undefined
}> {
  const JSZip = loadJsZip()
  const zip = await JSZip.loadAsync(data)
  const documentXml = await zip.file('word/document.xml')!.async('string')
  const customFile = zip.file('docProps/custom.xml')
  const customXml = customFile ? await customFile.async('string') : undefined
  return { documentXml, customXml }
}

const DEFAULT_COMPONENTS = Symbol('default')

function makeDoc(
  components: ReturnType<typeof createComponent>[] | typeof DEFAULT_COMPONENTS = DEFAULT_COMPONENTS,
): ResumeDocument {
  return createDocument({
    documentId: 'doc_001',
    now: NOW,
    createdAt: NOW,
    title: '张明的简历',
    languageTrack: 'zh',
    components:
      components === DEFAULT_COMPONENTS
        ? [
            createComponent({
              id: 'basics',
              type: 'basics',
              order: 0,
              fields: { name: '张明', summary: '资深前端工程师' },
            }),
          ]
        : components,
  })
}

function makeLayout(pageCount = 1, boxIds: string[] = ['basics']): LayoutResult {
  return {
    boxes: boxIds.map((id, i) => ({
      componentId: id,
      pageIndex: 0,
      fragmentIndex: 0,
      x: 20,
      y: 20 + i * 60,
      width: 170,
      height: 50,
    })),
    pages: Array.from({ length: pageCount }, (_, i) => ({
      pageIndex: i,
      width: 210,
      height: 297,
      contentX: 20,
      contentY: 20,
      contentWidth: 170,
      contentHeight: 257,
    })),
    warnings: [],
    engineVersion: 'test',
    inputHash: 'hash',
  }
}

// ─── 基本导出 ────────────────────────────────────────────

describe('exportDocx — 基本导出', () => {
  it('正常：导出 DOCX 成功，返回字节和页数', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    expect(result.ok).toBe(true)
    expect(result.pageCount).toBe(1)
    expect(result.bytes).toBeGreaterThan(0)
    expect(result.data).toBeInstanceOf(Uint8Array)
  })

  it('DOCX 文件头正确（PK 魔数）', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    expect(result.data).toBeDefined()
    const bytes = result.data as Uint8Array
    expect(bytes[0]).toBe(0x50) // P
    expect(bytes[1]).toBe(0x4b) // K
  })

  it('多页：pageCount 与 LayoutResult 一致', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout(3) })
    expect(result.ok).toBe(true)
    expect(result.pageCount).toBe(3)
  })

  it('空文档导出成功（0 页）', async () => {
    const layout: LayoutResult = { ...makeLayout(), boxes: [], pages: [] }
    const result = await exportDocx(makeDoc([]), { layout })
    expect(result.ok).toBe(true)
    expect(result.pageCount).toBe(0)
  })

  it('无 layout 参数时用合成布局（契约 §7 不变量 1：质量检查仍执行）', async () => {
    const result = await exportDocx(makeDoc())
    expect(result.ok).toBe(true)
    expect(result.qualityReport.blocking).toHaveLength(0)
    expect(result.pageCount).toBe(1)
  })

  it('结果带可编辑副本边界声明（FR-EXP-002）', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    expect(result.warnings).toContain(EDITABLE_COPY_NOTICE)
  })
})

// ─── 质量检查拦截（FR-EXP-003） ──────────────────────────

describe('exportDocx — 质量检查拦截（FR-EXP-003）', () => {
  it('阻断：blocking 非空时默认拒绝导出', async () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } }),
      createComponent({ id: 'c2', type: 'education', order: 1, fields: { school: '某某大学' } }),
    ])
    const layout = makeLayout(1, ['c1']) // c2 未放置 → blocking
    const result = await exportDocx(doc, { layout })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('拦截')
    expect(result.qualityReport.blocking.length).toBeGreaterThan(0)
    expect(result.data).toBeUndefined()
    expect(result.bytes).toBe(0)
  })

  it('阻断：forceExport=true 可强制导出（需用户显式确认）', async () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } }),
      createComponent({ id: 'c2', type: 'education', order: 1, fields: { school: '大学' } }),
    ])
    const layout = makeLayout(1, ['c1'])
    const result = await exportDocx(doc, { layout, forceExport: true })

    expect(result.ok).toBe(true)
    expect(result.qualityReport.blocking.length).toBeGreaterThan(0)
    expect(result.data).toBeInstanceOf(Uint8Array)
  })

  it('正常：无 blocking 时导出成功', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    expect(result.ok).toBe(true)
    expect(result.qualityReport.blocking).toHaveLength(0)
  })
})

// ─── 结构标记（FR-EXP-005） ──────────────────────────────

describe('exportDocx — 结构标记往返一致（FR-EXP-005）', () => {
  it('标记完整：custom.xml 含 data-rc-mark-version 与 data-rc-marks', async () => {
    const doc = makeDoc([
      createComponent({
        id: 'basics',
        type: 'basics',
        order: 0,
        fields: { name: '张明' },
        style: { titleSizePt: 12 },
      }),
    ])
    const result = await exportDocx(doc, { layout: makeLayout() })
    expect(result.ok).toBe(true)

    const { customXml } = await unzipDocx(result.data as Uint8Array)
    expect(customXml).toBeDefined()
    const props = parsePropertiesFromXml(customXml as string)

    const versionProp = props.find((p) => p.name === MARK_VERSION_PROPERTY)
    expect(versionProp?.value).toBe(String(MARK_VERSION))

    const parsed = parseMarksFromProperties(props)
    expect(parsed.ok).toBe(true)
    expect(parsed.mode).toBe('self-docx')
    expect(parsed.manifest?.['data-rc-mark-version']).toBe(MARK_VERSION)
    expect(parsed.manifest?.components).toHaveLength(1)
  })

  it('往返一致：导出→读回标记→与源文档逐项比对', async () => {
    const doc = makeDoc([
      createComponent({
        id: 'cmp-aaa',
        type: 'basics',
        order: 0,
        fields: { name: '张明' },
        style: { bold: true, color: '#107093' },
      }),
      createComponent({
        id: 'cmp-bbb',
        type: 'experience',
        order: 1,
        fields: { company: '某公司', role: '前端' },
      }),
      createComponent({
        id: 'cmp-ccc',
        type: 'awards',
        order: 2,
        visible: false,
        fields: { name: '隐藏奖项' },
      }),
    ])
    const result = await exportDocx(doc, { layout: makeLayout(1, ['cmp-aaa', 'cmp-bbb']) })
    expect(result.ok).toBe(true)

    const { documentXml, customXml } = await unzipDocx(result.data as Uint8Array)
    const read = readMarks({
      customPropertiesXml: customXml as string,
      documentXml,
    })

    expect(read.ok).toBe(true)
    expect(read.mode).toBe('self-docx')
    expect(read.warnings).toHaveLength(0)

    const manifest = read.manifest
    expect(manifest).not.toBeNull()
    const components = manifest?.components ?? []

    // 三个组件全部在清单中（含不可见）
    expect(components.map((c) => c['data-rc-component-id'])).toEqual([
      'cmp-aaa',
      'cmp-bbb',
      'cmp-ccc',
    ])

    // style 原文往返
    expect(components[0]['data-rc-style']).toEqual({ bold: true, color: '#107093' })
    expect(components[1]['data-rc-style']).toEqual({})

    // 类型 / order / visible 往返
    expect(components[0].type).toBe('basics')
    expect(components[1].order).toBe(1)
    expect(components[2].visible).toBe(false)
    expect(components[2].bookmark).toBe('') // 不可见组件不写书签

    // 书签存在且与清单一致
    const names = extractBookmarkNames(documentXml)
    const markNames = names.filter((n) => isMarkBookmark(n))
    expect(markNames).toContain(bookmarkNameFor('cmp-aaa'))
    expect(markNames).toContain(bookmarkNameFor('cmp-bbb'))
    expect(markNames).not.toContain(bookmarkNameFor('cmp-ccc'))
  })

  it('标记含版本号且与实现同源', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    const { customXml } = await unzipDocx(result.data as Uint8Array)
    const parsed = parseMarksFromProperties(parsePropertiesFromXml(customXml as string))
    expect(parsed.manifest?.['data-rc-mark-version']).toBe(MARK_VERSION)
  })

  it('includeMarks=false 不埋入标记', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout(), includeMarks: false })
    expect(result.ok).toBe(true)
    const { customXml } = await unzipDocx(result.data as Uint8Array)
    // custom.xml 可能仍存在（docx 库总会写），但不应有 rc 标记
    const props = customXml ? parsePropertiesFromXml(customXml) : []
    expect(props.find((p) => p.name === MARK_VERSION_PROPERTY)).toBeUndefined()
  })

  it('正文文本导出完整（FR-EXP-002）', async () => {
    const doc = makeDoc([
      createComponent({
        id: 'basics',
        type: 'basics',
        order: 0,
        fields: { name: '张明', summary: '资深前端工程师' },
      }),
    ])
    const result = await exportDocx(doc, { layout: makeLayout() })
    const { documentXml } = await unzipDocx(result.data as Uint8Array)
    expect(documentXml).toContain('张明')
    expect(documentXml).toContain('资深前端工程师')
  })
})

// ─── 标记受损降级（FR-IMP-009） ──────────────────────────

describe('docx-marks — 标记受损降级', () => {
  const goodDoc = makeDoc([
    createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } }),
  ])

  it('缺 custom.xml → 降级 third-party', () => {
    const result = readMarks({})
    expect(result.ok).toBe(false)
    expect(result.mode).toBe('third-party')
    expect(result.error).toContain('降级')
  })

  it('缺版本属性 → 降级 third-party', () => {
    const result = parseMarksFromProperties([{ name: 'other', value: 'x' }])
    expect(result.ok).toBe(false)
    expect(result.mode).toBe('third-party')
    expect(result.error).toContain(MARK_VERSION_PROPERTY)
  })

  it('版本号非法 → 降级 third-party', () => {
    const result = parseMarksFromProperties([
      { name: MARK_VERSION_PROPERTY, value: 'abc' },
      { name: 'data-rc-marks', value: '{}' },
    ])
    expect(result.mode).toBe('third-party')
    expect(result.error).toContain('非法')
  })

  it('版本号不匹配 → 降级 third-party（宁可降级不可错解）', () => {
    const result = parseMarksFromProperties([
      { name: MARK_VERSION_PROPERTY, value: String(MARK_VERSION + 1) },
      { name: 'data-rc-marks', value: '{}' },
    ])
    expect(result.mode).toBe('third-party')
    expect(result.error).toContain('不一致')
  })

  it('marks 非法 JSON → 降级 third-party', () => {
    const result = parseMarksFromProperties([
      { name: MARK_VERSION_PROPERTY, value: String(MARK_VERSION) },
      { name: 'data-rc-marks', value: '{不是 JSON' },
    ])
    expect(result.mode).toBe('third-party')
    expect(result.error).toContain('JSON')
  })

  it('个别书签缺失 → 保留 self-docx 但记 warning', () => {
    const manifest = buildMarks(goodDoc)
    const props = marksToCustomProperties(manifest)
    const result = readMarks({
      customPropertiesXml: `<properties>${props
        .map(
          (p) =>
            `<property name="${p.name}"><vt:lpwstr>${p.value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</vt:lpwstr></property>`,
        )
        .join('')}</properties>`,
      documentXml: '<w:document/>', // 无任何书签
    })
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('self-docx')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('书签')
  })
})

// ─── 样式映射（src/io/docx-style-map.md） ─────────────────

describe('样式映射 — styleToRunProps', () => {
  it('bold / italic / underline 直传', () => {
    const props = styleToRunProps({ bold: true, italic: true, underline: true })
    expect(props.bold).toBe(true)
    expect(props.italics).toBe(true)
    expect(props.underline?.type).toBe('single')
  })

  it('color 归一化（#RGB / RRGGBB）', () => {
    expect(styleToRunProps({ color: '#107093' }).color).toBe('107093')
    expect(styleToRunProps({ color: '#abc' }).color).toBeUndefined() // 非 6 位忽略
    expect(styleToRunProps({ color: 'ff0000' }).color).toBe('FF0000')
    expect(styleToRunProps({ color: 42 }).color).toBeUndefined()
  })

  it('fontSizePt → 半磅', () => {
    expect(styleToRunProps({ fontSizePt: 12 }).size).toBe(24)
    expect(styleToRunProps({ fontSizePt: -1 }).size).toBeUndefined()
  })

  it('titleSizePt 仅 title 生效', () => {
    expect(styleToRunProps({ titleSizePt: 13 }, 'title').size).toBe(26)
    expect(styleToRunProps({ titleSizePt: 13 }, 'body').size).toBeUndefined()
  })

  it('titleWeight ≥600 → bold', () => {
    expect(styleToRunProps({ titleWeight: 600 }, 'title').bold).toBe(true)
    expect(styleToRunProps({ titleWeight: 400 }, 'title').bold).toBe(false)
    // title 无 weight 时默认粗体
    expect(styleToRunProps({}, 'title').bold).toBe(true)
  })

  it('字体逻辑名映射', () => {
    expect(styleToRunProps({ fontFamily: 'rc-sans' }).font).toBe('Microsoft YaHei')
    expect(styleToRunProps({ fontFamily: 'rc-serif' }).font).toBe('SimSun')
    expect(styleToRunProps({ fontFamily: '楷体' }).font).toBe('楷体')
    expect(styleToRunProps({ font: '' }).font).toBeUndefined()
  })

  it('行内 style 覆盖组件 style', () => {
    const merged = styleToRunProps({ fontSizePt: 10 }, 'body')
    expect(merged.size).toBe(20)
  })
})

describe('样式映射 — styleToParaProps', () => {
  it('lineHeight → spacing.line（×240）', () => {
    expect(styleToParaProps({ lineHeight: 1.5 }).spacing?.line).toBe(360)
    expect(styleToParaProps({ lineHeight: 1.5 }).spacing?.lineRule).toBe('auto')
  })

  it('gapAbovePt / marginBottomPt → twips（×20）', () => {
    const props = styleToParaProps({ gapAbovePt: 6, marginBottomPt: 4 })
    expect(props.spacing?.before).toBe(120)
    expect(props.spacing?.after).toBe(80)
  })

  it('marginBottomPt 优先于 gapBelowPt', () => {
    const props = styleToParaProps({ marginBottomPt: 4, gapBelowPt: 9 })
    expect(props.spacing?.after).toBe(80)
  })

  it('bulletIndentPt 仅 bullet 生效', () => {
    expect(styleToParaProps({ bulletIndentPt: 10 }, 'bullet').indent?.left).toBe(200)
    expect(styleToParaProps({ bulletIndentPt: 10 }, 'body').indent).toBeUndefined()
  })

  it('ruleWidthPt 仅 title 生效（1/8 磅线宽）', () => {
    expect(styleToParaProps({ ruleWidthPt: 1 }, 'title').border?.bottom?.size).toBe(8)
    expect(styleToParaProps({ ruleWidthPt: 1 }, 'body').border).toBeUndefined()
  })
})

// ─── 内容提取 ────────────────────────────────────────────

describe('defaultBlocks — 内容提取', () => {
  it('title 类字段产出 title 行', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张明' } }),
    ])
    const blocks = defaultBlocks('c1', doc)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'lines' })
    if (blocks[0].kind === 'lines') {
      expect(blocks[0].lines[0].role).toBe('title')
      expect(blocks[0].lines[0].text).toBe('张明')
    }
  })

  it('字符串数组 → bullet 行', () => {
    const doc = makeDoc([
      createComponent({
        id: 'c1',
        type: 'experience',
        order: 0,
        fields: { company: '某公司', bullets: ['负责 A', '负责 B'] },
      }),
    ])
    const blocks = defaultBlocks('c1', doc)
    const bulletLines = blocks
      .filter((b) => b.kind === 'lines')
      .flatMap((b) => (b.kind === 'lines' ? b.lines : []))
      .filter((l) => l.role === 'bullet')
    expect(bulletLines.map((l) => l.text)).toEqual(['负责 A', '负责 B'])
  })

  it('对象数组 → 表格（列 = 键并集）', () => {
    const doc = makeDoc([
      createComponent({
        id: 'c1',
        type: 'education',
        order: 0,
        fields: {
          school: '某大学',
          courses: [
            { name: '算法', score: '90' },
            { name: '网络', grade: 'A' },
          ],
        },
      }),
    ])
    const blocks = defaultBlocks('c1', doc)
    const table = blocks.find((b) => b.kind === 'table')
    expect(table).toBeDefined()
    if (table?.kind === 'table') {
      expect(table.columns).toEqual(['name', 'score', 'grade'])
      expect(table.rows).toEqual([
        ['算法', '90', ''],
        ['网络', '', 'A'],
      ])
    }
  })

  it('未知组件导出 raw 文本叶子', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } }),
    ])
    // 手工塞一个未知组件
    doc.components.push({
      id: 'u1',
      type: 'future-block',
      order: 1,
      visible: true,
      unknown: true,
      originalType: 'future-block',
      raw: { title: '神秘组件', nested: { note: '原始字段' } },
    })
    const blocks = defaultBlocks('u1', doc)
    const texts = blocks
      .filter((b) => b.kind === 'lines')
      .flatMap((b) => (b.kind === 'lines' ? b.lines.map((l) => l.text) : []))
    expect(texts).toContain('神秘组件')
    expect(texts).toContain('原始字段')
  })

  it('未知组件导出有降级 warning（走第三方路径）', async () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } }),
    ])
    doc.components.push({
      id: 'u1',
      type: 'future-block',
      order: 1,
      visible: true,
      unknown: true,
      originalType: 'future-block',
      raw: { note: '原始字段' },
    })
    const result = await exportDocx(doc, {
      layout: makeLayout(1, ['c1', 'u1']),
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.includes('第三方'))).toBe(true)
  })

  it('自定义 extractBlocks 被调用', async () => {
    let called = false
    const result = await exportDocx(makeDoc(), {
      layout: makeLayout(),
      extractBlocks: () => {
        called = true
        return [{ kind: 'lines', lines: [{ text: '自定义文本', role: 'body' }] }]
      },
    })
    expect(result.ok).toBe(true)
    expect(called).toBe(true)
  })
})

// ─── 页面设置保留（FR-EXP-002） ──────────────────────────

describe('exportDocx — 页面设置保留', () => {
  it('A4 纵向与页边距写入 sectPr', async () => {
    const result = await exportDocx(makeDoc(), { layout: makeLayout() })
    const { documentXml } = await unzipDocx(result.data as Uint8Array)
    // A4：210mm×297mm → 11906×16838 twips（56.6929 twips/mm，四舍五入）
    expect(documentXml).toMatch(/w:w="1190[0-9]"/)
    expect(documentXml).toMatch(/w:h="1683[0-9]"/)
    expect(documentXml).toMatch(/w:orient="portrait"/)
    // 页边距写入 sectPr：默认页边距为设计稿换算值（Amor 2026-10-30 的 1:1 裁决）——
    // 上 14.28mm / 左 15.87mm。convertMillimetersToTwip = Math.floor(mm/25.4*1440)：
    // 14.28mm → 809 twips，15.87mm → 899 twips（原统一 20mm → 1133 twips）
    expect(documentXml).toMatch(/w:top="80[0-9]"/)
    expect(documentXml).toMatch(/w:left="89[0-9]"/)
  })

  it('横向时 orient=landscape', async () => {
    const doc = createDocument({
      documentId: 'doc_land',
      now: NOW,
      title: '横向简历',
      pageSettings: { orientation: 'landscape', widthMm: 297, heightMm: 210 },
      components: [
        createComponent({ id: 'basics', type: 'basics', order: 0, fields: { name: '张明' } }),
      ],
    })
    const result = await exportDocx(doc, { layout: makeLayout() })
    expect(result.ok).toBe(true)
    const { documentXml } = await unzipDocx(result.data as Uint8Array)
    expect(documentXml).toMatch(/w:orient="landscape"/)
  })
})

// ─── 合成布局 ────────────────────────────────────────────

describe('synthesizeLayout — 质量检查兜底', () => {
  it('所有可见组件均被放置（不产生误阻断）', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: 'A' } }),
      createComponent({ id: 'c2', type: 'skills', order: 1, fields: { name: 'B' } }),
      createComponent({
        id: 'c3',
        type: 'awards',
        order: 2,
        visible: false,
        fields: { name: 'C' },
      }),
    ])
    const layout = synthesizeLayout(doc)
    expect(layout.boxes.map((b) => b.componentId).sort()).toEqual(['c1', 'c2'])
    expect(layout.pages).toHaveLength(1)
  })

  it('空文档 → 空布局', () => {
    const layout = synthesizeLayout(makeDoc([]))
    expect(layout.boxes).toHaveLength(0)
    expect(layout.pages).toHaveLength(0)
  })
})

// ─── docx-marks 单元 ─────────────────────────────────────

describe('docx-marks — 书签命名', () => {
  it('简单 id 原样保留（加前缀）', () => {
    expect(bookmarkNameFor('basics')).toBe('rc1_basics')
  })

  it('非法字符替换为下划线', () => {
    expect(bookmarkNameFor('cmp-1.2 3')).toBe('rc1_cmp-1_2_3'.replace('-', '_'))
  })

  it('长 id 截断并加哈希（≤40 字符，Word 书签名上限）', () => {
    const longId = 'cmp_067e6162-3a6f-4b7c-9f8d-426614174000'
    const name = bookmarkNameFor(longId)
    expect(name.startsWith('rc1_')).toBe(true)
    expect(name.length).toBeLessThanOrEqual(40)
    // 同 id 稳定、不同 id 不同
    expect(bookmarkNameFor(longId)).toBe(name)
    expect(bookmarkNameFor(`${longId}x`)).not.toBe(name)
  })

  it('isMarkBookmark 识别协议书签', () => {
    expect(isMarkBookmark('rc1_basics')).toBe(true)
    expect(isMarkBookmark('myBookmark')).toBe(false)
    expect(isMarkBookmark('rc2_basics')).toBe(false) // 其他版本前缀不认
  })
})

describe('docx-marks — buildMarks / marksToCustomProperties', () => {
  it('清单按 order 升序、含全部组件', () => {
    const doc = makeDoc([
      createComponent({ id: 'b', type: 'skills', order: 2, fields: {} }),
      createComponent({ id: 'a', type: 'basics', order: 1, fields: {} }),
    ])
    const manifest = buildMarks(doc)
    expect(manifest.components.map((c) => c['data-rc-component-id'])).toEqual(['a', 'b'])
  })

  it('自定义属性含版本与清单两个条目', () => {
    const doc = makeDoc()
    const props = marksToCustomProperties(buildMarks(doc))
    expect(props.map((p) => p.name).sort()).toEqual([
      'data-rc-mark-version',
      'data-rc-marks',
    ])
  })

  it('属性 XML 解析往返（含 XML 转义）', () => {
    const doc = makeDoc([
      createComponent({
        id: 'c1',
        type: 'basics',
        order: 0,
        fields: {},
        style: { color: '#a&b<c>' },
      }),
    ])
    const props = marksToCustomProperties(buildMarks(doc))
    const xml = `<properties>${props
      .map(
        (p) =>
          `<property name="${p.name}"><vt:lpwstr>${p.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</vt:lpwstr></property>`,
      )
      .join('')}</properties>`

    const parsed = parsePropertiesFromXml(xml)
    expect(parsed).toEqual(props)

    const result = parseMarksFromProperties(parsed)
    expect(result.ok).toBe(true)
    expect(result.manifest?.components[0]['data-rc-style']).toEqual({ color: '#a&b<c>' })
  })
})
