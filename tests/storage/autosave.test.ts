/**
 * TC-017 自动保存控制器回归测试
 * 对照：FR-DOC-003（定期写入 IndexedDB、显示保存状态、失败不显示"已保存"）
 * + PRD 4.4 自动保存档 + 节流不丢数据。
 *
 * 策略：vitest 假时钟驱动防抖窗口；可控 save 适配器模拟慢保存/失败。
 * 全部时间显式注入，可重复。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AutosaveController } from '../../src/storage/autosave'
import type { AutosaveStatus, AutosaveStatusInfo } from '../../src/storage/autosave'
import { createMemoryStorageAdapter } from '../../src/storage/memory-adapter'
import { STORAGE_ERROR_CODES, storageIssue } from '../../src/storage/types'
import { createDocument } from '../../src/model/factory'
import { documentFingerprint } from '../../src/model/serialize'
import { fail, ok, type Result, type ResumeDocument } from '../../src/model/types'

const NOW = '2026-10-28T10:00:00.000Z'

function makeDoc(title: string): ResumeDocument {
  return createDocument({ documentId: 'doc_auto', now: NOW, title })
}

/** 可控适配器：每次 save 挂起直到 release，可切换成功/失败。 */
function createGatedAdapter(): {
  adapter: { save(doc: ResumeDocument): Promise<Result<void>> }
  saved: ResumeDocument[]
  releaseAll: () => void
  setMode: (mode: 'ok' | 'fail') => void
} {
  const saved: ResumeDocument[] = []
  const pending: Array<() => void> = []
  let mode: 'ok' | 'fail' = 'ok'
  return {
    saved,
    releaseAll(): void {
      while (pending.length > 0) {
        const resolve = pending.pop()
        if (resolve) resolve()
      }
    },
    setMode(next: 'ok' | 'fail'): void {
      mode = next
    },
    adapter: {
      async save(doc: ResumeDocument): Promise<Result<void>> {
        saved.push(doc)
        await new Promise<void>((resolve) => {
          pending.push(resolve)
        })
        if (mode === 'fail') {
          return fail([storageIssue('save', STORAGE_ERROR_CODES.ioError, doc.documentId)])
        }
        return ok<undefined>(undefined)
      },
    },
  }
}

describe('AutosaveController：防抖与节流', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('防抖：窗口内多次 schedule 只保存一次，内容为最后一次', async () => {
    const adapter = createMemoryStorageAdapter()
    const saveSpy = vi.spyOn(adapter, 'save')
    const controller = new AutosaveController({ adapter, debounceMs: 800, now: () => NOW })

    controller.schedule(makeDoc('第一版'))
    controller.schedule(makeDoc('第二版'))
    controller.schedule(makeDoc('第三版'))
    expect(saveSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    const info = controller.getStatus()
    expect(info.status).toBe('saved')
    if (saveSpy.mock.calls[0]) {
      const savedDoc = saveSpy.mock.calls[0][0] as ResumeDocument
      expect(savedDoc.meta.title).toBe('第三版')
    }
  })

  it('节流不丢数据：保存进行中再 schedule，最终落盘的是最新内容', async () => {
    const gated = createGatedAdapter()
    const controller = new AutosaveController({
      adapter: gated.adapter,
      debounceMs: 800,
      now: () => NOW,
    })

    const docA = makeDoc('A 版')
    const docB = makeDoc('B 版')

    controller.schedule(docA)
    await vi.advanceTimersByTimeAsync(800) // 触发保存 A（挂起中）
    expect(gated.saved).toHaveLength(1)
    expect(controller.getStatus().status).toBe('saving')

    controller.schedule(docB) // 保存进行中登记新内容
    gated.releaseAll()
    await vi.advanceTimersByTimeAsync(0) // 让保存 A 收尾 → 自动排下一轮

    expect(controller.getStatus().status).toBe('pending')
    await vi.advanceTimersByTimeAsync(800) // 触发保存 B
    gated.releaseAll()
    await vi.advanceTimersByTimeAsync(0)

    expect(gated.saved).toHaveLength(2)
    expect(gated.saved[0].meta.title).toBe('A 版')
    expect(gated.saved[1].meta.title).toBe('B 版')
    expect(controller.getStatus().status).toBe('saved')
    expect(controller.getStatus().savedFingerprint).toBe(documentFingerprint(docB))
    expect(controller.hasUnsavedChanges(docB)).toBe(false)
  })

  it('flush 跳过防抖立即保存，之后定时器不再重复保存', async () => {
    const adapter = createMemoryStorageAdapter()
    const saveSpy = vi.spyOn(adapter, 'save')
    const controller = new AutosaveController({ adapter, debounceMs: 800, now: () => NOW })

    controller.schedule(makeDoc('立即保存'))
    const info = await controller.flush()
    expect(info.status).toBe('saved')
    expect(saveSpy).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })
})

describe('AutosaveController：状态机与失败语义', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('状态序列：idle → pending → saving → saved', async () => {
    const adapter = createMemoryStorageAdapter()
    const seen: AutosaveStatus[] = []
    const controller = new AutosaveController({
      adapter,
      debounceMs: 800,
      now: () => NOW,
      onStatus: (info: AutosaveStatusInfo) => {
        seen.push(info.status)
      },
    })

    expect(controller.getStatus().status).toBe('idle')
    controller.schedule(makeDoc('状态机'))
    await vi.advanceTimersByTimeAsync(800)

    expect(seen).toEqual(['pending', 'saving', 'saved'])
    const info = controller.getStatus()
    expect(info.lastSavedAt).toBe(NOW)
    expect(info.lastError).toBe(null)
    expect(info.savedFingerprint).toBe(documentFingerprint(makeDoc('状态机')))
  })

  it('保存失败状态为 error，绝不出现 saved（失败不显示已保存）', async () => {
    const gated = createGatedAdapter()
    gated.setMode('fail')
    const seen: AutosaveStatus[] = []
    const controller = new AutosaveController({
      adapter: gated.adapter,
      debounceMs: 800,
      now: () => NOW,
      onStatus: (info: AutosaveStatusInfo) => {
        seen.push(info.status)
      },
    })

    const doc = makeDoc('13800138000 的简历')
    controller.schedule(doc)
    await vi.advanceTimersByTimeAsync(800)
    gated.releaseAll()
    await vi.advanceTimersByTimeAsync(0)

    const info = controller.getStatus()
    expect(info.status).toBe('error')
    expect(seen).not.toContain('saved')
    expect(info.lastSavedAt).toBe(null)
    expect(info.savedFingerprint).toBe(null)
    expect(info.lastError).not.toBe(null)
    // FR-SEC-004：错误消息只含 id/操作/错误码，不含正文/电话
    if (info.lastError) {
      expect(info.lastError.message).not.toContain('13800138000')
      expect(info.lastError.message).not.toContain('简历')
      expect(info.lastError.message).toContain('code=io-error')
    }
    expect(controller.hasUnsavedChanges(doc)).toBe(true)

    // flush 不会空转重试，也不会谎报成功
    const flushed = await controller.flush()
    expect(flushed.status).toBe('error')
  })

  it('适配器抛异常兜底为 error（契约上不抛，但必须设防）', async () => {
    const controller = new AutosaveController({
      adapter: {
        save: async () => {
          throw new Error('boom')
        },
      },
      debounceMs: 800,
      now: () => NOW,
    })
    controller.schedule(makeDoc('异常兜底'))
    await vi.advanceTimersByTimeAsync(800)
    await vi.advanceTimersByTimeAsync(0)

    const info = controller.getStatus()
    expect(info.status).toBe('error')
    if (info.lastError) {
      expect(info.lastError.message).toContain('code=io-error')
      expect(info.lastError.message).not.toContain('boom')
    }
  })

  it('dispose 后不再触发保存；空闲 flush 不报错', async () => {
    const adapter = createMemoryStorageAdapter()
    const saveSpy = vi.spyOn(adapter, 'save')
    const controller = new AutosaveController({ adapter, debounceMs: 800, now: () => NOW })

    controller.schedule(makeDoc('将被丢弃'))
    controller.dispose()
    await vi.advanceTimersByTimeAsync(5000)
    expect(saveSpy).not.toHaveBeenCalled()

    const info = await controller.flush()
    expect(saveSpy).not.toHaveBeenCalled()
    expect(info.status).not.toBe('saving')
  })
})
