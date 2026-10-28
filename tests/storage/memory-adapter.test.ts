/**
 * TC-017 内存存储适配器回归测试
 * 对照：docs/contract/CONTRACT.md §6 StorageAdapter 六方法语义 + FR-SEC-005（JSON 备份核心）。
 *
 * 约定：所有文档显式传 documentId / now，不依赖真实时钟，保证可重复。
 */

import { describe, expect, it } from 'vitest'

import {
  createComponent,
  createDocument,
  deserialize,
  documentsEqual,
  serialize,
} from '../../src/model'
import type { ResumeDocument } from '../../src/model'
import { createMemoryStorageAdapter } from '../../src/storage/memory-adapter'
import { utf8ByteLength } from '../../src/storage/types'
import type { FileLike } from '../../src/storage/types'

const NOW = '2026-10-28T10:00:00.000Z'
const LATER = '2026-10-28T11:00:00.000Z'

function makeDoc(documentId: string = 'doc_fixed', now: string = NOW): ResumeDocument {
  return createDocument({
    documentId,
    now,
    createdAt: now,
    title: '张明的简历',
    languageTrack: 'zh',
    components: [
      createComponent({
        id: 'cmp_1',
        type: 'basics',
        order: 0,
        fields: { name: '张明', email: 'zhangming.dev@example.com' },
      }),
      createComponent({
        id: 'cmp_2',
        type: 'education',
        order: 1,
        fields: { school: '华南理工大学', major: '软件工程' },
      }),
    ],
  })
}

function makeFile(name: string, content: string, type: string = 'application/json'): FileLike {
  return {
    name,
    size: utf8ByteLength(content),
    type,
    async text(): Promise<string> {
      return content
    },
    async arrayBuffer(): Promise<ArrayBuffer> {
      const bytes = new TextEncoder().encode(content)
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    },
  }
}

describe('内存适配器：save / load 往返', () => {
  it('保存后能按 id 读回，内容深等', async () => {
    const adapter = createMemoryStorageAdapter()
    const doc = makeDoc()

    const saved = await adapter.save(doc)
    expect(saved.ok).toBe(true)

    const loaded = await adapter.load('doc_fixed')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(documentsEqual(loaded.value, doc)).toBe(true)
    }
  })

  it('save 同 id 覆盖旧内容，不产生重复记录', async () => {
    const adapter = createMemoryStorageAdapter()
    await adapter.save(makeDoc())
    const updated = makeDoc()
    updated.meta.title = '张明的简历（修订）'

    await adapter.save(updated)
    expect(adapter.size()).toBe(1)

    const loaded = await adapter.load('doc_fixed')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.meta.title).toBe('张明的简历（修订）')
    }
  })

  it('save 后修改原文档对象不影响存储快照', async () => {
    const adapter = createMemoryStorageAdapter()
    const doc = makeDoc()
    await adapter.save(doc)

    doc.meta.title = '被外部改掉的标题'
    const loaded = await adapter.load('doc_fixed')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.meta.title).toBe('张明的简历')
    }
  })

  it('load 不存在的文档返回 not-found，消息只含 id / 操作 / 错误码', async () => {
    const adapter = createMemoryStorageAdapter()
    const loaded = await adapter.load('doc_missing')
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) {
      expect(loaded.errors).toHaveLength(1)
      expect(loaded.errors[0].message).toContain('doc_missing')
      expect(loaded.errors[0].message).toContain('load')
      expect(loaded.errors[0].message).toContain('not-found')
      // 脱敏：错误消息不得携带正文/电话/邮箱
      expect(loaded.errors[0].message).not.toContain('张明')
      expect(loaded.errors[0].message).not.toContain('zhangming.dev@example.com')
    }
  })

  it('非法文档（缺 documentId）保存被拒为 invalid-record', async () => {
    const adapter = createMemoryStorageAdapter()
    const bad = { meta: { title: 'x', createdAt: NOW, updatedAt: NOW } } as unknown as ResumeDocument
    const saved = await adapter.save(bad)
    expect(saved.ok).toBe(false)
    if (!saved.ok) {
      expect(saved.errors[0].message).toContain('invalid-record')
    }
    expect(adapter.size()).toBe(0)
  })
})

describe('内存适配器：完整往返（save → load → remove → list → exportJSON → importJSON）', () => {
  it('六步全功能往返一致', async () => {
    const adapter = createMemoryStorageAdapter()
    const doc = makeDoc()

    // 1. save
    expect((await adapter.save(doc)).ok).toBe(true)
    // 2. load
    const loaded = await adapter.load('doc_fixed')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(documentsEqual(loaded.value, doc)).toBe(true)
    // 3. list
    const listed = await adapter.list()
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value).toHaveLength(1)
      expect(listed.value[0].documentId).toBe('doc_fixed')
    }
    // 4. exportJSON
    const exported = await adapter.exportJSON('doc_fixed')
    expect(exported.ok).toBe(true)
    // 5. remove
    expect((await adapter.remove('doc_fixed')).ok).toBe(true)
    expect((await adapter.load('doc_fixed')).ok).toBe(false)
    expect(adapter.size()).toBe(0)
    // 6. importJSON 恢复
    if (exported.ok) {
      const restored = await adapter.importJSON(makeFile('backup.json', exported.value))
      expect(restored.ok).toBe(true)
      if (restored.ok) {
        expect(documentsEqual(restored.value, doc)).toBe(true)
      }
      expect(adapter.size()).toBe(1)
    }
  })

  it('remove 不存在的文档返回 not-found', async () => {
    const adapter = createMemoryStorageAdapter()
    const removed = await adapter.remove('doc_missing')
    expect(removed.ok).toBe(false)
    if (!removed.ok) expect(removed.errors[0].message).toContain('not-found')
  })

  it('exportJSON 不存在的文档返回 not-found', async () => {
    const adapter = createMemoryStorageAdapter()
    const exported = await adapter.exportJSON('doc_missing')
    expect(exported.ok).toBe(false)
    if (!exported.ok) expect(exported.errors[0].message).toContain('not-found')
  })

  it('list 元数据不含正文 JSON，且按 updatedAt 倒序、同刻按 documentId 升序', async () => {
    const adapter = createMemoryStorageAdapter()
    await adapter.save(makeDoc('doc_a', NOW))
    await adapter.save(makeDoc('doc_b', LATER))
    await adapter.save(makeDoc('doc_c', NOW))

    const listed = await adapter.list()
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value.map((r) => r.documentId)).toEqual(['doc_b', 'doc_a', 'doc_c'])
      for (const record of listed.value) {
        expect('json' in record).toBe(false)
        expect(record.title).toBe('张明的简历')
        expect(record.sizeBytes).toBeGreaterThan(0)
        expect(record.sizeBytes).toBe(utf8ByteLength(serialize(makeDoc(record.documentId, NOW))))
      }
    }
  })

  it('importJSON 拒绝含宏文件（安全检查内建于导入路径）', async () => {
    const adapter = createMemoryStorageAdapter()
    // OLE2 魔数必须走原始字节；经 UTF-8 文本编码会破坏魔数，故直接构造 FileLike
    const ole2Bytes = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00])
    const evil: FileLike = {
      name: 'evil.json',
      size: ole2Bytes.byteLength,
      type: 'application/json',
      async text(): Promise<string> {
        return ''
      },
      async arrayBuffer(): Promise<ArrayBuffer> {
        return ole2Bytes.buffer.slice(
          ole2Bytes.byteOffset,
          ole2Bytes.byteOffset + ole2Bytes.byteLength,
        ) as ArrayBuffer
      },
    }
    const result = await adapter.importJSON(evil)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const codes = result.errors.map((e) => e.message).join(' ')
      expect(codes).toMatch(/security-blocked|invalid-record/)
    }
    expect(adapter.size()).toBe(0)
  })

  it('exportJSON 输出可被 deserialize 还原（备份即事实源）', async () => {
    const adapter = createMemoryStorageAdapter()
    const doc = makeDoc()
    await adapter.save(doc)
    const exported = await adapter.exportJSON('doc_fixed')
    expect(exported.ok).toBe(true)
    if (exported.ok) {
      const parsed = deserialize(exported.value)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(documentsEqual(parsed.value, doc)).toBe(true)
    }
  })
})
