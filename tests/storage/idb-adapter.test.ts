/**
 * TC-017 IndexedDB 存储适配器回归测试
 * 对照：CONTRACT §6 StorageAdapter + FR-SEC-001（默认本地保存）+ 12 章（配额满）。
 *
 * Node 环境没有 IndexedDB，按「后端可注入」模式（TC-006 先例）注入一个
 * 最小内存版 IDBFactory（零依赖，只覆盖适配器用到的 open/put/get/getAll/delete），
 * 并可模拟 QuotaExceededError。
 */

import { describe, expect, it } from 'vitest'

import { createIdbStorageAdapter } from '../../src/storage/idb-adapter'
import { createComponent, createDocument } from '../../src/model/factory'
import { documentsEqual } from '../../src/model/serialize'
import type { ResumeDocument } from '../../src/model/types'
import type { FileLike } from '../../src/storage/types'

// ---------------------------------------------------------------------------
// 最小内存版 IDBFactory（测试专用假实现）
// ---------------------------------------------------------------------------

type FakeHandler = (() => void) | null

interface FakeRequest {
  result: unknown
  error: Error | null
  onsuccess: FakeHandler
  onerror: FakeHandler
  onupgradeneeded: FakeHandler
}

interface FakeStore {
  put(value: unknown): FakeRequest
  get(key: string): FakeRequest
  getAll(): FakeRequest
  delete(key: string): FakeRequest
}

interface FakeFactory {
  open(name: string, version?: number): FakeRequest
  /** 置 true 后所有 put 触发 QuotaExceededError */
  failPutWithQuota: boolean
}

function newRequest(): FakeRequest {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }
}

function succeed(request: FakeRequest, value: unknown): void {
  queueMicrotask(() => {
    request.result = value
    request.onsuccess?.()
  })
}

function failRequest(request: FakeRequest, error: Error): void {
  queueMicrotask(() => {
    request.error = error
    request.onerror?.()
  })
}

function createFakeIdb(): FakeFactory {
  /** dbName → storeName → keyPath 值 → 记录 */
  const data = new Map<string, Map<string, Map<string, unknown>>>()
  const storeNames = new Map<string, Set<string>>()

  const factory: FakeFactory = {
    failPutWithQuota: false,

    open(name: string): FakeRequest {
      const request = newRequest()
      if (!data.has(name)) {
        data.set(name, new Map())
        storeNames.set(name, new Set())
      }
      const stores = data.get(name) as Map<string, Map<string, unknown>>
      const names = storeNames.get(name) as Set<string>

      const makeStore = (storeName: string): FakeStore => {
        const bucket = (): Map<string, unknown> => {
          if (!stores.has(storeName)) stores.set(storeName, new Map())
          return stores.get(storeName) as Map<string, unknown>
        }
        return {
          put(value: unknown): FakeRequest {
            const req = newRequest()
            queueMicrotask(() => {
              if (factory.failPutWithQuota) {
                failRequest(req, new DOMException('quota exceeded', 'QuotaExceededError'))
                return
              }
              const record = value as { documentId?: string }
              const key = typeof record?.documentId === 'string' ? record.documentId : 'unknown'
              bucket().set(key, structuredClone(value))
              succeed(req, key)
            })
            return req
          },
          get(key: string): FakeRequest {
            const req = newRequest()
            const value = bucket().get(key)
            succeed(req, value === undefined ? undefined : structuredClone(value))
            return req
          },
          getAll(): FakeRequest {
            const req = newRequest()
            succeed(req, [...bucket().values()].map((v) => structuredClone(v)))
            return req
          },
          delete(key: string): FakeRequest {
            const req = newRequest()
            bucket().delete(key)
            succeed(req, undefined)
            return req
          },
        }
      }

      const db = {
        objectStoreNames: {
          contains(storeName: string): boolean {
            return names.has(storeName)
          },
        },
        createObjectStore(storeName: string): FakeStore {
          names.add(storeName)
          return makeStore(storeName)
        },
        transaction(storeName: string): { objectStore(n: string): FakeStore } {
          return { objectStore: () => makeStore(storeName) }
        },
        close(): void {
          /* 假实现无需释放资源 */
        },
      }

      queueMicrotask(() => {
        request.result = db
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
  return factory
}

// ---------------------------------------------------------------------------
// 测试样板
// ---------------------------------------------------------------------------

const NOW = '2026-10-28T10:00:00.000Z'

function makeDoc(documentId: string, title: string): ResumeDocument {
  return createDocument({
    documentId,
    now: NOW,
    title,
    components: [
      createComponent({ id: 'cmp_1', type: 'basics', order: 0, fields: { name: '张明' } }),
    ],
  })
}

function makeFile(name: string, content: string): FileLike {
  return {
    name,
    size: content.length,
    type: 'application/json',
    async text(): Promise<string> {
      return content
    },
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new TextEncoder().encode(content).buffer
    },
  }
}

describe('idb-adapter：基本读写与语义对齐', () => {
  it('save → load 往返与原文档深等', async () => {
    const adapter = createIdbStorageAdapter({ indexedDB: createFakeIdb() as unknown as IDBFactory })
    const doc = makeDoc('doc_idb', '张明的简历')

    const saved = await adapter.save(doc)
    expect(saved.ok).toBe(true)

    const loaded = await adapter.load('doc_idb')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(documentsEqual(loaded.value, doc)).toBe(true)
    }
  })

  it('save 同 id 覆盖；list 元数据按更新时间倒序', async () => {
    const fake = createFakeIdb()
    const adapter = createIdbStorageAdapter({ indexedDB: fake as unknown as IDBFactory })

    await adapter.save(makeDoc('doc_a', '初版'))
    const updated = createDocument({
      documentId: 'doc_a',
      now: '2026-10-28T12:00:00.000Z',
      title: '改后版本',
    })
    await adapter.save(updated)
    await adapter.save(makeDoc('doc_b', '另一份'))

    const listed = await adapter.list()
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value[0].documentId).toBe('doc_a')
      expect(listed.value[0].title).toBe('改后版本')
      expect(listed.value).toHaveLength(2)
    }
  })

  it('remove 后 load 返回 not-found；remove 不存在的 id 也返回 not-found', async () => {
    const adapter = createIdbStorageAdapter({ indexedDB: createFakeIdb() as unknown as IDBFactory })
    await adapter.save(makeDoc('doc_a', '待删'))

    const removed = await adapter.remove('doc_a')
    expect(removed.ok).toBe(true)

    const loaded = await adapter.load('doc_a')
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) {
      expect(loaded.errors[0].message).toContain('code=not-found')
    }

    const again = await adapter.remove('doc_a')
    expect(again.ok).toBe(false)
    if (!again.ok) {
      expect(again.errors[0].message).toContain('code=not-found')
    }
  })
})

describe('idb-adapter：备份与错误处理', () => {
  it('exportJSON → importJSON 恢复往返', async () => {
    const adapter = createIdbStorageAdapter({ indexedDB: createFakeIdb() as unknown as IDBFactory })
    const doc = makeDoc('doc_backup', '备份文档')
    await adapter.save(doc)

    const exported = await adapter.exportJSON('doc_backup')
    expect(exported.ok).toBe(true)
    if (exported.ok) {
      const restored = await adapter.importJSON(makeFile('backup.json', exported.value))
      expect(restored.ok).toBe(true)
      if (restored.ok) {
        expect(documentsEqual(restored.value, doc)).toBe(true)
      }
    }
  })

  it('配额超限返回 quota-exceeded，消息只含 id/操作/错误码（FR-SEC-004）', async () => {
    const fake = createFakeIdb()
    fake.failPutWithQuota = true
    const adapter = createIdbStorageAdapter({ indexedDB: fake as unknown as IDBFactory })
    const doc = makeDoc('doc_quota', '含电话13800138000的标题')

    const saved = await adapter.save(doc)
    expect(saved.ok).toBe(false)
    if (!saved.ok) {
      const message = saved.errors[0].message
      expect(message).toContain('code=quota-exceeded')
      expect(message).toContain('save')
      expect(message).toContain('doc_quota')
      // 日志最小化：错误消息不得出现正文/电话/邮箱
      expect(message).not.toContain('13800138000')
      expect(message).not.toContain('标题')
    }
  })

  it('环境缺失 IndexedDB 时返回 unavailable', async () => {
    const adapter = createIdbStorageAdapter({ indexedDB: undefined })
    const saved = await adapter.save(makeDoc('doc_x', '无库环境'))
    expect(saved.ok).toBe(false)
    if (!saved.ok) {
      expect(saved.errors[0].message).toContain('code=unavailable')
    }
  })
})
