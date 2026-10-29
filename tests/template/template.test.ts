/**
 * TC-009 模板系统测试
 * 契约 §9：applyTemplate 不变量 + 4 套模板 + registry + FR-TPL-005 授权
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  builtinTemplates,
  zhGeneral001,
  enClassic001,
  registerTemplate,
  getTemplate,
  listTemplates,
  getPublishedTemplates,
  getTemplatesByLanguage,
  clearRegistry,
  applyTemplate,
} from '../../src/template'
import type { TemplateDefinition } from '../../src/template'
import { createDocument, createComponent } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'

const NOW = '2026-10-29T00:00:00.000Z'

function makeDoc(): ResumeDocument {
  return createDocument({
    documentId: 'doc_001',
    now: NOW,
    createdAt: NOW,
    title: '张明的简历',
    languageTrack: 'zh',
    components: [
      createComponent({ id: 'cmp_basics', type: 'basics', order: 0, fields: { name: '张明' } }),
      createComponent({ id: 'cmp_edu', type: 'education', order: 1, fields: { school: '华南理工' } }),
      createComponent({ id: 'cmp_work', type: 'work', order: 2, fields: { company: '字节' } }),
      {
        id: 'cmp_unknown',
        type: 'future-widget',
        order: 3,
        visible: true,
        unknown: true as const,
        originalType: 'future-widget',
        raw: { some: 'data' },
      },
    ],
  })
}

beforeEach(() => {
  clearRegistry()
  builtinTemplates.forEach((t) => registerTemplate(t))
})

describe('registry — 注册与查询', () => {
  it('注册 4 套内置模板后 list 返回 4 条', () => {
    expect(listTemplates()).toHaveLength(4)
  })

  it('getTemplate 按 ID 查询', () => {
    expect(getTemplate('zh-general-001')).toBeDefined()
    expect(getTemplate('nonexistent')).toBeUndefined()
  })

  it('getPublishedTemplates 只返回 published 状态', () => {
    expect(getPublishedTemplates()).toHaveLength(4)
  })

  it('getTemplatesByLanguage 按语言轨筛选', () => {
    expect(getTemplatesByLanguage('zh')).toHaveLength(2)
    expect(getTemplatesByLanguage('en')).toHaveLength(2)
  })

  it('FR-TPL-005：缺少 license 拒绝注册', () => {
    const noLicense = { ...zhGeneral001, license: '' }
    expect(() => registerTemplate(noLicense as TemplateDefinition)).toThrow()
  })
})

describe('4 套模板定义', () => {
  it('每套都有完整字段', () => {
    for (const t of builtinTemplates) {
      expect(t.id).toBeTruthy()
      expect(t.version).toBeTruthy()
      expect(t.languageTrack).toBeTruthy()
      expect(t.pageSettings).toBeDefined()
      expect(t.theme).toBeDefined()
      expect(t.componentOrder.length).toBeGreaterThanOrEqual(4)
      expect(t.license).toBeTruthy()
      expect(t.status).toBe('published')
    }
  })

  it('中文 2 套有照片位，英文 2 套无照片位', () => {
    expect(zhGeneral001.layoutRules.photoSlot).not.toBe('none')
    expect(enClassic001.layoutRules.photoSlot).toBe('none')
  })

  it('中英语言轨正确', () => {
    expect(zhGeneral001.languageTrack).toBe('zh')
    expect(enClassic001.languageTrack).toBe('en')
  })
})

describe('applyTemplate — 契约 §9 不变量', () => {
  it('不变量 1：已识别字段零丢失', () => {
    const doc = makeDoc()
    const { mappingReport } = applyTemplate(doc, 'zh-general-001')

    // basics/education/work 三个已识别组件全部保留
    expect(mappingReport.preserved).toContain('cmp_basics')
    expect(mappingReport.preserved).toContain('cmp_edu')
    expect(mappingReport.preserved).toContain('cmp_work')
    expect(mappingReport.preserved).toHaveLength(3)
  })

  it('不变量 2：无法映射的进 pending', () => {
    const doc = makeDoc()
    const { mappingReport } = applyTemplate(doc, 'zh-general-001')

    // unknown 组件进 pending
    expect(mappingReport.pending).toContain('cmp_unknown')
    expect(mappingReport.pending).toHaveLength(1)
  })

  it('不变量 2：pending 中的组件仍然在文档里（不丢）', () => {
    const doc = makeDoc()
    const result = applyTemplate(doc, 'zh-general-001')

    const ids = result.doc.components.map((c) => c.id)
    expect(ids).toContain('cmp_unknown')
  })

  it('不变量 3：返回 undoToken', () => {
    const doc = makeDoc()
    const { undoToken } = applyTemplate(doc, 'zh-general-001')
    expect(undoToken).toBeTruthy()
    expect(undoToken).toMatch(/^tpl-/)
  })

  it('组件按模板 componentOrder 重排', () => {
    const doc = makeDoc()
    const { doc: newDoc } = applyTemplate(doc, 'zh-general-001')

    // zh-general-001 顺序：basics, education, work, project, skills, custom
    const types = newDoc.components.map((c) => c.type)
    expect(types.indexOf('basics')).toBeLessThan(types.indexOf('education'))
    expect(types.indexOf('education')).toBeLessThan(types.indexOf('work'))
  })

  it('未知组件排在最后', () => {
    const doc = makeDoc()
    const { doc: newDoc } = applyTemplate(doc, 'zh-general-001')

    const lastComponent = newDoc.components[newDoc.components.length - 1]
    expect(lastComponent.id).toBe('cmp_unknown')
  })

  it('页面设置被模板覆盖', () => {
    const doc = makeDoc()
    const { doc: newDoc } = applyTemplate(doc, 'en-classic-001')

    expect(newDoc.pageSettings.widthMm).toBe(210)
    expect(newDoc.pageSettings.orientation).toBe('portrait')
  })

  it('文档 ID 保留', () => {
    const doc = makeDoc()
    const { doc: newDoc } = applyTemplate(doc, 'zh-general-001')

    expect(newDoc.documentId).toBe('doc_001')
  })

  it('不存在的模板抛错', () => {
    const doc = makeDoc()
    expect(() => applyTemplate(doc, 'nonexistent')).toThrow()
  })

  it('多次 apply 返回不同 undoToken', () => {
    const doc = makeDoc()
    const r1 = applyTemplate(doc, 'zh-general-001')
    const r2 = applyTemplate(doc, 'en-classic-001')
    expect(r1.undoToken).not.toBe(r2.undoToken)
  })
})
