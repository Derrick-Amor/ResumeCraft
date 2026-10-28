/**
 * 简历组件集对外入口（TC-005）
 *
 * 对外只暴露三件事：
 *   1. 组件定义（ALL_COMPONENTS 与单个常量）
 *   2. 注册表工厂 createRegistry（契约 §3 的 register / get / list）
 *   3. 语言轨裁剪工具（fieldsFor / defaultFields / fieldLabel）
 *
 * 契约 §3 不变量 2：**语言轨差异只在组件声明里表达**。
 * 消费方（UI / 布局 / 模板）一律调 `filterFieldsForTrack` / `registry.fieldsFor`，
 * 不得自己写 `if (languageTrack === 'en')`。
 */

export {
  ALL_COMPONENTS,
  AWARDS,
  BASIC_INFO,
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  SKILLS,
  fieldsOfType,
} from './definitions'

export {
  createRegistry,
  defaultFields,
  fieldLabel,
  filterFieldsForTrack,
  validateFields,
} from './registry'

export type {
  ComponentDefinition,
  ComponentRegistry,
  FieldKind,
  FieldSpec,
  StyleLevels,
} from './registry'
