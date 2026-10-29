/**
 * 组件注册表运行时单例（接线层）
 *
 * 为什么需要这个文件：
 *   `definitions.ts` 里的 `ALL_COMPONENTS` 只是"声明了一堆定义"，从来没被注册进运行时注册表。
 *   结果 `registry.fieldsFor()` 永远返回空数组，文本提取、表单渲染、语言轨裁剪全线为空。
 *
 * 三条不变量：
 *  1. **注册在模块加载时完成**，不能指望调用方记得先调 `ensureComponentRegistry()`。
 *     忘记调用的代价是静默拿到空字段清单，比抛错难查得多。
 *  2. **幂等**：`register` 遇到重复 type 会抛错（那是编程错误），所以本模块自己守住"只注册一次"。
 *  3. 本模块**不解释**任何语言轨差异，也不做字段裁剪 —— 那是 registry 的职责。
 *
 * 注意：这里不给"每个消费方各建一个注册表"留口子。P0 只有一套组件集，
 * 多实例会让"某处注册了、某处没注册"这种缺陷重新出现。
 */

import { ALL_COMPONENTS } from './definitions'
import { createRegistry } from './registry'
import type { ComponentRegistry } from './registry'

/** 全局组件注册表。模块内唯一实例，进程内共享。 */
export const componentRegistry: ComponentRegistry = createRegistry()

let initialized = false

/**
 * 确保 `ALL_COMPONENTS` 已注册。
 * 重复调用无副作用；返回值可以让调用方直接链式取用。
 */
export function ensureComponentRegistry(): ComponentRegistry {
  if (initialized) return componentRegistry

  for (const definition of ALL_COMPONENTS) {
    componentRegistry.register(definition)
  }
  initialized = true
  return componentRegistry
}

// 模块加载即注册：任何 `import ... from 'components/runtime'` 都会带走已就绪的注册表。
ensureComponentRegistry()
