/**
 * TC-017 JSON 备份导出 / 恢复回归测试
 * 对照：FR-SEC-005（JSON 备份核心）+ FR-DOC-002（导出 JSON 备份入口）
 * + CONTRACT §2 不变量 5（serialize/deserialize 往返深等）。
 */

import { describe, expect, it } from 'vitest'

import {
  backupByteLength,
  buildBackupFileName,
  exportBackupJson,
  importBackupFile,
  parseBackup,
} from '../../src/storage/backup'
import { createComponent, createDocument } from '../../src/model/factory'
import { deserialize, documentsEqual, serialize } from '../../src/model/serialize'
import type { ResumeDocument } from '../../src/model/types'
import type { FileLike } from '../../src/storage/types'

const NOW = '2026-10-28T10:00:00.000Z'

function makeDoc(documentId: string = 'doc_backup'): ResumeDocument {
  return createDocument({
    documentId,
    now: NOW,
    title: '张明的简历',
    components: [
      createComponent({
        id: 'cmp_1',
        type: 'basics',
        order: 0,
        fields: { name: '张明', phone: '13800138000' },
      }),
    ],
  })
}

function makeFile(name: string, content: string, type: string = 'application/json'): FileLike {
  return {
    name,
    size: content.length,
    type,
    async text(): Promise<string> {
      return content
    },
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new TextEncoder().encode(content).buffer
    },
  }
}

describe('exportBackupJson / parseBackup：往返', () => {
  it('导出的备份 JSON 可被 parseBackup 还原且深等', () => {
    const doc = makeDoc()
    const json = exportBackupJson(doc)
    expect(json).toContain('\n') // 带缩进、人类可读

    const parsed = parseBackup(json)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(documentsEqual(parsed.value, doc)).toBe(true)
    }
  })

  it('exportBackupJson 与 serialize 语义一致（deserialize 均可还原）', () => {
    const doc = makeDoc()
    const viaCompact = deserialize(serialize(doc))
    const viaBackup = parseBackup(exportBackupJson(doc))
    expect(viaCompact.ok).toBe(true)
    expect(viaBackup.ok).toBe(true)
    if (viaCompact.ok && viaBackup.ok) {
      expect(documentsEqual(viaCompact.value, viaBackup.value)).toBe(true)
    }
  })

  it('parseBackup 拒绝非法 JSON 文本', () => {
    const parsed = parseBackup('{ broken')
    expect(parsed.ok).toBe(false)
  })
})

describe('parseBackup：结构与版本闸门', () => {
  it('拒绝非对象与缺 documentId 的结构', () => {
    expect(parseBackup('[]').ok).toBe(false)
    expect(parseBackup('{"schemaVersion":1}').ok).toBe(false)
  })

  it('拒绝未来 schemaVersion（提示升级应用）', () => {
    const doc = makeDoc()
    const raw = JSON.parse(exportBackupJson(doc)) as Record<string, unknown>
    raw.schemaVersion = 999
    const parsed = parseBackup(JSON.stringify(raw))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.errors[0].code).toBe('unsupported-version')
    }
  })
})

describe('importBackupFile：安全检查 + 恢复', () => {
  it('合法备份文件成功恢复为文档', async () => {
    const doc = makeDoc('doc_from_file')
    const file = makeFile('backup.json', exportBackupJson(doc))
    const result = await importBackupFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(documentsEqual(result.value, doc)).toBe(true)
    }
  })

  it('含宏文件被安全闸门拒绝，错误码 security-blocked', async () => {
    const file = makeFile('evil.json', 'PK fake vbaProject.bin')
    const result = await importBackupFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=security-blocked')
    }
  })

  it('文件读取失败返回 io-error，不抛异常', async () => {
    const file: FileLike = {
      name: 'broken.json',
      size: 10,
      type: 'application/json',
      async text(): Promise<string> {
        throw new Error('read fail')
      },
      async arrayBuffer(): Promise<ArrayBuffer> {
        return new ArrayBuffer(0)
      },
    }
    const result = await importBackupFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].message).toContain('code=io-error')
      expect(result.errors[0].message).not.toContain('read fail')
    }
  })
})

describe('buildBackupFileName：文件名规则', () => {
  it('生成 ASCII 文件名，含 documentId 与 8 位日期', () => {
    const doc = makeDoc('doc_fixed')
    expect(buildBackupFileName(doc)).toBe('resumecraft-backup-doc_fixed-20261028.json')
  })

  it('非法日期兜底为 backup，特殊字符被替换', () => {
    const doc = makeDoc('文档/ID*1')
    doc.meta.updatedAt = 'not-a-date'
    const name = buildBackupFileName(doc)
    expect(name).toContain('resumecraft-backup-')
    expect(name).toContain('backup.json')
    expect(name).not.toMatch(/[^\x20-\x7e]/) // 全 ASCII
  })

  it('nowIso 显式覆盖默认时间戳；backupByteLength 报告字节数', () => {
    const doc = makeDoc('doc_x')
    expect(buildBackupFileName(doc, '2027-01-02T00:00:00.000Z')).toBe(
      'resumecraft-backup-doc_x-20270102.json',
    )
    expect(backupByteLength('abc')).toBe(3)
    expect(backupByteLength('中文')).toBe(6)
  })
})
