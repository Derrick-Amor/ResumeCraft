/**
 * TC-013a 内容完整性检查测试（FR-QA-001）
 * 验收要求：正常/阻断/警告/建议各至少 2 例
 */

import { describe, expect, it } from 'vitest'
import {
  checkContentPlacement,
  checkLostContent,
  checkRequiredFields,
  runContentChecks,
} from '../../src/quality/content-check'
import { createDocument, createComponent } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'
import type { LayoutResult } from '../../src/layout/types'

const NOW = '2026-10-28T00:00:00.000Z'

const DEFAULT_COMPONENTS = Symbol('default')

function makeDoc(
  components: ReturnType<typeof createComponent>[] | typeof DEFAULT_COMPONENTS = DEFAULT_COMPONENTS,
): ResumeDocument {
  return createDocument({
    documentId: 'doc_001',
    now: NOW,
    createdAt: NOW,
    title: '测试简历',
    languageTrack: 'zh',
    components:
      components === DEFAULT_COMPONENTS
        ? [createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } })]
        : components,
  })
}

function makeLayout(
  boxes: LayoutResult['boxes'] = [],
  warnings: LayoutResult['warnings'] = [],
): LayoutResult {
  return {
    boxes,
    pages: [{ pageIndex: 0, width: 794, height: 1123, contentX: 72, contentY: 72, contentWidth: 650, contentHeight: 979 }],
    warnings,
    engineVersion: 'test',
    inputHash: 'hash',
  }
}

function makeBox(componentId: string, pageIndex = 0) {
  return { componentId, pageIndex, fragmentIndex: 0, x: 72, y: 72, width: 650, height: 100 }
}

describe('checkContentPlacement（FR-QA-001 核心）', () => {
  // ── 正常 × 2 ──
  it('正常：全部组件已放置 → 无 issue', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} }),
      createComponent({ id: 'c2', type: 'education', order: 1, fields: {} }),
    ])
    const layout = makeLayout([makeBox('c1'), makeBox('c2')])
    expect(checkContentPlacement(doc, layout)).toHaveLength(0)
  })

  it('正常：不可见组件未放置不算丢失', () => {
    const c = createComponent({ id: 'hidden', type: 'basics', order: 0, fields: {} })
    const doc = makeDoc([c])
    doc.components[0].visible = false
    const layout = makeLayout([])
    expect(checkContentPlacement(doc, layout)).toHaveLength(0)
  })

  // ── 阻断 × 2 ──
  it('阻断：可见组件未被放置 → content-unplaced', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} }),
      createComponent({ id: 'c2', type: 'education', order: 1, fields: {} }),
    ])
    const layout = makeLayout([makeBox('c1')]) // c2 没被放置
    const issues = checkContentPlacement(doc, layout)
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('content-unplaced')
    expect(issues[0].severity).toBe('blocking')
    expect(issues[0].componentId).toBe('c2')
  })

  it('阻断：多个组件未放置 → 多条 issue', () => {
    const doc = makeDoc([
      createComponent({ id: 'a', type: 'basics', order: 0, fields: {} }),
      createComponent({ id: 'b', type: 'education', order: 1, fields: {} }),
      createComponent({ id: 'c', type: 'work', order: 2, fields: {} }),
    ])
    const layout = makeLayout([makeBox('a')])
    expect(checkContentPlacement(doc, layout)).toHaveLength(2)
  })
})

describe('checkLostContent', () => {
  it('正常：布局与文档一致 → 无 issue', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} })])
    const layout = makeLayout([makeBox('c1')])
    expect(checkLostContent(doc, layout)).toHaveLength(0)
  })

  it('阻断：布局中有文档不存在的组件 → content-lost', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} })])
    const layout = makeLayout([makeBox('c1'), makeBox('ghost')])
    const issues = checkLostContent(doc, layout)
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('content-lost')
    expect(issues[0].severity).toBe('blocking')
    expect(issues[0].componentId).toBe('ghost')
  })

  it('阻断：跨页片段只报一次', () => {
    const doc = makeDoc([])
    const layout = makeLayout([
      makeBox('ghost', 0),
      { componentId: 'ghost', pageIndex: 1, fragmentIndex: 1, x: 72, y: 72, width: 650, height: 100 },
    ])
    expect(checkLostContent(doc, layout)).toHaveLength(1)
  })
})

describe('checkRequiredFields', () => {
  it('正常：字段已填 → 无 issue', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '张三' } })])
    expect(checkRequiredFields(doc, { basics: ['name'] })).toHaveLength(0)
  })

  it('正常：无 requiredFields 配置 → 无 issue', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: {} })])
    expect(checkRequiredFields(doc)).toHaveLength(0)
  })

  it('建议：必填字段为空 → content-empty (suggestion)', () => {
    const doc = makeDoc([createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '' } })])
    const issues = checkRequiredFields(doc, { basics: ['name'] })
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('suggestion')
    expect(issues[0].type).toBe('content-empty')
    expect(issues[0].cause).toContain('name')
  })

  it('建议：多个字段为空 → 多条 suggestion', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'basics', order: 0, fields: { name: '', email: '' } }),
    ])
    const issues = checkRequiredFields(doc, { basics: ['name', 'email'] })
    expect(issues).toHaveLength(2)
    issues.forEach((i) => expect(i.severity).toBe('suggestion'))
  })

  it('建议：数组字段为空也算', () => {
    const doc = makeDoc([
      createComponent({ id: 'c1', type: 'education', order: 0, fields: { items: [] } }),
    ])
    expect(checkRequiredFields(doc, { education: ['items'] })).toHaveLength(1)
  })
})

describe('runContentChecks 汇总', () => {
  it('混合场景：正常+阻断+建议', () => {
    const doc = makeDoc([
      createComponent({ id: 'placed', type: 'basics', order: 0, fields: { name: '张三' } }),
      createComponent({ id: 'unplaced', type: 'education', order: 1, fields: { school: '' } }),
    ])
    const layout = makeLayout([makeBox('placed'), makeBox('ghost')])
    const issues = runContentChecks(doc, layout, { education: ['school'] })
    // unplaced(blocking) + ghost lost(blocking) + school empty(suggestion) = 3
    expect(issues).toHaveLength(3)
    expect(issues.filter((i) => i.severity === 'blocking')).toHaveLength(2)
    expect(issues.filter((i) => i.severity === 'suggestion')).toHaveLength(1)
  })

  it('空文档+空布局 → 无 issue', () => {
    const doc = makeDoc([])
    const layout = makeLayout([])
    expect(runContentChecks(doc, layout)).toHaveLength(0)
  })
})
