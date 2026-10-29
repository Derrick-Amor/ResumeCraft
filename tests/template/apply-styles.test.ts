/**
 * applyTemplate 的样式映射回归（E 段补缺）
 *
 * 补的是「切换模板只换顺序、版面纹丝不动」这个缺口：`template.styles` 此前从没被应用。
 *
 * 三条断言方向：
 *  1. 模板 styles 的字号/行高/间距落到对应组件的 `style`，且**与应用前不同**（否则"应用了"无法证明）
 *  2. 键要过 canonicalType：模板用槽位名（work / project / custom），组件是注册表类型
 *  3. 类型不对的值一律不生效；未知组件不被写；模板未声明的键保持原样
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createComponent, createDocument } from '../../src/model/factory'
import type { AnyComponent, ResumeComponent, UnknownComponent } from '../../src/model/types'
import { applyTemplate } from '../../src/template/apply'
import { clearRegistry, registerTemplate } from '../../src/template/registry'
import type { TemplateDefinition } from '../../src/template/schema'
import { builtinTemplates, zhGeneral001 } from '../../src/template/templates/builtin'

const NOW = '2026-10-29T00:00:00.000Z'

function styleOf(component: AnyComponent | undefined): Record<string, unknown> | undefined {
  if (component === undefined) return undefined
  return 'unknown' in component ? undefined : (component as ResumeComponent).style
}

beforeEach(() => {
  clearRegistry()
  builtinTemplates.forEach((template) => registerTemplate(template))
})

describe('applyTemplate —— styles 映射', () => {
  it('内置模板的字号/行高/间距落到组件，且与应用前不同', () => {
    const doc = createDocument({
      documentId: 'doc_style_1',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({ id: 'c_basics', type: 'basics', order: 0, fields: { name: '张明' } }),
        createComponent({
          id: 'c_exp',
          type: 'experience',
          order: 1,
          fields: { company: '字节跳动' },
        }),
        createComponent({ id: 'c_proj', type: 'projects', order: 2, fields: { name: 'P' } }),
      ],
    })

    const before = styleOf(doc.components[1])
    expect(before).toBeUndefined()

    const { doc: out } = applyTemplate(doc, 'zh-general-001')

    const basics = out.components.find((c) => c.id === 'c_basics')
    const exp = out.components.find((c) => c.id === 'c_exp')
    const proj = out.components.find((c) => c.id === 'c_proj')

    // 槽位 basics → 注册表 basics
    expect(styleOf(basics)).toMatchObject({
      fontSizePt: 14,
      lineHeight: 1.5,
      bold: true,
      spacingAfterMm: 4,
    })
    // 槽位 work → 注册表 experience（不归一就永远取不到）
    expect(styleOf(exp)).toMatchObject({
      fontSizePt: 11,
      lineHeight: 1.5,
      spacingBeforeMm: 6,
      spacingAfterMm: 3,
    })
    // 槽位 project → 注册表 projects
    expect(styleOf(proj)).toMatchObject({ fontSizePt: 11, lineHeight: 1.5 })

    // "应用了"必须可证明：值确实变了
    expect(styleOf(exp)?.fontSizePt).not.toBe(before?.fontSizePt)
  })

  it('不同模板的字号档不同，切换模板版面样式随之变化', () => {
    const doc = createDocument({
      documentId: 'doc_style_2',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({ id: 'c_basics', type: 'basics', order: 0, fields: { name: '张明' } }),
      ],
    })

    const general = applyTemplate(doc, 'zh-general-001')
    const student = applyTemplate(doc, 'zh-student-001')

    const sizeGeneral = styleOf(general.doc.components[0])?.fontSizePt
    const sizeStudent = styleOf(student.doc.components[0])?.fontSizePt
    expect(sizeGeneral).toBe(zhGeneral001.styles.basics.fontSizePt)
    expect(sizeStudent).not.toBe(sizeGeneral)
  })

  it('类型不对 / 非正数的声明一律忽略，不覆盖已有值', () => {
    const weird: TemplateDefinition = {
      ...zhGeneral001,
      id: 'tpl-weird-styles',
      styles: {
        ...zhGeneral001.styles,
        // 故意塞坏值：字符串字号、负行高、非布尔 bold、0 与 NaN 间距
        basics: {
          fontSizePt: '14px',
          lineHeight: -3,
          bold: 'yes',
          spacingBeforeMm: 0,
          spacingAfterMm: Number.NaN,
        },
      } as unknown as TemplateDefinition['styles'],
    }
    registerTemplate(weird)

    const doc = createDocument({
      documentId: 'doc_style_3',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({
          id: 'c_basics',
          type: 'basics',
          order: 0,
          fields: { name: '张明' },
          style: { fontSizePt: 20, letterSpacingPx: 0.2 },
        }),
      ],
    })

    const { doc: out } = applyTemplate(doc, 'tpl-weird-styles')
    const style = styleOf(out.components[0])

    // 坏值一个都没生效
    expect(style).toEqual({ fontSizePt: 20, letterSpacingPx: 0.2 })
  })

  it('模板未声明的键保持原样，不写 undefined', () => {
    const onlySize: TemplateDefinition = {
      ...zhGeneral001,
      id: 'tpl-only-size',
      styles: { ...zhGeneral001.styles, education: { fontSizePt: 13, lineHeight: 1.4 } },
    }
    registerTemplate(onlySize)

    const doc = createDocument({
      documentId: 'doc_style_4',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({
          id: 'c_edu',
          type: 'education',
          order: 0,
          fields: { school: '华南理工' },
          style: { letterSpacingPx: 0.1 },
        }),
      ],
    })

    const { doc: out } = applyTemplate(doc, 'tpl-only-size')
    const style = styleOf(out.components[0])
    expect(style).toEqual({ letterSpacingPx: 0.1, fontSizePt: 13, lineHeight: 1.4 })
    expect(style && 'bold' in style).toBe(false)
    expect(style && 'spacingAfterMm' in style).toBe(false)
  })

  it('未知组件不被写入 style（它没有这个字段）', () => {
    const unknown: UnknownComponent = {
      id: 'c_unknown',
      type: 'future-widget',
      order: 3,
      visible: true,
      unknown: true,
      originalType: 'future-widget',
      raw: { note: '一段原样保留的内容' },
    }

    const doc = createDocument({
      documentId: 'doc_style_5',
      now: NOW,
      createdAt: NOW,
      components: [createComponent({ id: 'c_basics', type: 'basics', order: 0 }), unknown],
    })

    const { doc: out } = applyTemplate(doc, 'zh-general-001')
    const restored = out.components.find((c) => c.id === 'c_unknown')
    expect(restored).toBeDefined()
    expect(restored !== undefined && 'style' in restored).toBe(false)
    // 已知组件照常拿到样式
    expect(styleOf(out.components.find((c) => c.id === 'c_basics'))).toMatchObject({
      fontSizePt: 14,
    })
  })

  it('入参文档不被改写（undo 快照不被污染）', () => {
    const doc = createDocument({
      documentId: 'doc_style_6',
      now: NOW,
      createdAt: NOW,
      components: [createComponent({ id: 'c_exp', type: 'experience', order: 0 })],
    })
    const styleBefore = styleOf(doc.components[0])

    applyTemplate(doc, 'zh-general-001')

    expect(styleOf(doc.components[0])).toBe(styleBefore)
    expect(styleOf(doc.components[0])).toBeUndefined()
  })

  it('映射报告语义不变：preserved / pending / warnings 三桶照旧', () => {
    const doc = createDocument({
      documentId: 'doc_style_7',
      now: NOW,
      createdAt: NOW,
      components: [
        createComponent({ id: 'c_exp', type: 'experience', order: 0 }),
        {
          id: 'c_unknown',
          type: 'future-widget',
          order: 1,
          visible: true,
          unknown: true as const,
          originalType: 'future-widget',
          raw: { note: 'x' },
        },
      ],
    })

    const { mappingReport } = applyTemplate(doc, 'zh-general-001')
    expect(mappingReport.preserved).toEqual(['c_exp'])
    expect(mappingReport.pending).toEqual(['c_unknown'])
    // 槽位别名生效后，experience 不该再被误判成"不在推荐顺序中"
    expect(mappingReport.warnings).toEqual([])
  })
})
