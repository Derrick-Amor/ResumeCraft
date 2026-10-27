/**
 * 文档模型对外入口（TC-003）
 * 契约：docs/contract/CONTRACT.md §2。
 *
 * **四个唯一入口**：serialize / deserialize / migrate / validate。
 * 任何模块都不得自己 `JSON.parse` 文档——走这里。
 *
 * 模块边界：
 *   types.ts    结构与常量（无逻辑）
 *   factory.ts  造初始文档（不做校验）
 *   validate.ts 校验 + 规范化
 *   serialize.ts 序列化 / 反序列化 / 深拷贝 / 指纹
 *   migrate.ts  版本迁移（幂等）
 *   undo.ts     命令式 undo 栈
 */

export * from './types'

export {
  createComponent,
  createDocument,
  createId,
  DEFAULT_PAGE_SETTINGS,
  sortComponents,
} from './factory'
export type { CreateComponentOptions, CreateDocumentOptions } from './factory'

export { formatIssues, isValid, validate } from './validate'

export {
  cloneDocument,
  deserialize,
  documentFingerprint,
  documentsEqual,
  hasExtra,
  serialize,
  toJSON,
} from './serialize'

export { isMigrateIdempotent, migrate, MIGRATIONS } from './migrate'
export type { Migration, MigrateResult } from './migrate'

export { snapshot, UndoStack } from './undo'
export type { EditCommand, PushOptions, UndoStackOptions } from './undo'
