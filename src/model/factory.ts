/**
 * 文档工厂（TC-003）
 * 只做"造一个合法的初始文档"，不做校验——校验归 validate.ts。
 */

import {
  SUPPORTED_SCHEMA_VERSION,
  type AnyComponent,
  type DocumentMeta,
  type LanguageTrack,
  type PageSettings,
  type ResumeComponent,
  type ResumeDocument,
} from './types'

/** A4 纵向，页边距 20mm。与 --rc-layout-page-margin 不同：那是屏幕纸面内边距，这里是物理页边距。 */
export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paper: 'A4',
  orientation: 'portrait',
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 20,
  marginRightMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 20,
}

/** 生成唯一 id。浏览器与 Node 19+ 都有 globalThis.crypto.randomUUID。 */
export function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}_${uuid}`
  // 极老环境兜底：时间戳 + 随机串。同一毫秒内可能碰撞，仅用于非关键路径。
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export interface CreateDocumentOptions {
  documentId?: string
  languageTrack?: LanguageTrack
  title?: string
  pageSettings?: Partial<PageSettings>
  components?: AnyComponent[]
  createdAt?: string
  /** 不传则取 new Date().toISOString()；测试请显式传，保持确定性。 */
  now?: string
}

export function createDocument(options: CreateDocumentOptions = {}): ResumeDocument {
  const now = options.now ?? new Date().toISOString()
  const meta: DocumentMeta = {
    title: options.title ?? '未命名简历',
    createdAt: options.createdAt ?? now,
    updatedAt: now,
  }

  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    documentId: options.documentId ?? createId('doc'),
    languageTrack: options.languageTrack ?? 'zh',
    pageSettings: { ...DEFAULT_PAGE_SETTINGS, ...options.pageSettings },
    components: options.components ?? [],
    meta,
  }
}

export interface CreateComponentOptions {
  id?: string
  type: string
  order: number
  visible?: boolean
  fields?: Record<string, unknown>
  style?: Record<string, unknown>
}

export function createComponent(options: CreateComponentOptions): ResumeComponent {
  const component: ResumeComponent = {
    id: options.id ?? createId('cmp'),
    type: options.type,
    order: options.order,
    visible: options.visible ?? true,
    fields: options.fields ?? {},
  }
  if (options.style !== undefined) component.style = options.style
  return component
}

/** 按 order 升序的浅拷贝，不修改入参。 */
export function sortComponents(components: readonly AnyComponent[]): AnyComponent[] {
  return [...components].sort((a, b) => a.order - b.order)
}
