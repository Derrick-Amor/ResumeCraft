/**
 * IndexedDB 存储适配器（TC-017，生产实现）
 * 契约 §6：实现 StorageAdapter；FR-SEC-001 默认本地保存（IndexedDB）。
 *
 * 零新依赖：直接封装原生 IndexedDB（不用 idb/dexie）。
 * 可注入 IDBFactory：测试传内存假实现，生产默认 globalThis.indexedDB。
 *
 * 语义与 memory-adapter 完全一致：
 *  - save 覆盖写入、remove/exportJSON/load 缺失 → not-found
 *  - 配额超限（QuotaExceededError）→ quota-exceeded，调用方据此引导备份/清理
 *  - 所有错误经 storageIssue 脱敏（FR-SEC-004）
 */

import { deserialize } from '../model/serialize'
import { fail, ok, type Result, type ResumeDocument } from '../model/types'
import { importBackupFile } from './backup'
import {
  STORAGE_ERROR_CODES,
  mapUnknownError,
  sortRecords,
  storageIssue,
  toStoredRecord,
  toStorageRecord,
} from './types'
import type { FileLike, StorageAdapter, StorageRecord, StoredRecord } from './types'

export interface IdbStorageOptions {
  /** 数据库名，默认 'resumecraft' */
  dbName?: string
  /** 对象仓库名，默认 'documents' */
  storeName?: string
  /** 注入的 IndexedDB 工厂；缺省取 globalThis.indexedDB */
  indexedDB?: IDBFactory
}

const DEFAULT_DB_NAME = 'resumecraft'
const DEFAULT_STORE_NAME = 'documents'
const DB_VERSION = 1

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('idb request failed'))
  })
}

function openDatabase(factory: IDBFactory, dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(dbName, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'documentId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('idb open failed'))
  })
}

function isValidDocument(document: ResumeDocument | null | undefined): boolean {
  return (
    typeof document === 'object' &&
    document !== null &&
    typeof document.documentId === 'string' &&
    document.documentId !== '' &&
    typeof document.meta === 'object' &&
    document.meta !== null
  )
}

export function createIdbStorageAdapter(options: IdbStorageOptions = {}): StorageAdapter {
  const dbName = options.dbName ?? DEFAULT_DB_NAME
  const storeName = options.storeName ?? DEFAULT_STORE_NAME
  const factory: IDBFactory | null =
    options.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null

  let dbPromise: Promise<IDBDatabase> | null = null

  /** 懒开库；同一适配器实例复用连接。 */
  const db = (): Promise<IDBDatabase> => {
    if (dbPromise === null) {
      if (factory === null) {
        const unavailable = new Error('indexedDB unavailable')
        unavailable.name = 'IdbUnavailableError'
        dbPromise = Promise.reject(unavailable)
      } else {
        dbPromise = openDatabase(factory, dbName, storeName)
      }
    }
    return dbPromise
  }

  const save = async (document: ResumeDocument): Promise<Result<void>> => {
    if (!isValidDocument(document)) {
      return fail([storageIssue('save', STORAGE_ERROR_CODES.invalidRecord, '')])
    }
    try {
      const record = toStoredRecord(document)
      const database = await db()
      const tx = database.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      await requestToPromise(store.put(record) as IDBRequest<IDBValidKey>)
      return ok<undefined>(undefined)
    } catch (cause) {
      return fail([
        storageIssue('save', mapUnknownError(cause), document.documentId, cause),
      ])
    }
  }

  return {
    save,

    async load(id: string): Promise<Result<ResumeDocument>> {
      try {
        const database = await db()
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const raw = await requestToPromise<StoredRecord | undefined>(
          store.get(id) as IDBRequest<StoredRecord | undefined>,
        )
        if (raw === undefined) {
          return fail([storageIssue('load', STORAGE_ERROR_CODES.notFound, id)])
        }
        return deserialize(raw.json)
      } catch (cause) {
        return fail([storageIssue('load', mapUnknownError(cause), id, cause)])
      }
    },

    async list(): Promise<Result<StorageRecord[]>> {
      try {
        const database = await db()
        const tx = database.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const raw = await requestToPromise<StoredRecord[]>(
          store.getAll() as IDBRequest<StoredRecord[]>,
        )
        const items = (raw ?? []).map(toStorageRecord)
        return ok(sortRecords(items))
      } catch (cause) {
        return fail([storageIssue('list', mapUnknownError(cause), '', cause)])
      }
    },

    async remove(id: string): Promise<Result<void>> {
      try {
        const database = await db()
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const existing = await requestToPromise<StoredRecord | undefined>(
          store.get(id) as IDBRequest<StoredRecord | undefined>,
        )
        if (existing === undefined) {
          return fail([storageIssue('remove', STORAGE_ERROR_CODES.notFound, id)])
        }
        await requestToPromise(store.delete(id) as IDBRequest<undefined>)
        return ok<undefined>(undefined)
      } catch (cause) {
        return fail([storageIssue('remove', mapUnknownError(cause), id, cause)])
      }
    },

    async exportJSON(id: string): Promise<Result<string>> {
      try {
        const database = await db()
        const tx = database.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const raw = await requestToPromise<StoredRecord | undefined>(
          store.get(id) as IDBRequest<StoredRecord | undefined>,
        )
        if (raw === undefined) {
          return fail([storageIssue('exportJSON', STORAGE_ERROR_CODES.notFound, id)])
        }
        return ok(raw.json)
      } catch (cause) {
        return fail([storageIssue('exportJSON', mapUnknownError(cause), id, cause)])
      }
    },

    async importJSON(file: FileLike): Promise<Result<ResumeDocument>> {
      const parsed = await importBackupFile(file)
      if (!parsed.ok) return parsed
      const saved = await save(parsed.value)
      if (!saved.ok) return saved
      return parsed
    },
  }
}
