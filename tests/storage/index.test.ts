/**
 * TC-017 存储层导出完整性测试
 * 验证 index.ts 正确导出契约 §6 的全部公开 API
 */

import { describe, expect, it } from 'vitest'
import * as storage from '../../src/storage'
import { createMemoryStorageAdapter } from '../../src/storage/memory-adapter'

describe('storage 模块导出完整性', () => {
  it('导出 STORAGE_ERROR_CODES', () => {
    expect(storage.STORAGE_ERROR_CODES.notFound).toBe('not-found')
    expect(storage.STORAGE_ERROR_CODES.quotaExceeded).toBe('quota-exceeded')
  })

  it('导出 securityCheck 与相关常量', () => {
    expect(typeof storage.securityCheck).toBe('function')
    expect(typeof storage.detectThreat).toBe('function')
    expect(storage.MAX_FILE_BYTES).toBe(10 * 1024 * 1024)
    expect(storage.DEFAULT_SECURITY_POLICY.allowedExtensions).toContain('.json')
  })

  it('导出 backup 函数', () => {
    expect(typeof storage.exportBackupJson).toBe('function')
    expect(typeof storage.parseBackup).toBe('function')
    expect(typeof storage.importBackupFile).toBe('function')
  })

  it('导出 quota 函数', () => {
    expect(typeof storage.queryQuota).toBe('function')
    expect(typeof storage.quotaLevel).toBe('function')
    expect(typeof storage.quotaGuidance).toBe('function')
    expect(typeof storage.computePercent).toBe('function')
  })

  it('导出 autosave', () => {
    expect(typeof storage.AutosaveController).toBe('function')
  })

  it('导出 factory 函数', () => {
    expect(typeof storage.createMemoryStorageAdapter).toBe('function')
    expect(typeof storage.createIdbStorageAdapter).toBe('function')
  })

  it('导出 file-access 函数', () => {
    expect(typeof storage.createFileAccessAdapter).toBe('function')
    expect(typeof storage.isFileSystemAccessSupported).toBe('function')
  })

  it('导出 storageIssue（FR-SEC-004 脱敏）', () => {
    expect(typeof storage.storageIssue).toBe('function')
    const issue = storage.storageIssue('save', 'not-found', 'doc_1')
    expect(issue.message).toContain('doc_1')
    expect(issue.message).not.toContain('正文')
  })

  it('两个适配器接口一致（契约不变量 2）', () => {
    const mem = createMemoryStorageAdapter()
    for (const m of ['save', 'load', 'list', 'remove', 'exportJSON', 'importJSON']) {
      expect(typeof (mem as unknown as Record<string, unknown>)[m]).toBe('function')
    }
  })

  it('sortRecords / toStorageRecord 可用', () => {
    const sorted = storage.sortRecords([
      { documentId: 'b', title: '', createdAt: '', updatedAt: '2026-01-02', schemaVersion: 1, sizeBytes: 0 },
      { documentId: 'a', title: '', createdAt: '', updatedAt: '2026-01-01', schemaVersion: 1, sizeBytes: 0 },
    ])
    expect(sorted[0].documentId).toBe('b')
    expect(typeof storage.toStorageRecord).toBe('function')
    expect(typeof storage.toStoredRecord).toBe('function')
    expect(typeof storage.utf8ByteLength).toBe('function')
  })
})
