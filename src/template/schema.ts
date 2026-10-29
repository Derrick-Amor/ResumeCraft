/**
 * 模板 Schema（TC-009 / fe-content）
 * 契约：docs/contract/CONTRACT.md §9「MVP-8 模板」
 *
 * `TemplateDefinition{ id, version, languageTrack, pageSettings, theme, componentOrder,
 *                      styles, layoutRules, preview, license }`
 *
 * 不变量：
 *  1. 已识别字段切换模板后零丢失
 *  2. 无法映射的内容进 pending
 *  3. 操作可撤销（返回 undoToken）
 *  4. license 字段不可为空（FR-TPL-005）
 */

import type { LanguageTrack, PageSettings } from '../model/types'

/** 模板质量状态（PRD 9.4） */
export type TemplateStatus = 'draft' | 'review' | 'approved' | 'published' | 'disabled'

/** 模板主题 */
export interface TemplateTheme {
  /** 主色（HEX） */
  primaryColor: string
  /** 辅助色（HEX） */
  accentColor: string
  /** 正文字体 key */
  bodyFont: 'rc-sans' | 'rc-serif'
  /** 标题字体 key */
  headingFont: 'rc-sans' | 'rc-serif'
  /** 分节线样式 */
  sectionDivider: 'line' | 'spacing' | 'color-block'
}

/** 组件样式档（L1 基础 / L2 增强） */
export interface ComponentStyle {
  fontSizePt: number
  lineHeight: number
  bold?: boolean
  color?: string
  spacingBeforeMm?: number
  spacingAfterMm?: number
}

/** 布局规则 */
export interface TemplateLayoutRules {
  /** 组件间距（mm） */
  componentGapMm: number
  /** 小节标题样式 */
  sectionHeading: ComponentStyle
  /** 正文样式 */
  body: ComponentStyle
  /** 日期对齐方式 */
  dateAlign: 'left' | 'right' | 'inline'
  /** 照片位（中文简历惯例） */
  photoSlot: 'none' | 'top-right' | 'top-left'
}

/** 映射报告（契约 §9 原文） */
export interface MappingReport {
  /** 已成功映射的组件 ID */
  preserved: string[]
  /** 未能映射、进待处理列表的组件 ID */
  pending: string[]
  /** 映射过程中的警告 */
  warnings: string[]
}

/** 模板定义（契约 §9 原文字段，一个不多一个不少） */
export interface TemplateDefinition {
  /** 模板唯一 ID，如 'zh-general-001' */
  id: string
  /** 语义版本号 */
  version: string
  /** 语言轨 */
  languageTrack: LanguageTrack
  /** 页面设置 */
  pageSettings: PageSettings
  /** 主题 */
  theme: TemplateTheme
  /** 组件排列顺序 */
  componentOrder: string[]
  /** 各组件样式档 */
  styles: Record<string, ComponentStyle>
  /** 布局规则 */
  layoutRules: TemplateLayoutRules
  /** 预览资源（缩略图 URL 或 CSS 类名） */
  preview: string
  /** 授权记录（FR-TPL-005，不可为空） */
  license: string
  /** 质量状态（PRD 9.4） */
  status: TemplateStatus
}

/** applyTemplate 返回值（契约 §9 原文） */
export interface ApplyTemplateResult {
  doc: ReturnType<typeof import('../model/factory').createDocument>
  mappingReport: MappingReport
  /** 供 undo 栈回滚的 token */
  undoToken: string
}
