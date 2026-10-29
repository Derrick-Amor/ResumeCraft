/**
 * 4 套内置模板（TC-009 / PRD 9.2）
 * zh-general-001  中文通用
 * zh-student-001  中文应届生
 * en-classic-001  英文经典
 * en-modern-001   英文现代
 *
 * 版式审美由本文件定稿：字号/留白/分节样式/日期对齐。
 * 中英差异：照片位（中文有/英文无）、政治面貌（中文有/英文无）、日期格式（YYYY.MM / Mon YYYY）。
 */

import type { TemplateDefinition } from '../schema'
import type { PageSettings } from '../../model/types'

// 页边距与 DEFAULT_PAGE_SETTINGS 一致：设计稿 .paper padding 54px 60px 44px
// （docs/design/mockups/figma/app.css:552）按 794px=210mm 换算，Amor 2026-10-30 的 1:1 裁决。
const A4: PageSettings = {
  paper: 'A4',
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 14.28,
  marginRightMm: 15.87,
  marginBottomMm: 11.64,
  marginLeftMm: 15.87,
  orientation: 'portrait',
}

// ─── 中文通用（zh-general-001）──────────────────────────

export const zhGeneral001: TemplateDefinition = {
  id: 'zh-general-001',
  version: '1.0.0',
  languageTrack: 'zh',
  pageSettings: A4,
  theme: {
    primaryColor: '#1f6e8c',
    accentColor: '#4B7168',
    bodyFont: 'rc-sans',
    headingFont: 'rc-sans',
    sectionDivider: 'line',
  },
  componentOrder: ['basics', 'education', 'work', 'project', 'skills', 'custom'],
  styles: {
    basics: { fontSizePt: 14, lineHeight: 1.5, bold: true, spacingAfterMm: 4 },
    education: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 6, spacingAfterMm: 3 },
    work: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 6, spacingAfterMm: 3 },
    project: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 6, spacingAfterMm: 3 },
    skills: { fontSizePt: 10, lineHeight: 1.5, spacingBeforeMm: 4, spacingAfterMm: 3 },
    custom: { fontSizePt: 10, lineHeight: 1.5 },
  },
  layoutRules: {
    componentGapMm: 6,
    sectionHeading: { fontSizePt: 12, lineHeight: 1.5, bold: true, spacingBeforeMm: 8 },
    body: { fontSizePt: 11, lineHeight: 1.5 },
    dateAlign: 'right',
    photoSlot: 'top-right',
  },
  preview: 'tpl-zh-general-001',
  license: '自设计（ResumeCraft 团队，2026-10-29）',
  status: 'published',
}

// ─── 中文应届生（zh-student-001）────────────────────────

export const zhStudent001: TemplateDefinition = {
  id: 'zh-student-001',
  version: '1.0.0',
  languageTrack: 'zh',
  pageSettings: A4,
  theme: {
    primaryColor: '#2F76D2',
    accentColor: '#4B7168',
    bodyFont: 'rc-sans',
    headingFont: 'rc-sans',
    sectionDivider: 'color-block',
  },
  componentOrder: ['basics', 'education', 'project', 'skills', 'work', 'custom'],
  styles: {
    basics: { fontSizePt: 15, lineHeight: 1.6, bold: true, spacingAfterMm: 5 },
    education: { fontSizePt: 11, lineHeight: 1.6, spacingBeforeMm: 6, spacingAfterMm: 3 },
    project: { fontSizePt: 11, lineHeight: 1.6, spacingBeforeMm: 6, spacingAfterMm: 3 },
    skills: { fontSizePt: 10, lineHeight: 1.6, spacingBeforeMm: 4, spacingAfterMm: 3 },
    work: { fontSizePt: 11, lineHeight: 1.6, spacingBeforeMm: 6, spacingAfterMm: 3 },
    custom: { fontSizePt: 10, lineHeight: 1.6 },
  },
  layoutRules: {
    componentGapMm: 8,
    sectionHeading: { fontSizePt: 12, lineHeight: 1.5, bold: true, spacingBeforeMm: 8, color: '#2F76D2' },
    body: { fontSizePt: 11, lineHeight: 1.6 },
    dateAlign: 'inline',
    photoSlot: 'top-right',
  },
  preview: 'tpl-zh-student-001',
  license: '自设计（ResumeCraft 团队，2026-10-29）',
  status: 'published',
}

// ─── 英文经典（en-classic-001）──────────────────────────

export const enClassic001: TemplateDefinition = {
  id: 'en-classic-001',
  version: '1.0.0',
  languageTrack: 'en',
  pageSettings: A4,
  theme: {
    primaryColor: '#1a1a2e',
    accentColor: '#16213e',
    bodyFont: 'rc-serif',
    headingFont: 'rc-serif',
    sectionDivider: 'line',
  },
  componentOrder: ['basics', 'work', 'education', 'project', 'skills', 'custom'],
  styles: {
    basics: { fontSizePt: 16, lineHeight: 1.4, bold: true, spacingAfterMm: 3 },
    work: { fontSizePt: 11, lineHeight: 1.4, spacingBeforeMm: 5, spacingAfterMm: 2 },
    education: { fontSizePt: 11, lineHeight: 1.4, spacingBeforeMm: 5, spacingAfterMm: 2 },
    project: { fontSizePt: 11, lineHeight: 1.4, spacingBeforeMm: 5, spacingAfterMm: 2 },
    skills: { fontSizePt: 10, lineHeight: 1.4, spacingBeforeMm: 3, spacingAfterMm: 2 },
    custom: { fontSizePt: 10, lineHeight: 1.4 },
  },
  layoutRules: {
    componentGapMm: 4,
    sectionHeading: { fontSizePt: 11, lineHeight: 1.3, bold: true, spacingBeforeMm: 6 },
    body: { fontSizePt: 11, lineHeight: 1.4 },
    dateAlign: 'right',
    photoSlot: 'none',
  },
  preview: 'tpl-en-classic-001',
  license: '自设计（ResumeCraft 团队，2026-10-29）',
  status: 'published',
}

// ─── 英文现代（en-modern-001）───────────────────────────

export const enModern001: TemplateDefinition = {
  id: 'en-modern-001',
  version: '1.0.0',
  languageTrack: 'en',
  pageSettings: A4,
  theme: {
    primaryColor: '#2F76D2',
    accentColor: '#f0f4ff',
    bodyFont: 'rc-sans',
    headingFont: 'rc-sans',
    sectionDivider: 'color-block',
  },
  componentOrder: ['basics', 'work', 'project', 'education', 'skills', 'custom'],
  styles: {
    basics: { fontSizePt: 15, lineHeight: 1.5, bold: true, spacingAfterMm: 4 },
    work: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 5, spacingAfterMm: 2 },
    project: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 5, spacingAfterMm: 2 },
    education: { fontSizePt: 11, lineHeight: 1.5, spacingBeforeMm: 5, spacingAfterMm: 2 },
    skills: { fontSizePt: 10, lineHeight: 1.5, spacingBeforeMm: 3, spacingAfterMm: 2 },
    custom: { fontSizePt: 10, lineHeight: 1.5 },
  },
  layoutRules: {
    componentGapMm: 5,
    sectionHeading: { fontSizePt: 11, lineHeight: 1.3, bold: true, spacingBeforeMm: 6, color: '#2F76D2' },
    body: { fontSizePt: 11, lineHeight: 1.5 },
    dateAlign: 'left',
    photoSlot: 'none',
  },
  preview: 'tpl-en-modern-001',
  license: '自设计（ResumeCraft 团队，2026-10-29）',
  status: 'published',
}

/** 全部内置模板 */
export const builtinTemplates: TemplateDefinition[] = [
  zhGeneral001,
  zhStudent001,
  enClassic001,
  enModern001,
]
