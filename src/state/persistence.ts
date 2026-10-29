/**
 * 编辑器持久化装配（状态层）
 *
 * 职责：把 `AutosaveController`（TC-017）与适配器组装成编辑器直接可用的一组东西，
 * 并提供「恢复最近一份文档」这一个动作。
 *
 * 三条不变量：
 *  1. **降级必须显式**：拿不到 IndexedDB 就用内存适配器，`kind` 如实回报 `'memory'`，
 *     UI 据此提示「改动仅保存在内存」。绝不出现「徽标写已保存、刷新就没了」。
 *  2. 工厂**同步**返回：探测能力不需要 await（`globalThis.indexedDB` 在不在是确定的）；
 *     「库能不能真的打开」由 `restoreLatest()` / 第一次 save 暴露，失败会以 `error` 状态回到 UI。
 *  3. 不抛异常：适配器契约上就不抛，这里也不抛，失败一律用 `null` / 状态回调表达。
 */

import { AutosaveController } from '../storage/autosave'
import type { AutosaveStatusInfo } from '../storage/autosave'
import { createIdbStorageAdapter } from '../storage/idb-adapter'
import { createMemoryStorageAdapter } from '../storage/memory-adapter'
import type { StorageAdapter } from '../storage/types'
import type { ResumeDocument } from '../model/types'

/** 落盘方式。`'indexeddb'` 才是持久的；`'memory'` 是显式降级。 */
export type StorageKind = 'indexeddb' | 'memory'

export interface EditorPersistenceOptions {
  /** 防抖窗口（毫秒），默认沿用 AutosaveController 的 800 */
  debounceMs?: number
  /** 状态回调：store 用它回写 saveStatus / saveError */
  onStatus?: (info: AutosaveStatusInfo) => void
}

export interface EditorPersistence {
  controller: AutosaveController
  kind: StorageKind
  /** 恢复最近一份文档；没有记录（或读取失败）返回 null */
  restoreLatest(): Promise<ResumeDocument | null>
}

/** 环境是否**看起来**支持 IndexedDB。只是能力判断，不代表库一定打得开。 */
export function hasIndexedDb(): boolean {
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  return typeof factory === 'object' && factory !== null
}

export function createEditorPersistence(options: EditorPersistenceOptions = {}): EditorPersistence {
  const adapter: StorageAdapter = hasIndexedDb()
    ? createIdbStorageAdapter()
    : createMemoryStorageAdapter()

  const controllerOptions: ConstructorParameters<typeof AutosaveController>[0] = { adapter }
  if (options.debounceMs !== undefined) controllerOptions.debounceMs = options.debounceMs
  if (options.onStatus !== undefined) controllerOptions.onStatus = options.onStatus

  return {
    controller: new AutosaveController(controllerOptions),
    kind: hasIndexedDb() ? 'indexeddb' : 'memory',
    async restoreLatest() {
      const listed = await adapter.list()
      if (!listed.ok) return null
      // list() 已按 updatedAt 倒序（storage/types.ts 的 sortRecords），第一条就是最近编辑的
      const latest = listed.value[0]
      if (latest === undefined) return null
      const loaded = await adapter.load(latest.documentId)
      return loaded.ok ? loaded.value : null
    },
  }
}
