/**
 * 自动保存控制器（TC-017 / FR-DOC-003）
 * 契约 §6：StorageAdapter 的使用方之一；落点是「文档 JSON 定期写入 IndexedDB，
 * 显示保存状态，失败不显示已保存」。
 *
 * 状态机（const + union，禁 enum）：
 *   idle → pending → saving → saved
 *                     ↘ error（失败；下一次 schedule/flush 再重试）
 *
 * 节流策略（不丢数据）：
 *  - 防抖：debounceMs 窗口内多次 schedule 只保存一次，保存内容是最新文档
 *  - 保存进行中再次 schedule：本轮结束后发现指纹不一致 → 自动再排一轮
 *  - flush() 立即保存并等待收敛，用于离开页面/手动保存
 *
 * 失败语义（FR-DOC-003）：save 失败时状态必须是 error，
 * savedFingerprint 不更新 —— UI 依据状态展示，绝不显示"已保存"。
 */

import { documentFingerprint } from '../model/serialize'
import type { ModelIssue, Result, ResumeDocument } from '../model/types'
import { fail } from '../model/types'
import { STORAGE_ERROR_CODES, storageIssue } from './types'
import type { StorageAdapter } from './types'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutosaveStatusInfo {
  status: AutosaveStatus
  /** 最近一次成功保存时刻（ISO）；从未成功为 null */
  lastSavedAt: string | null
  /** 最近一次失败原因（脱敏）；成功后清空 */
  lastError: ModelIssue | null
  /** 已成功保存内容的指纹；与当前文档指纹比较可知有无未保存改动 */
  savedFingerprint: string | null
}

export interface AutosaveOptions {
  /** 只需要 save；云存二期的 CloudStorageAdapter 同样满足 */
  adapter: Pick<StorageAdapter, 'save'>
  /** 防抖窗口（毫秒），默认 800 */
  debounceMs?: number
  /** 注入时钟，返回 ISO 字符串；测试用 */
  now?: () => string
  /** 状态变化回调（UI 显示保存状态） */
  onStatus?: (info: AutosaveStatusInfo) => void
}

const DEFAULT_DEBOUNCE_MS = 800
const FLUSH_GUARD = 64

export class AutosaveController {
  private readonly adapter: Pick<StorageAdapter, 'save'>
  private readonly debounceMs: number
  private readonly now: () => string
  private readonly onStatus: ((info: AutosaveStatusInfo) => void) | null

  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private latest: ResumeDocument | null = null
  private disposed = false

  private status: AutosaveStatus = 'idle'
  private lastSavedAt: string | null = null
  private lastError: ModelIssue | null = null
  private savedFingerprint: string | null = null

  constructor(options: AutosaveOptions) {
    this.adapter = options.adapter
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.now = options.now ?? (() => new Date().toISOString())
    this.onStatus = options.onStatus ?? null
  }

  getStatus(): AutosaveStatusInfo {
    return {
      status: this.status,
      lastSavedAt: this.lastSavedAt,
      lastError: this.lastError,
      savedFingerprint: this.savedFingerprint,
    }
  }

  /** 当前文档是否还有未保存改动（FR-DOC-003：用户能看到保存状态）。 */
  hasUnsavedChanges(document: ResumeDocument): boolean {
    return this.savedFingerprint !== documentFingerprint(document)
  }

  /**
   * 登记最新文档并按防抖窗口排队保存。
   * 保存进行中调用：不打断本轮，结束后自动补一轮（节流不丢数据）。
   */
  schedule(document: ResumeDocument): void {
    if (this.disposed) return
    this.latest = document
    if (this.inflight !== null) return
    this.setStatus('pending')
    this.resetTimer()
  }

  /** 立即保存并等待状态收敛（跳过防抖）。失败不重试空转，返回当前状态。 */
  async flush(): Promise<AutosaveStatusInfo> {
    this.clearTimer()
    if (this.disposed) return this.getStatus()
    let guard = 0
    while (guard < FLUSH_GUARD) {
      guard += 1
      if (this.inflight !== null) {
        await this.inflight
        continue
      }
      if (this.latest === null) break
      if (this.status === 'error') break
      if (this.status === 'saved' && !this.isDirty()) break
      await this.kick()
    }
    return this.getStatus()
  }

  /**
   * 停止一切定时保存并丢弃未保存的排队改动（视为取消，状态复位 idle）。
   * 在途保存允许自然结束但不再改状态、不再触发回调。
   */
  dispose(): void {
    this.clearTimer()
    this.disposed = true
    this.latest = null
    this.status = 'idle'
  }

  // ------------------------- 内部实现 -------------------------

  private isDirty(): boolean {
    if (this.latest === null) return false
    return this.savedFingerprint !== documentFingerprint(this.latest)
  }

  private resetTimer(): void {
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.kick()
    }, this.debounceMs)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** 启动一轮保存；同一时刻最多一轮。 */
  private kick(): Promise<void> {
    if (this.inflight !== null) return this.inflight
    const run = this.runCycle()
    this.inflight = run
    void run.finally(() => {
      this.inflight = null
    })
    return run
  }

  private async runCycle(): Promise<void> {
    if (this.disposed) return
    const document = this.latest
    if (document === null) return
    if (this.status === 'saved' && !this.isDirty()) return

    const fingerprint = documentFingerprint(document)
    this.setStatus('saving')

    let outcome: Result<void>
    try {
      outcome = await this.adapter.save(document)
    } catch (cause) {
      // 适配器契约上不抛异常；真抛了也要兜住，且消息保持脱敏
      outcome = fail([storageIssue('autosave', STORAGE_ERROR_CODES.ioError, document.documentId, cause)])
    }

    if (this.disposed) return

    if (outcome.ok) {
      this.savedFingerprint = fingerprint
      this.lastSavedAt = this.now()
      this.lastError = null
      if (this.isDirty()) {
        // 保存期间又有新改动 → 再排一轮，最后一版内容一定落盘
        this.setStatus('pending')
        this.resetTimer()
      } else {
        this.setStatus('saved')
      }
    } else {
      this.lastError =
        outcome.errors[0] ?? storageIssue('autosave', STORAGE_ERROR_CODES.ioError, document.documentId)
      this.setStatus('error')
    }
  }

  private setStatus(next: AutosaveStatus): void {
    if (this.disposed) return
    this.status = next
    if (this.onStatus !== null) {
      this.onStatus(this.getStatus())
    }
  }
}
