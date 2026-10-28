/**
 * 持久化与数据安全对外入口（TC-017）
 * 契约：docs/contract/CONTRACT.md §6「MVP-5 持久化」。
 *
 * 模块边界：
 *   types.ts         类型、脱敏错误构造、记录映射纯函数
 *   idb-adapter.ts   IndexedDB 实现（生产，FR-SEC-001）
 *   memory-adapter.ts内存实现（测试 / 降级）
 *   file-access.ts   FileAccessAdapter（写回原文件 / 下载副本，FR-DOC-002）
 *   quota.ts         配额查询与引导（QuotaInfo）
 *   security.ts      SecurityCheck（类型 / 大小 / 含宏，FR-SEC-003）
 *   backup.ts        JSON 备份导出 / 恢复（FR-SEC-005）
 *   autosave.ts      自动保存状态机（FR-DOC-003）
 *
 * 使用约束（契约 §6 不变量 1）：业务核心不得直接调用 IndexedDB /
 * File System Access API，一律经本入口的接口注入。
 */

export type {
  FileAccessAdapter,
  DownloadResult,
  FileLike,
  QuotaInfo,
  SecurityCheckResult,
  SecurityIssueCode,
  StorageAdapter,
  StorageErrorCode,
  StorageOperation,
  StorageRecord,
  StoredRecord,
  WriteBackResult,
} from './types'
export {
  STORAGE_ERROR_CODES,
  mapUnknownError,
  modelIssueCodeOf,
  sortRecords,
  storageIssue,
  toStorageRecord,
  toStoredRecord,
  utf8ByteLength,
} from './types'

export type { SecurityPolicy } from './security'
export {
  DEFAULT_SECURITY_POLICY,
  MAX_FILE_BYTES,
  OLE2_MAGIC,
  SCRIPT_SIGNATURES,
  VBA_PROJECT_SIGNATURE,
  detectThreat,
  extensionOf,
  securityCheck,
} from './security'

export { backupByteLength, buildBackupFileName, exportBackupJson, importBackupFile, parseBackup } from './backup'

export type {
  NavigatorLike,
  QuotaEstimate,
  QuotaLevel,
  QuotaProvider,
  QuotaThresholds,
  StorageEstimateLike,
} from './quota'
export {
  DEFAULT_QUOTA_THRESHOLDS,
  computePercent,
  createFixedQuotaProvider,
  createNavigatorQuotaProvider,
  quotaGuidance,
  quotaLevel,
  queryQuota,
} from './quota'

export type { IdbStorageOptions } from './idb-adapter'
export { createIdbStorageAdapter } from './idb-adapter'

export type { MemoryStorageAdapter } from './memory-adapter'
export { createMemoryStorageAdapter } from './memory-adapter'

export type {
  DownloadFn,
  DownloadPayload,
  FileAccessController,
  FileAccessDeps,
  FileHandleStore,
  FileSystemFileHandleLike,
  FileSystemWritableLike,
  HandlePermissionState,
  IdbHandleStoreOptions,
  SaveOutcome,
} from './file-access'
export {
  createBrowserDownloadFn,
  createFileAccessAdapter,
  createIdbHandleStore,
  createMemoryHandleStore,
  isFileSystemAccessSupported,
  pickSaveFileHandle,
  writeBackByteLength,
  writeBackOrDownload,
} from './file-access'

export type { AutosaveOptions, AutosaveStatus, AutosaveStatusInfo } from './autosave'
export { AutosaveController } from './autosave'
