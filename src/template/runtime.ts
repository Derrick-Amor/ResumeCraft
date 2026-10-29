/**
 * 模板注册表运行时（接线层）
 *
 * 为什么需要这个文件：
 *   `builtinTemplates` 只是四个对象常量，从来没被注册进 `template/registry`。
 *   于是 `getTemplate()` 永远返回 undefined，`applyTemplate()` 一调就抛「模板不存在」——
 *   而调用方其实什么都没做错。
 *
 * 不变量：
 *  1. **幂等**：`registerTemplate` 会覆盖同 id 的旧条目，重复调用就会让"用户改了模板"
 *     这种将来可能存在的场景被静默回滚。所以这里先查 `getTemplate` 再注册。
 *  2. 加载即注册：调用方不必记得先调 `ensureBuiltinTemplates()`。
 */

import { getTemplate, registerTemplate } from './registry'
import { builtinTemplates } from './templates/builtin'

let initialized = false

/** 把内置模板注册进注册表。已存在的 id 跳过，不覆盖。 */
export function ensureBuiltinTemplates(): void {
  if (initialized) return

  for (const template of builtinTemplates) {
    if (getTemplate(template.id) !== undefined) continue
    registerTemplate(template)
  }
  initialized = true
}

ensureBuiltinTemplates()
