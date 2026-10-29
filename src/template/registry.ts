/**
 * 模板注册表（TC-009）
 * register / get / list / getPublished
 */

import type { TemplateDefinition } from './schema'

const registry = new Map<string, TemplateDefinition>()

/** 注册模板 */
export function registerTemplate(template: TemplateDefinition): void {
  if (!template.license) {
    throw new Error(`模板「${template.id}」缺少授权记录（FR-TPL-005），拒绝注册`)
  }
  registry.set(template.id, template)
}

/** 获取模板 */
export function getTemplate(id: string): TemplateDefinition | undefined {
  return registry.get(id)
}

/** 列出全部模板 */
export function listTemplates(): TemplateDefinition[] {
  return [...registry.values()]
}

/** 列出已发布的模板（供用户选择） */
export function getPublishedTemplates(): TemplateDefinition[] {
  return listTemplates().filter((t) => t.status === 'published')
}

/** 按语言轨筛选 */
export function getTemplatesByLanguage(track: string): TemplateDefinition[] {
  return listTemplates().filter((t) => t.languageTrack === track)
}

/** 清空注册表（测试用） */
export function clearRegistry(): void {
  registry.clear()
}
