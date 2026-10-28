/**
 * 文件写入适配器（TC-017 / FR-DOC-002 三档保存语义、12 章错误处理）
 * 契约 §6：`FileAccessAdapter{ canWriteBack(), writeBack(doc), download(doc) }`。
 *
 * 三档保存（PRD 4.4）在本层的落点：
 *  - 覆盖写回 writeBack：File System Access `createWritable` 原子写回原文件（仅 Chromium）
 *  - 下载副本 download：生成文件下载（其他浏览器的等价行为）
 *  - 自动保存在 autosave.ts（IndexedDB），与本接口无关
 *
 * 不变量 3：writeBack 与 download 在接口层是两个方法，UI 必须分别呈现；
 * 本文件额外提供 writeBackOrDownload 便利函数实现「FS Access 不可用 → 静默降级下载」，
 * 但它不替代两个原语，只做编排。
 *
 * 错误处理（12 章）：
 *  - 下载被拦截 → download-blocked，提示允许下载或改用其他保存方式
 *  - 权限未授予 → permission-denied（权限恢复须用户手势，见 requestWritePermission）
 *  - FS Access 不可用 → canWriteBack()=false，调用方降级 download
 */

import { exportBackupJson, buildBackupFileName } from './backup'
import { serialize } from '../model/serialize'
import { fail, ok, type Result, type ResumeDocument } from '../model/types'
import {
  STORAGE_ERROR_CODES,
  mapUnknownError,
  storageIssue,
  utf8ByteLength,
} from './types'
import type { DownloadResult, FileAccessAdapter, WriteBackResult } from './types'

// ---------------------------------------------------------------------------
// File System Access 结构子集（便于注入测试，生产句柄天然满足）
// ---------------------------------------------------------------------------

export type HandlePermissionState = 'granted' | 'denied' | 'prompt'

export interface FileSystemWritableLike {
  write(data: string): Promise<void>
  close(): Promise<void>
}

export interface FileSystemFileHandleLike {
  readonly name: string
  createWritable(): Promise<FileSystemWritableLike>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<HandlePermissionState>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<HandlePermissionState>
}

/** 句柄持久化（Chromium 支持把 FileSystemFileHandle 存进 IndexedDB）。 */
export interface FileHandleStore {
  load(): Promise<FileSystemFileHandleLike | null>
  save(handle: FileSystemFileHandleLike | null): Promise<void>
}

export interface DownloadPayload {
  text: string
  fileName: string
  mimeType: string
}

/** 触发下载；返回 false 表示下载被浏览器拦截。 */
export type DownloadFn = (payload: DownloadPayload) => boolean | Promise<boolean>

export interface FileAccessDeps {
  getHandle(): FileSystemFileHandleLike | null
  setHandle(handle: FileSystemFileHandleLike | null): void
  download: DownloadFn
  /** 可选：句柄持久化。省略则句柄仅存内存。 */
  handleStore?: FileHandleStore
  /** 注入时钟（ISO 字符串），默认真实时钟。 */
  now?: () => string
}

/** writeBackOrDownload 的统一回执。 */
export interface SaveOutcome {
  mode: 'write-back' | 'download'
  documentId: string
  fileName: string
  sizeBytes: number
}

/** 带句柄管理能力的文件适配器（接口方法与契约 §6 一致，附加方法供 UI 用）。 */
export interface FileAccessController extends FileAccessAdapter {
  /** 绑定/解绑原文件句柄并持久化。 */
  attachHandle(handle: FileSystemFileHandleLike | null): Promise<Result<void>>
  /** 从持久化存储恢复句柄（权限可能待定，须用户手势后再写）。 */
  restoreHandle(): Promise<Result<boolean>>
  /** 用户手势内请求写权限；成功后 canWriteBack 可直接写回。 */
  requestWritePermission(): Promise<Result<boolean>>
}

// ---------------------------------------------------------------------------
// 句柄持久化实现
// ---------------------------------------------------------------------------

export function createMemoryHandleStore(): FileHandleStore {
  let held: FileSystemFileHandleLike | null = null
  return {
    async load(): Promise<FileSystemFileHandleLike | null> {
      return held
    },
    async save(handle: FileSystemFileHandleLike | null): Promise<void> {
      held = handle
    },
  }
}

export interface IdbHandleStoreOptions {
  dbName?: string
  storeName?: string
  indexedDB?: IDBFactory
}

const HANDLE_DB_NAME = 'resumecraft'
const HANDLE_STORE_NAME = 'handles'
const HANDLE_KEY = 'current'
const HANDLE_DB_VERSION = 1

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('idb request failed'))
  })
}

/**
 * IndexedDB 句柄库。持久化失败不抛异常：
 * load 失败视为无句柄，save 失败静默忽略（句柄仅内存，不影响主流程）。
 */
export function createIdbHandleStore(options: IdbHandleStoreOptions = {}): FileHandleStore {
  const dbName = options.dbName ?? HANDLE_DB_NAME
  const storeName = options.storeName ?? HANDLE_STORE_NAME
  const factory: IDBFactory | null =
    options.indexedDB ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null

  async function withStore<T>(
    run: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T | null> {
    if (factory === null) return null
    try {
      const request = factory.open(dbName, HANDLE_DB_VERSION)
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName)
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('idb open failed'))
      })
      const tx = database.transaction(storeName, 'readwrite')
      const value = await run(tx.objectStore(storeName))
      database.close()
      return value
    } catch {
      return null
    }
  }

  return {
    async load(): Promise<FileSystemFileHandleLike | null> {
      const value = await withStore((store) =>
        requestToPromise<FileSystemFileHandleLike | undefined>(
          store.get(HANDLE_KEY) as IDBRequest<FileSystemFileHandleLike | undefined>,
        ),
      )
      return value ?? null
    },
    async save(handle: FileSystemFileHandleLike | null): Promise<void> {
      await withStore(async (store) => {
        if (handle === null) {
          await requestToPromise(store.delete(HANDLE_KEY) as IDBRequest<undefined>)
        } else {
          await requestToPromise(store.put(handle, HANDLE_KEY) as IDBRequest<IDBValidKey>)
        }
        return null
      })
    },
  }
}

// ---------------------------------------------------------------------------
// 环境探测与浏览器下载
// ---------------------------------------------------------------------------

/** File System Access 是否可用（Chromium 系列才有 showSaveFilePicker）。 */
export function isFileSystemAccessSupported(scope: unknown = globalThis): boolean {
  const holder = scope as { showSaveFilePicker?: unknown }
  return typeof holder?.showSaveFilePicker === 'function'
}

/**
 * 另存为选文件（须用户手势）。不可用或用户取消 → null，调用方降级 download。
 * 注意：这是 UI 层绑定句柄的入口，不属于契约 §6 三方法。
 */
export async function pickSaveFileHandle(
  suggestedName: string = 'resume.json',
): Promise<FileSystemFileHandleLike | null> {
  const picker = (globalThis as {
    showSaveFileHandle?: unknown
    showSaveFilePicker?: (options?: unknown) => Promise<unknown>
  }).showSaveFilePicker
  if (typeof picker !== 'function') return null
  try {
    const handle = await picker({
      suggestedName,
      types: [
        {
          description: 'Resume JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    return (handle as FileSystemFileHandleLike) ?? null
  } catch {
    return null
  }
}

/** 生产 DownloadFn：DOM 锚点下载。环境缺失/异常返回 false（视为被拦截）。 */
export function createBrowserDownloadFn(): DownloadFn {
  return (payload: DownloadPayload): boolean => {
    try {
      const doc = (globalThis as { document?: Document }).document
      const objectUrl = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void } }).URL
      if (!doc || typeof doc.createElement !== 'function') return false
      if (typeof objectUrl?.createObjectURL !== 'function') return false

      const blob = new Blob([payload.text], { type: payload.mimeType })
      const url = objectUrl.createObjectURL(blob)
      const anchor = doc.createElement('a')
      anchor.href = url
      anchor.download = payload.fileName
      anchor.rel = 'noopener'
      if (doc.body) {
        doc.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      } else {
        anchor.click()
      }
      if (typeof objectUrl.revokeObjectURL === 'function') objectUrl.revokeObjectURL(url)
      return true
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// FileAccessAdapter 实现
// ---------------------------------------------------------------------------

async function ensureWritePermission(
  handle: FileSystemFileHandleLike,
): Promise<HandlePermissionState> {
  // 句柄不带权限 API（如测试假句柄 / 老实现）→ 视为已授权
  if (typeof handle.queryPermission !== 'function') return 'granted'
  const descriptor = { mode: 'readwrite' as const }
  const current = await handle.queryPermission(descriptor)
  if (current === 'granted') return 'granted'
  if (current === 'denied') return 'denied'
  // prompt：必须在用户手势里 requestPermission，否则浏览器会直接拒
  if (typeof handle.requestPermission !== 'function') return 'denied'
  const next = await handle.requestPermission(descriptor)
  return next === 'granted' ? 'granted' : 'denied'
}

export function createFileAccessAdapter(deps: FileAccessDeps): FileAccessController {
  const adapter: FileAccessController = {
    canWriteBack(): boolean {
      return deps.getHandle() !== null
    },

    async writeBack(document: ResumeDocument): Promise<Result<WriteBackResult>> {
      const handle = deps.getHandle()
      if (handle === null) {
        return fail([storageIssue('writeBack', STORAGE_ERROR_CODES.unavailable, document.documentId)])
      }

      let permission: HandlePermissionState
      try {
        permission = await ensureWritePermission(handle)
      } catch (cause) {
        return fail([
          storageIssue('writeBack', mapUnknownError(cause), document.documentId, cause),
        ])
      }
      if (permission !== 'granted') {
        return fail([
          storageIssue('writeBack', STORAGE_ERROR_CODES.permissionDenied, document.documentId),
        ])
      }

      // 原子写回：createWritable 生成临时写入流，close 时替换原文件
      const json = exportBackupJson(document)
      try {
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        return ok({
          documentId: document.documentId,
          fileName: handle.name,
          sizeBytes: utf8ByteLength(json),
        })
      } catch (cause) {
        return fail([
          storageIssue('writeBack', mapUnknownError(cause), document.documentId, cause),
        ])
      }
    },

    async download(document: ResumeDocument): Promise<Result<DownloadResult>> {
      const json = exportBackupJson(document)
      const fileName = buildBackupFileName(document, deps.now?.() ?? '')
      try {
        const delivered = await Promise.resolve(
          deps.download({ text: json, fileName, mimeType: 'application/json' }),
        )
        if (!delivered) {
          return fail([
            storageIssue('download', STORAGE_ERROR_CODES.downloadBlocked, document.documentId),
          ])
        }
        return ok({
          documentId: document.documentId,
          fileName,
          sizeBytes: utf8ByteLength(json),
        })
      } catch (cause) {
        return fail([
          storageIssue('download', mapUnknownError(cause), document.documentId, cause),
        ])
      }
    },

    async attachHandle(handle: FileSystemFileHandleLike | null): Promise<Result<void>> {
      deps.setHandle(handle)
      if (deps.handleStore) {
        try {
          await deps.handleStore.save(handle)
        } catch (cause) {
          return fail([storageIssue('writeBack', mapUnknownError(cause), '', cause)])
        }
      }
      return ok<undefined>(undefined)
    },

    async restoreHandle(): Promise<Result<boolean>> {
      if (!deps.handleStore) return ok(false)
      try {
        const handle = await deps.handleStore.load()
        deps.setHandle(handle)
        return ok(handle !== null)
      } catch (cause) {
        return fail([storageIssue('writeBack', mapUnknownError(cause), '', cause)])
      }
    },

    async requestWritePermission(): Promise<Result<boolean>> {
      const handle = deps.getHandle()
      if (handle === null) {
        return fail([storageIssue('writeBack', STORAGE_ERROR_CODES.unavailable, '')])
      }
      try {
        const descriptor = { mode: 'readwrite' as const }
        if (typeof handle.requestPermission === 'function') {
          const state = await handle.requestPermission(descriptor)
          return ok(state === 'granted')
        }
        if (typeof handle.queryPermission === 'function') {
          const state = await handle.queryPermission(descriptor)
          return ok(state === 'granted')
        }
        return ok(true)
      } catch (cause) {
        return fail([
          storageIssue('writeBack', mapUnknownError(cause), '', cause),
        ])
      }
    },
  }

  return adapter
}

/**
 * 编排：能写回就覆盖写回，否则静默降级为下载副本（12 章）。
 * 仅当 File System Access 不可用（canWriteBack=false）时降级；
 * 写回失败不吞错、不偷偷转下载 —— 两个动作必须由用户明确选择（不变量 3）。
 */
export async function writeBackOrDownload(
  adapter: FileAccessAdapter,
  document: ResumeDocument,
): Promise<Result<SaveOutcome>> {
  if (adapter.canWriteBack()) {
    const written = await adapter.writeBack(document)
    if (!written.ok) return fail(written.errors)
    return ok({
      mode: 'write-back',
      documentId: written.value.documentId,
      fileName: written.value.fileName,
      sizeBytes: written.value.sizeBytes,
    })
  }
  const downloaded = await adapter.download(document)
  if (!downloaded.ok) return fail(downloaded.errors)
  return ok({
    mode: 'download',
    documentId: downloaded.value.documentId,
    fileName: downloaded.value.fileName,
    sizeBytes: downloaded.value.sizeBytes,
  })
}

/** 供测试/文档引用：紧凑序列化的写回字节数（与 writeBack 实际写入一致为可读 JSON）。 */
export function writeBackByteLength(document: ResumeDocument): number {
  return utf8ByteLength(serialize(document, 2))
}
