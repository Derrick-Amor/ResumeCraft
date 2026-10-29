/**
 * 布局合成（compose）与文本段提取（text-runs）回归测试
 * 对照：CONTRACT §5 不变量 1（纯函数）、2（溢出不删内容）、3（同输入同输出）
 *       + §3 不变量 2（语言轨裁剪只走注册表）
 *
 * 说明：测试环境是 node，没有 canvas，所以这里**显式注入确定性测量器**，
 * 让"文本 → 高度"这一步可手算，避免断言跟着某个环境的后端一起漂。
 */

import { describe, expect, it } from 'vitest'

import { LAYOUT_ENGINE_VERSION, composeLayout } from '../../src/layout/compose'
import type { Measurer } from '../../src/layout/compose'
import { componentTextBlock } from '../../src/layout/text-runs'
import { componentRegistry } from '../../src/components/runtime'
import { createComponent, createDocument } from '../../src/model/factory'
import type {
  AnyComponent,
  LanguageTrack,
  PageSettings,
  ResumeDocument,
  UnknownComponent,
} from '../../src/model/types'

const NOW = '2026-10-29T00:00:00.000Z'

/**
 * 确定性测量器：等宽近似（每字符 0.55em），行高按 style.lineHeight。
 * 与 measure.ts 的近似后端同族，但完全同步、无缓存，便于手算期望值。
 */
const measurer: Measurer = (text, style, maxWidth) => {
  const em = (style.fontSizePt / 72) * 96
  const lineHeightPx = (style.lineHeight ?? 1.55) * em
  const width = text.length * em * 0.55
  const safeMax = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : Number.POSITIVE_INFINITY
  const lines = Math.max(1, Math.ceil(width / safeMax))
  return {
    width: Math.min(width, safeMax),
    height: lines * lineHeightPx,
    lineBreaks: [],
    lines: [],
    cached: false,
    backend: 'approximate',
    reliable: false,
  }
}

function makeDoc(
  components: AnyComponent[],
  options: { track?: LanguageTrack; pageSettings?: Partial<PageSettings> } = {},
): ResumeDocument {
  return createDocument({
    documentId: 'doc_compose_test',
    now: NOW,
    createdAt: NOW,
    title: '测试简历',
    languageTrack: options.track ?? 'zh',
    components,
    pageSettings: options.pageSettings,
  })
}

/** 一份内容量正常的中文简历：basics + 教育 + 工作 + 项目 + 技能 + 荣誉 */
function fullResume(): ResumeDocument {
  return makeDoc([
    createComponent({
      id: 'cmp_basics',
      type: 'basics',
      order: 0,
      fields: {
        name: '张明',
        photo: '证件照',
        phone: '13800000000',
        email: 'zhangming@example.com',
        location: '深圳',
        objective: '后端工程师',
      },
    }),
    createComponent({
      id: 'cmp_edu',
      type: 'education',
      order: 1,
      fields: {
        school: '华南理工大学',
        major: '计算机科学与技术',
        degree: '本科',
        start: '2016.09',
        end: '2020.06',
        gpa: '3.8/4.0',
        courses: ['数据结构', '操作系统'],
      },
    }),
    createComponent({
      id: 'cmp_exp',
      type: 'experience',
      order: 2,
      fields: {
        company: '字节跳动',
        role: '后端工程师',
        start: '2020.07',
        end: '2023.06',
        bullets: ['主导简历解析服务重构，P99 延迟下降 40%', '设计多租户存储分片方案'],
      },
    }),
    createComponent({
      id: 'cmp_proj',
      type: 'projects',
      order: 3,
      fields: {
        name: 'ResumeCraft',
        role: '负责人',
        tech: 'Vue3 / TypeScript / Vite',
        start: '2024.01',
        end: '2025.06',
        bullets: ['自动分页引擎', 'PDF / DOCX 双导出'],
      },
    }),
    createComponent({
      id: 'cmp_skills',
      type: 'skills',
      order: 4,
      fields: { name: 'TypeScript', level: '精通', evidence: '开源项目 3000 star' },
    }),
    createComponent({
      id: 'cmp_awards',
      type: 'awards',
      order: 5,
      fields: { name: '优秀员工', date: '2022.12', note: '年度 Top 5%' },
    }),
  ])
}

describe('composeLayout — 确定性（不变量 1、3）', () => {
  it('同输入两次调用，boxes / pages / inputHash 完全一致', () => {
    const doc = fullResume()
    const a = composeLayout(doc, { measurer })
    const b = composeLayout(doc, { measurer })

    expect(a.boxes).toEqual(b.boxes)
    expect(a.pages).toEqual(b.pages)
    expect(a.warnings).toEqual(b.warnings)
    expect(a.inputHash).toBe(b.inputHash)
  })

  it('不改入参文档', () => {
    const doc = fullResume()
    const snapshot = JSON.stringify(doc)
    composeLayout(doc, { measurer })
    expect(JSON.stringify(doc)).toBe(snapshot)
  })

  it('engineVersion = LAYOUT_ENGINE_VERSION，inputHash 带版本前缀', () => {
    const result = composeLayout(fullResume(), { measurer })
    expect(result.engineVersion).toBe(LAYOUT_ENGINE_VERSION)
    expect(result.inputHash.startsWith(`${LAYOUT_ENGINE_VERSION}:`)).toBe(true)
  })

  it('改到几何变了，inputHash 就变（inputHash 是几何指纹，不是全文哈希）', () => {
    const a = composeLayout(fullResume(), { measurer })
    const doc = fullResume()
    const basics = doc.components[0]
    // 名字长到要折行，块高才会变 —— 只改一个字而不改变折行时几何不变，指纹也就不该变
    if (basics && 'fields' in basics) basics.fields.name = '张明'.repeat(80)
    const b = composeLayout(doc, { measurer })
    expect(a.inputHash).not.toBe(b.inputHash)
  })

  it('可见组件按 order 升序进入 boxes，即使文档里顺序是乱的', () => {
    const doc = makeDoc([
      createComponent({ id: 'c_late', type: 'skills', order: 9, fields: { name: '后端' } }),
      createComponent({ id: 'c_early', type: 'basics', order: 0, fields: { name: '张明' } }),
    ])
    const result = composeLayout(doc, { measurer })
    expect(result.boxes.map((b) => b.componentId)).toEqual(['c_early', 'c_late'])
  })
})

describe('composeLayout — 可见性', () => {
  it('visible: false 的组件不进 boxes', () => {
    const doc = makeDoc([
      createComponent({ id: 'c_show', type: 'basics', order: 0, fields: { name: '张明' } }),
      createComponent({
        id: 'c_hidden',
        type: 'experience',
        order: 1,
        visible: false,
        fields: { company: '不该出现', role: '工程师' },
      }),
    ])
    const result = composeLayout(doc, { measurer })
    const ids = result.boxes.map((b) => b.componentId)
    expect(ids).toContain('c_show')
    expect(ids).not.toContain('c_hidden')
  })

  it('全部隐藏时只剩一页空页', () => {
    const doc = makeDoc([
      createComponent({
        id: 'c_hidden',
        type: 'basics',
        order: 0,
        visible: false,
        fields: { name: '张明' },
      }),
    ])
    const result = composeLayout(doc, { measurer })
    expect(result.boxes).toEqual([])
    expect(result.pages).toHaveLength(1)
  })
})

describe('composeLayout — 分页', () => {
  it('内容很多时产生多页，且每页几何与文档页面设置一致', () => {
    const bullets = Array.from({ length: 40 }, (_, i) =>
      `第 ${i + 1} 条要点：负责某子系统的设计、实现与线上稳定性，并推动跨团队协作落地。`.repeat(3),
    )
    const doc = makeDoc(
      [
        createComponent({
          id: 'c_long',
          type: 'experience',
          order: 0,
          fields: { company: '某公司', role: '工程师', bullets },
        }),
      ],
      {
        pageSettings: {
          widthMm: 210,
          heightMm: 297,
          marginTopMm: 20,
          marginRightMm: 20,
          marginBottomMm: 20,
          marginLeftMm: 20,
        },
      },
    )
    const result = composeLayout(doc, { measurer })

    expect(result.pages.length).toBeGreaterThanOrEqual(2)
    for (const page of result.pages) {
      expect(page.width).toBe(210)
      expect(page.height).toBe(297)
      expect(page.contentWidth).toBe(170)
      expect(page.contentHeight).toBe(257)
      expect(page.contentX).toBe(20)
      expect(page.contentY).toBe(20)
    }
    // 页码连续、片段序号从 0 起，且内容没被丢掉（总高 = 各片段高之和）
    const fragments = result.boxes.filter((b) => b.componentId === 'c_long')
    expect(fragments.length).toBeGreaterThan(1)
    expect(fragments[0]?.fragmentIndex).toBe(0)
    expect(fragments.map((f) => f.fragmentIndex)).toEqual(fragments.map((_, i) => i))
  })

  it('页数超建议上限时给 suggestion 级 page-count 警告', () => {
    const bullets = Array.from({ length: 40 }, (_, i) =>
      `第 ${i + 1} 条要点：负责某子系统的设计、实现与线上稳定性，并推动跨团队协作落地。`.repeat(3),
    )
    const doc = makeDoc([
      createComponent({
        id: 'c_long',
        type: 'experience',
        order: 0,
        fields: { company: '某公司', role: '工程师', bullets },
      }),
    ])
    const result = composeLayout(doc, { measurer, suggestedMaxPages: 1 })
    expect(
      result.warnings.some((w) => w.type === 'page-count' && w.severity === 'suggestion'),
    ).toBe(true)
  })

  it('单块高过整页时出现 overflow-page 且 severity 为 blocking', () => {
    // 内容区只有 20mm（页高 60mm、上下各留 20mm）：页尾剩余不足分页层的 MIN_FRAGMENT(24)，
    // 拆分分支不介入，才会走到"单独占一页仍放不下"这条路径。
    const courses = Array.from({ length: 12 }, (_, i) => `课程 ${i + 1}`)
    const doc = makeDoc(
      [
        createComponent({
          id: 'c_tall',
          type: 'education',
          order: 0,
          fields: {
            school: '华南理工大学',
            major: '计算机',
            degree: '本科',
            start: '2016.09',
            end: '2020.06',
            courses,
          },
        }),
      ],
      {
        pageSettings: {
          heightMm: 60,
          marginTopMm: 20,
          marginRightMm: 20,
          marginBottomMm: 20,
          marginLeftMm: 20,
        },
      },
    )
    const result = composeLayout(doc, { measurer })

    expect(result.pages).toHaveLength(1)
    expect(result.boxes).toHaveLength(1)
    const overflow = result.warnings.filter((w) => w.type === 'overflow-page')
    expect(overflow).toHaveLength(1)
    expect(overflow[0]?.severity).toBe('blocking')
    expect(overflow[0]?.componentId).toBe('c_tall')
    // 溢出不删内容：块高完整保留，没有被裁到页高
    expect(result.boxes[0]?.height).toBeGreaterThan(result.pages[0]?.contentHeight ?? 0)
  })
})

describe('composeLayout — 边界', () => {
  it('空文档：1 页空页、无 box、无警告', () => {
    const result = composeLayout(makeDoc([]), { measurer })
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]?.pageIndex).toBe(0)
    expect(result.boxes).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('没填内容的组件给 12mm 占位高（画布上仍可见可点）', () => {
    const doc = makeDoc([createComponent({ id: 'c_empty', type: 'skills', order: 0, fields: {} })])
    const result = composeLayout(doc, { measurer })
    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0]?.height).toBe(12)
  })

  it('页面设置缺字段/非有限数时回落到 A4，不产生 NaN', () => {
    const doc = makeDoc([
      createComponent({ id: 'c_one', type: 'basics', order: 0, fields: { name: '张明' } }),
    ])
    doc.pageSettings = {
      paper: 'A4',
      orientation: 'portrait',
      widthMm: Number.NaN,
      heightMm: Number.POSITIVE_INFINITY,
      marginTopMm: 20,
      marginRightMm: 20,
      marginBottomMm: 20,
      marginLeftMm: 20,
    }
    const result = composeLayout(doc, { measurer })
    expect(result.pages[0]?.width).toBe(210)
    expect(result.pages[0]?.height).toBe(297)
    for (const box of result.boxes) {
      expect(Number.isFinite(box.height)).toBe(true)
      expect(Number.isFinite(box.y)).toBe(true)
    }
  })
})

describe('componentTextBlock — 角色与默认字号', () => {
  it('basics 产出 name / contact（设计稿 .p-name 22.5pt、.p-contact 8.25pt）', () => {
    const basics = createComponent({
      id: 'c_basics',
      type: 'basics',
      order: 0,
      fields: { name: '张明', phone: '13800000000', email: 'a@b.c' },
    })
    const block = componentTextBlock(basics, 'zh')

    expect(block.type).toBe('basics')
    expect(block.componentId).toBe('c_basics')
    expect(block.runs[0]).toMatchObject({
      text: '张明',
      role: 'name',
      fontSizePt: 22.5,
      lineHeight: 1.15,
      bold: true,
    })
    // 姓名之外是联系方式：非邮箱拼一行、邮箱单独一行（设计稿 .p-contact 两行）
    expect(block.runs[1]).toMatchObject({ text: '13800000000', role: 'contact' })
    expect(block.runs[2]).toMatchObject({ text: 'a@b.c', role: 'contact' })
  })

  it('list 字段每一项是一条 bullet', () => {
    const exp = createComponent({
      id: 'c_exp',
      type: 'experience',
      order: 0,
      fields: { company: '字节跳动', role: '后端工程师', bullets: ['要点一', '', '  ', '要点二'] },
    })
    const block = componentTextBlock(exp, 'zh')
    const bullets = block.runs.filter((r) => r.role === 'bullet')
    expect(bullets.map((r) => r.text)).toEqual(['要点一', '要点二'])
    expect(bullets[0]?.fontSizePt).toBe(10.5)
  })

  it('起止时间并进 item-title 的 trailing（同行右对齐，不是独立行）', () => {
    const exp = createComponent({
      id: 'c_exp',
      type: 'experience',
      order: 0,
      fields: { company: '字节跳动', role: '后端工程师', start: '2020.07', end: '2023.06' },
    })
    const runs = componentTextBlock(exp, 'zh').runs
    const title = runs.find((r) => r.role === 'item-title')
    expect(title?.trailing).toBe('2020.07-2023.06')
    // 日期不再单独成行
    expect(runs.some((r) => r.text.includes('2020.07'))).toBe(false)
    expect(runs.some((r) => r.text.includes('2023.06'))).toBe(false)
  })

  it('只有开始时间时 trailing 就是那一个日期，不凭空编结束时间', () => {
    const exp = createComponent({
      id: 'c_exp',
      type: 'experience',
      order: 0,
      fields: { company: '字节跳动', role: '后端工程师', start: '2023.07' },
    })
    const runs = componentTextBlock(exp, 'zh').runs
    const title = runs.find((r) => r.role === 'item-title')
    expect(title?.trailing).toBe('2023.07')
    expect(title?.trailing?.includes('-')).toBe(false)
  })

  it('style 覆盖字号 / 行高 / 字重，只认类型正确的值', () => {
    const exp = createComponent({
      id: 'c_exp',
      type: 'experience',
      order: 0,
      fields: { company: '字节跳动', role: '后端工程师' },
    })
    const block = componentTextBlock(exp, 'zh', { fontSizePt: 13, lineHeight: 1.7, bold: false })
    expect(block.runs[0]).toMatchObject({ fontSizePt: 13, lineHeight: 1.7, bold: false })

    // 类型不对的覆盖值被忽略，回落到角色默认档（item-title = 10.5 / 1.35 / bold）
    const bad = componentTextBlock(exp, 'zh', { fontSizePt: 'big', lineHeight: null, bold: 'yes' })
    expect(bad.runs[0]).toMatchObject({ fontSizePt: 10.5, lineHeight: 1.35, bold: true })
  })

  it('留白：basics 上下各 0，其余组件段后 2mm', () => {
    const basics = createComponent({
      id: 'c_b',
      type: 'basics',
      order: 0,
      fields: { name: '张明' },
    })
    const skills = createComponent({ id: 'c_s', type: 'skills', order: 1, fields: { name: 'Go' } })

    expect(componentTextBlock(basics, 'zh')).toMatchObject({ paddingTopMm: 0, paddingBottomMm: 0 })
    expect(componentTextBlock(skills, 'zh')).toMatchObject({ paddingTopMm: 0, paddingBottomMm: 2 })

    // style 的间距覆盖优先
    const styled = componentTextBlock(skills, 'zh', { spacingBeforeMm: 6, spacingAfterMm: 3 })
    expect(styled).toMatchObject({ paddingTopMm: 6, paddingBottomMm: 3 })
  })
})

describe('componentTextBlock — 未知组件不丢文本', () => {
  it('unknown 组件从 raw 递归收集文本叶子，角色一律 body', () => {
    const unknown: UnknownComponent = {
      id: 'c_unknown',
      type: 'future-widget',
      order: 0,
      visible: true,
      unknown: true,
      originalType: 'future-widget',
      raw: {
        heading: '自定义小节',
        items: ['要点A', '', '要点B'],
        nested: { note: '深层文本' },
        count: 3,
      },
    }

    const block = componentTextBlock(unknown, 'zh')
    expect(block.type).toBe('future-widget')
    expect(block.runs.map((r) => r.text)).toEqual(['自定义小节', '要点A', '要点B', '深层文本'])
    expect(block.runs.every((r) => r.role === 'plain')).toBe(true)
  })

  it('未知组件也进布局结果，且不会因为量不到文本而消失', () => {
    const unknown: UnknownComponent = {
      id: 'c_unknown',
      type: 'future-widget',
      order: 1,
      visible: true,
      unknown: true,
      originalType: 'future-widget',
      raw: { text: '一段未知内容' },
    }
    const doc = makeDoc([
      createComponent({ id: 'c_basics', type: 'basics', order: 0, fields: { name: '张明' } }),
      unknown,
    ])
    const result = composeLayout(doc, { measurer })
    expect(result.boxes.map((b) => b.componentId)).toContain('c_unknown')
  })
})

describe('componentTextBlock — 语言轨裁剪只走注册表', () => {
  it('en 轨 basics 不含「照片」字段产生的文本', () => {
    const basics = createComponent({
      id: 'c_basics',
      type: 'basics',
      order: 0,
      fields: { name: '张明', photo: '证件照文字', phone: '13800000000', email: 'a@b.c' },
    })

    const zhTexts = componentTextBlock(basics, 'zh').runs.map((r) => r.text)
    const enTexts = componentTextBlock(basics, 'en').runs.map((r) => r.text)

    expect(zhTexts).toContain('证件照文字')
    expect(enTexts).not.toContain('证件照文字')
    // 与注册表口径一致：en 轨字段清单里根本没有 photo
    expect(componentRegistry.fieldsFor('basics', 'en').map((f) => f.key)).not.toContain('photo')
  })

  it('en 轨 education 不含 GPA（只在 zh 轨声明）', () => {
    const edu = createComponent({
      id: 'c_edu',
      type: 'education',
      order: 0,
      fields: { school: '华南理工', major: '计算机', gpa: '3.8/4.0' },
    })
    expect(componentTextBlock(edu, 'zh').runs.map((r) => r.text)).toContain('3.8/4.0')
    expect(componentTextBlock(edu, 'en').runs.map((r) => r.text)).not.toContain('3.8/4.0')
  })

  it('en 轨下整份文档的文本块不含 zh 专有字段', () => {
    const doc = makeDoc(
      [
        createComponent({
          id: 'c_basics',
          type: 'basics',
          order: 0,
          fields: { name: 'Ming Zhang', photo: '证件照文字', phone: '13800000000', email: 'a@b.c' },
        }),
      ],
      { track: 'en' },
    )
    const result = composeLayout(doc, { measurer })
    expect(result.boxes).toHaveLength(1)
    expect(
      componentTextBlock(doc.components[0] as AnyComponent, 'en').runs.map((r) => r.text),
    ).not.toContain('证件照文字')
  })
})

describe('运行时注册表', () => {
  it('componentRegistry 已注册全部 6 个 P0 组件类型', () => {
    const types = componentRegistry.list().map((d) => d.type)
    expect(types).toEqual(['basics', 'education', 'experience', 'projects', 'skills', 'awards'])
  })

  it('fieldsFor 对两条语言轨都返回非空字段清单', () => {
    expect(componentRegistry.fieldsFor('education', 'zh').length).toBeGreaterThan(0)
    expect(componentRegistry.fieldsFor('education', 'en').length).toBeGreaterThan(0)
  })
})
