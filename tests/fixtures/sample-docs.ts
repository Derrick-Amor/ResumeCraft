/**
 * 测试样本库（TC-013 / PRD 11.2）
 * 中英混排、缺图片、替代字体、长内容、边界场景等标准测试文档
 * 供 E2E、快照回归、性能测试共用
 */

import { createDocument, createComponent } from '../../src/model/factory'
import type { ResumeDocument } from '../../src/model/types'
import type { LayoutResult } from '../../src/layout/types'

const NOW = '2026-01-01T00:00:00.000Z'

/** 基础 A4 页面 */
const A4_PAGE = {
  pageIndex: 0,
  width: 210,
  height: 297,
  contentX: 20,
  contentY: 20,
  contentWidth: 170,
  contentHeight: 257,
}

// ─── 样本 1：空白简历 ─────────────────────────────────

export function blankResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_blank',
    now: NOW,
    createdAt: NOW,
    title: '空白简历',
    languageTrack: 'zh',
    components: [],
  })
}

// ─── 样本 2：中文标准简历（1 页）─────────────────────

export function zhStandardResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_zh_standard',
    now: NOW,
    createdAt: NOW,
    title: '张明的简历',
    languageTrack: 'zh',
    components: [
      createComponent({
        id: 'c_basics', type: 'basics', order: 0,
        fields: { name: '张明', phone: '13800138000', email: 'zhang@example.com', summary: '资深前端工程师，5 年经验' },
      }),
      createComponent({
        id: 'c_edu', type: 'education', order: 1,
        fields: { school: '华南理工大学', major: '软件工程', degree: '本科', period: '2016-2020' },
      }),
      createComponent({
        id: 'c_work', type: 'work', order: 2,
        fields: { company: '字节跳动', position: '前端工程师', period: '2020-至今', description: '负责抖音 Web 端开发' },
      }),
      createComponent({
        id: 'c_skills', type: 'skills', order: 3,
        fields: { items: ['Vue.js', 'TypeScript', 'Node.js'] },
      }),
    ],
  })
}

// ─── 样本 3：中英混排 ─────────────────────────────────

export function zhEnMixedResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_zh_en_mixed',
    now: NOW,
    createdAt: NOW,
    title: 'Zhang Ming - Resume',
    languageTrack: 'zh',
    components: [
      createComponent({
        id: 'c_basics', type: 'basics', order: 0,
        fields: { name: 'Zhang Ming 张明', email: 'zhang@example.com', summary: 'Senior Frontend Engineer with 5+ years experience in Vue.js & React' },
      }),
      createComponent({
        id: 'c_work', type: 'work', order: 1,
        fields: { company: 'ByteDance 字节跳动', position: 'Frontend Engineer', description: 'Led development of TikTok Web, improved performance by 40% through code splitting and lazy loading strategies' },
      }),
    ],
  })
}

// ─── 样本 4：长内容（溢出测试，>1 页）────────────────

export function longContentResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_long_content',
    now: NOW,
    createdAt: NOW,
    title: '超长简历',
    languageTrack: 'zh',
    components: [
      createComponent({
        id: 'c_basics', type: 'basics', order: 0,
        fields: { name: '李四', summary: '资深全栈工程师' },
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        createComponent({
          id: `c_work_${i}`, type: 'work', order: i + 1,
          fields: {
            company: `公司${i + 1}`,
            position: `高级工程师`,
            period: `201${i}-201${i + 1}`,
            description: `负责公司${i + 1}的核心系统开发与维护，带领团队完成多个重要项目，包括但不限于微服务架构改造、性能优化、CI/CD 流水线搭建等。在此期间积累了丰富的工程经验。`,
          },
        }),
      ),
    ],
  })
}

// ─── 样本 5：未知组件（前向兼容）──────────────────────

export function unknownComponentResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_unknown_comp',
    now: NOW,
    createdAt: NOW,
    title: '含未知组件的简历',
    languageTrack: 'zh',
    components: [
      createComponent({ id: 'c_basics', type: 'basics', order: 0, fields: { name: '王五' } }),
      {
        id: 'c_unknown',
        type: 'future-widget',
        order: 1,
        visible: true,
        unknown: true as const,
        originalType: 'future-widget',
        raw: { some: 'data' },
      },
    ],
  })
}

// ─── 样本 6：英文简历 ─────────────────────────────────

export function enStandardResume(): ResumeDocument {
  return createDocument({
    documentId: 'fixture_en_standard',
    now: NOW,
    createdAt: NOW,
    title: 'John Smith Resume',
    languageTrack: 'en',
    components: [
      createComponent({
        id: 'c_basics', type: 'basics', order: 0,
        fields: { name: 'John Smith', email: 'john@example.com', summary: 'Software Engineer with 5 years of experience' },
      }),
      createComponent({
        id: 'c_work', type: 'work', order: 1,
        fields: { company: 'Google', position: 'Software Engineer', period: '2020-Present', description: 'Built scalable web applications' },
      }),
    ],
  })
}

// ─── 对应的 LayoutResult 快照样本 ─────────────────────

export function zhStandardLayout(): LayoutResult {
  return {
    boxes: [
      { componentId: 'c_basics', pageIndex: 0, fragmentIndex: 0, x: 20, y: 20, width: 170, height: 50 },
      { componentId: 'c_edu', pageIndex: 0, fragmentIndex: 0, x: 20, y: 80, width: 170, height: 60 },
      { componentId: 'c_work', pageIndex: 0, fragmentIndex: 0, x: 20, y: 150, width: 170, height: 60 },
      { componentId: 'c_skills', pageIndex: 0, fragmentIndex: 0, x: 20, y: 220, width: 170, height: 30 },
    ],
    pages: [A4_PAGE],
    warnings: [],
    engineVersion: 'test',
    inputHash: 'fixture_zh_standard',
  }
}

export function overflowLayout(): LayoutResult {
  return {
    boxes: [
      { componentId: 'c_basics', pageIndex: 0, fragmentIndex: 0, x: 20, y: 20, width: 170, height: 280 },
    ],
    pages: [A4_PAGE],
    warnings: [
      { type: 'overflow-component', pageIndex: 0, componentId: 'c_basics', severity: 'warning', cause: '内容超出', suggestion: '精简' },
    ],
    engineVersion: 'test',
    inputHash: 'fixture_overflow',
  }
}

/** 全部样本清单（PRD 11.2） */
export const allFixtures = {
  blankResume,
  zhStandardResume,
  zhEnMixedResume,
  longContentResume,
  unknownComponentResume,
  enStandardResume,
  zhStandardLayout,
  overflowLayout,
}
