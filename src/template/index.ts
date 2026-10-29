/**
 * 模板系统（TC-009 / fe-content）
 * 契约：docs/contract/CONTRACT.md §9「MVP-8 模板」
 *
 * 模块边界：
 *   schema.ts            TemplateDefinition / MappingReport 类型
 *   registry.ts          register / get / list / getPublished
 *   apply.ts             applyTemplate(doc, templateId) → { doc, mappingReport, undoToken }
 *   templates/builtin.ts 4 套内置模板
 */

export type {
  TemplateDefinition,
  TemplateTheme,
  TemplateLayoutRules,
  TemplateStatus,
  ComponentStyle,
  MappingReport,
  ApplyTemplateResult,
} from './schema'

export {
  registerTemplate,
  getTemplate,
  listTemplates,
  getPublishedTemplates,
  getTemplatesByLanguage,
  clearRegistry,
} from './registry'

export { applyTemplate } from './apply'

export {
  builtinTemplates,
  zhGeneral001,
  zhStudent001,
  enClassic001,
  enModern001,
} from './templates/builtin'
