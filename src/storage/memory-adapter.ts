/**
 * 内存存储适配器（TC-017，测试与降级用）
 * 契约 §6：实现 StorageAdapter 全部六个方法，语义与 IndexedDB 实现完全一致。
 *
 * 用途：
 *  - 测试注入（参考 TC-006「后端可注入」模式），不依赖 IndexedDB
 *  - 无 IndexedDB 环境的显式降级（如隐私模式），行为可预期
 *
 * 隔离性：save 时落快照 JSON，load 时反序列化出新对象，
 * 调用方后续修改文档对象不会污染存储（与 IndexedDB 语义一致）。
 */

import { importBackupFile } from './backup'
import {
  STORAGE_ERROR_CODES,
  sortRecords,
  storageIssue,
  toStoredRecord,
  toStorageRecord,
} from './types'
import type { FileLike, StorageAdapter, StorageRecord, StoredRecord } from './types'
import { fail, ok, type Result, type ResumeDocument } from '../model/types'
import { deserialize } from '../model/serialize'

export interface MemoryStorageAdapter extends StorageAdapter {
  /** 测试辅助：清空全部记录。 */
  clear(): void
  /** 测试辅助：当前记录数。 */
  size(): number
  /** 测试辅助：按 id 窥视内部 JSON（不经反序列化）。 */
  peekJson(id: string): string | null
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

export function createMemoryStorageAdapter(): MemoryStorageAdapter {
  const records = new Map<string, StoredRecord>()

  const save = async (document: ResumeDocument): Promise<Result<void>> => {
    if (!isValidDocument(document)) {
      return fail([storageIssue('save', STORAGE_ERROR_CODES.invalidRecord, '')])
    }
    const record = toStoredRecord(document)
    records.set(record.documentId, record)
    return ok<undefined>(undefined)
  }

  return {
    save,

    async load(id: string): Promise<Result<ResumeDocument>> {
      const record = records.get(id)
      if (record === undefined) {
        return fail([storageIssue('load', STORAGE_ERROR_CODES.notFound, id)])
      }
      return deserialize(record.json)
    },

    async list(): Promise<Result<StorageRecord[]>> {
      const items = [...records.values()].map(toStorageRecord)
      return ok(sortRecords(items))
    },

    async remove(id: string): Promise<Result<void>> {
      if (!records.has(id)) {
        return fail([storageIssue('remove', STORAGE_ERROR_CODES.notFound, id)])
      }
      records.delete(id)
      return ok<undefined>(undefined)
    },

    async exportJSON(id: string): Promise<Result<string>> {
      const record = records.get(id)
      if (record === undefined) {
        return fail([storageIssue('exportJSON', STORAGE_ERROR_CODES.notFound, id)])
      }
      return ok(record.json)
    },

    async importJSON(file: FileLike): Promise<Result<ResumeDocument>> {
      const parsed = await importBackupFile(file)
      if (!parsed.ok) return parsed
      const saved = await save(parsed.value)
      if (!saved.ok) return saved
      return parsed
    },

    clear(): void {
      records.clear()
    },

    size(): number {
      return records.size
    },

    peekJson(id: string): string | null {
      const record = records.get(id)
      return record === undefined ? null : record.json
    },
  }
}
