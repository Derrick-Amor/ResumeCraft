/**
 * 简历组件定义（TC-005）
 * 依据 PRD 第 8 章 + FR-CMP-001~010。每个组件把「中英双轨差异」写在声明里，
 * UI 层不写 if (languageTrack === 'en')（契约 §3 不变量 2）。
 *
 * 字段裁剪的三种做法，全部用声明表达：
 *   tracks: ['zh']        → 该字段只在中文简历出现（如照片）
 *   tracks: ['en']        → 只在英文简历出现
 *   labelByTrack: {...}   → 两条轨都出现，但显示名不同
 */

import { validateFields } from './registry'
import type { ComponentDefinition, FieldSpec } from './registry'
import type { LanguageTrack, Result } from '../model/types'

const date: FieldSpec = { key: 'start', label: '开始时间', kind: 'date' }
const dateEnd: FieldSpec = { key: 'end', label: '结束时间', kind: 'date' }
const bullets: FieldSpec = { key: 'bullets', label: '要点', kind: 'list' }

function spec(
  type: string,
  displayName: string,
  fields: FieldSpec[],
  defaults: Record<string, unknown>,
  styles: ComponentDefinition['styles'],
): ComponentDefinition {
  return {
    type,
    displayName,
    fields,
    validate: (input, track) => validateFields(fields, input, track),
    defaults: () => ({ ...defaults }),
    styles,
  }
}

/** L1 = 组件级（标题、分隔），L2 = 段落级（正文） */
const LEVELS = {
  section: {
    L1: { titleSizePt: 12, titleWeight: 600, ruleWidthPt: 1, gapBelowPt: 4 },
    L2: { lineHeight: 1.45, marginBottomPt: 6 },
  },
  entry: {
    L1: { titleSizePt: 10.5, titleWeight: 500, gapAbovePt: 8 },
    L2: { lineHeight: 1.55, bulletIndentPt: 10 },
  },
  body: {
    L1: { titleSizePt: 10.5, titleWeight: 500 },
    L2: { lineHeight: 1.55, marginBottomPt: 4 },
  },
} as const

export const BASIC_INFO: ComponentDefinition = spec(
  'basics',
  '基本信息',
  [
    { key: 'name', label: '姓名', required: true, kind: 'text' },
    {
      key: 'photo',
      label: '照片',
      tracks: ['zh'], // 英文简历不放照片
      kind: 'text',
    },
    { key: 'phone', label: '电话', required: true, kind: 'text' },
    { key: 'email', label: '邮箱', required: true, kind: 'link' },
    { key: 'location', label: '城市', kind: 'text' },
    {
      key: 'objective',
      label: '求职意向',
      labelByTrack: { en: 'Objective' },
      kind: 'text',
    },
  ],
  { name: '', photo: '', phone: '', email: '', location: '', objective: '' },
  LEVELS.body,
)

export const EDUCATION: ComponentDefinition = spec(
  'education',
  '教育经历',
  [
    { key: 'school', label: '学校', required: true, kind: 'text' },
    { key: 'major', label: '专业', required: true, kind: 'text' },
    {
      key: 'degree',
      label: '学历',
      labelByTrack: { en: 'Degree' },
      kind: 'text',
    },
    { ...date, label: '入学时间' },
    { ...dateEnd, label: '毕业时间' },
    {
      key: 'gpa',
      label: '绩点',
      tracks: ['zh'], // 英文简历用 Dean's List 等，不放 GPA
      kind: 'text',
    },
    { key: 'courses', label: '主修课程', kind: 'list' },
  ],
  { school: '', major: '', degree: '', start: '', end: '', gpa: '', courses: [] },
  LEVELS.entry,
)

export const EXPERIENCE: ComponentDefinition = spec(
  'experience',
  '工作 / 实习经历',
  [
    { key: 'company', label: '公司', required: true, kind: 'text' },
    {
      key: 'role',
      label: '职位',
      labelByTrack: { en: 'Title' },
      required: true,
      kind: 'text',
    },
    date,
    dateEnd,
    bullets,
  ],
  { company: '', role: '', start: '', end: '', bullets: [] },
  LEVELS.entry,
)

export const PROJECTS: ComponentDefinition = spec(
  'projects',
  '项目经历',
  [
    { key: 'name', label: '项目名', required: true, kind: 'text' },
    { key: 'role', label: '角色', kind: 'text' },
    {
      key: 'tech',
      label: '技术栈',
      labelByTrack: { en: 'Stack' },
      kind: 'text',
    },
    date,
    dateEnd,
    bullets,
  ],
  { name: '', role: '', tech: '', start: '', end: '', bullets: [] },
  LEVELS.entry,
)

export const SKILLS: ComponentDefinition = spec(
  'skills',
  '技能',
  [
    { key: 'name', label: '技能名', required: true, kind: 'text' },
    {
      key: 'level',
      label: '熟练度',
      tracks: ['zh'], // 英文简历用 proficiency 表达在 bullets 里，不单独列档
      kind: 'text',
    },
    { key: 'evidence', label: '佐证', kind: 'text' },
  ],
  { name: '', level: '', evidence: '' },
  LEVELS.body,
)

export const AWARDS: ComponentDefinition = spec(
  'awards',
  '荣誉与证书',
  [
    { key: 'name', label: '奖项', required: true, kind: 'text' },
    { key: 'date', label: '获得时间', kind: 'date' },
    {
      key: 'note',
      label: '备注',
      labelByTrack: { en: 'Note' },
      kind: 'text',
    },
  ],
  { name: '', date: '', note: '' },
  LEVELS.body,
)

/** P0 全部组件。顺序即默认插入顺序，也是注册表 list() 的返回顺序。 */
export const ALL_COMPONENTS: readonly ComponentDefinition[] = [
  BASIC_INFO,
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  SKILLS,
  AWARDS,
]

/** 便于测试与上层直接读某轨字段 */
export function fieldsOfType(
  definition: ComponentDefinition,
  track: LanguageTrack,
): FieldSpec[] {
  return definition.fields.filter((f) => !f.tracks || f.tracks.includes(track))
}

export type { Result }
