/**
 * TC-017 文件写入适配器回归测试
 * 对照：CONTRACT §6 FileAccessAdapter{ canWriteBack, writeBack, download } + 不变量 3
 * （写回与下载是两个方法）+ 12 章错误处理（下载被拦截 / FS 不可用静默降级）。
 *
 * 策略：DOM 与 FS Access 全部注入假实现，Node 环境可跑。
 */

import { describe, expect, it } from 'vitest'

import {
  createFileAccessAdapter,
  createMemoryHandleStore,
  isFileSystemAccessSupported,
  writeBackOrDownload,
} from '../../src/storage/file-access'
import type {
  DownloadPayload,
  FileAccessDeps,
  FileHandleStore,
  FileSystemFileHandleLike,
  FileSystemWritableLike,
  HandlePermissionState,
} from '../../src/storage/file-access'
import { createDocument } from '../../src/model/factory'
import { deserialize } from '../../src/model/serialize'
import type { ResumeDocument } from '../../src/model/types'

const NOW = '2026-10-28T10:00:00.000Z'

function makeDoc(documentId: string = 'doc_file'): ResumeDocument {
  return createDocument({ documentId, now: NOW, title: '张明的简历' })
}

interface FakeHandleOptions {
  name?: string
  queryState?: HandlePermissionState
  requestState?: HandlePermissionState
  throwOnWrite?: boolean
}

interface FakeHandle {
  handle: FileSystemFileHandleLike
  written: string[]
  closeCount: () => number
}

function makeHandle(options: FakeHandleOptions = {}): FakeHandle {
  const written: string[] = []
  let closes = 0
  const handle: FileSystemFileHandleLike = {
    name: options.name ?? 'resume.json',
    async createWritable(): Promise<FileSystemWritableLike> {
      return {
        async write(data: string): Promise<void> {
          if (options.throwOnWrite) throw new Error('disk broken')
          written.push(data)
        },
        async close(): Promise<void> {
          closes += 1
        },
      }
    },
    async queryPermission(): Promise<HandlePermissionState> {
      return options.queryState ?? 'granted'
    },
    async requestPermission(): Promise<HandlePermissionState> {
      return options.requestState ?? 'granted'
    },
  }
  return { handle, written, closeCount: () => closes }
}

interface FakeDownload {
  downloads: DownloadPayload[]
  deliver: boolean
}

function makeDownload(deliver: boolean = true): FakeDownload {
  const downloads: DownloadPayload[] = []
  return {
    downloads,
    deliver,
  }
}

function makeDeps(
  handle: FileSystemFileHandleLike | null,
  download: FakeDownload,
  handleStore?: FileHandleStore,
): FileAccessDeps {
  let held = handle
  return {
    getHandle: () => held,
    setHandle: (next) => {
      held = next
    },
    download: (payload) => {
      download.downloads.push(payload)
      return download.deliver
    },
    handleStore,
    now: () => NOW,
  }
}

describe('file-access：writeBack 覆盖写回', () => {
  it('无句柄时 canWriteBack=false，writeBack 返回 unavailable', async () => {
    const adapter = createFileAccessAdapter(makeDeps(null, makeDownload()))
    expect(adapter.canWriteBack()).toBe(false)
    const result = await adapter.writeBack(makeDoc())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=unavailable')
    }
  })

  it('有句柄时 writeBack 写入可读 JSON 并回执文件名/字节数', async () => {
    const fake = makeHandle({ name: 'my-resume.json' })
    const adapter = createFileAccessAdapter(makeDeps(fake.handle, makeDownload()))
    const doc = makeDoc('doc_wb')

    expect(adapter.canWriteBack()).toBe(true)
    const result = await adapter.writeBack(doc)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fileName).toBe('my-resume.json')
      expect(result.value.documentId).toBe('doc_wb')
      expect(result.value.sizeBytes).toBeGreaterThan(0)
    }
    expect(fake.written).toHaveLength(1)
    expect(fake.closeCount()).toBe(1)
    const restored = deserialize(fake.written[0])
    expect(restored.ok).toBe(true)
  })

  it('权限 denied 时返回 permission-denied，且不写文件', async () => {
    const fake = makeHandle({ queryState: 'denied', requestState: 'denied' })
    const adapter = createFileAccessAdapter(makeDeps(fake.handle, makeDownload()))
    const result = await adapter.writeBack(makeDoc())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=permission-denied')
    }
    expect(fake.written).toHaveLength(0)
  })

  it('createWritable 抛错时返回 io-error，消息只含 id/操作/错误码', async () => {
    const fake = makeHandle({ throwOnWrite: true })
    const adapter = createFileAccessAdapter(makeDeps(fake.handle, makeDownload()))
    const result = await adapter.writeBack(makeDoc('doc_io'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const message = result.errors[0].message
      expect(message).toContain('code=io-error')
      expect(message).not.toContain('disk broken')
    }
  })
})

describe('file-access：download 下载副本', () => {
  it('download 成功返回生成的备份文件名（ASCII）与字节数', async () => {
    const download = makeDownload(true)
    const adapter = createFileAccessAdapter(makeDeps(null, download))
    const result = await adapter.download(makeDoc('doc_dl'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fileName).toMatch(/^resumecraft-backup-doc_dl-\d{8}\.json$/)
      expect(result.value.sizeBytes).toBeGreaterThan(0)
    }
    expect(download.downloads).toHaveLength(1)
    expect(download.downloads[0].mimeType).toBe('application/json')
  })

  it('下载被拦截返回 download-blocked，提示改用其他保存方式', async () => {
    const adapter = createFileAccessAdapter(makeDeps(null, makeDownload(false)))
    const result = await adapter.download(makeDoc('doc_block'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=download-blocked')
    }
  })
})

describe('file-access：降级编排与句柄持久化', () => {
  it('FS Access 不可用时 writeBackOrDownload 静默降级为 download', async () => {
    const download = makeDownload(true)
    const adapter = createFileAccessAdapter(makeDeps(null, download))
    const result = await writeBackOrDownload(adapter, makeDoc('doc_fallback'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.mode).toBe('download')
    }
    expect(download.downloads).toHaveLength(1)
  })

  it('有句柄时 writeBackOrDownload 走 write-back 模式', async () => {
    const fake = makeHandle()
    const download = makeDownload(true)
    const adapter = createFileAccessAdapter(makeDeps(fake.handle, download))
    const result = await writeBackOrDownload(adapter, makeDoc())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.mode).toBe('write-back')
    }
    expect(download.downloads).toHaveLength(0)
  })

  it('attachHandle / restoreHandle 经句柄库持久化', async () => {
    const store = createMemoryHandleStore()
    const download = makeDownload(true)
    const adapter = createFileAccessAdapter(makeDeps(null, download, store))
    const fake = makeHandle({ name: 'persisted.json' })

    expect(adapter.canWriteBack()).toBe(false)
    const attached = await adapter.attachHandle(fake.handle)
    expect(attached.ok).toBe(true)
    expect(adapter.canWriteBack()).toBe(true)

    // 新适配器实例从同一句柄库恢复
    const adapter2 = createFileAccessAdapter(makeDeps(null, download, store))
    expect(adapter2.canWriteBack()).toBe(false)
    const restored = await adapter2.restoreHandle()
    expect(restored.ok).toBe(true)
    if (restored.ok) {
      expect(restored.value).toBe(true)
    }
    expect(adapter2.canWriteBack()).toBe(true)
  })

  it('isFileSystemAccessSupported 按 showSaveFilePicker 判定', () => {
    expect(isFileSystemAccessSupported({ showSaveFilePicker: () => Promise.resolve(null) })).toBe(true)
    expect(isFileSystemAccessSupported({})).toBe(false)
  })
})
