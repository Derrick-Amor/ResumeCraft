/**
 * TC-017 文件安全检查测试（FR-SEC-003）
 * 三道闸门：大小 / 类型 / 含宏
 */

import { describe, expect, it } from 'vitest'
import {
  detectThreat,
  extensionOf,
  securityCheck,
  DEFAULT_SECURITY_POLICY,
  MAX_FILE_BYTES,
  OLE2_MAGIC,
} from '../../src/storage/security'

function makeFileLike(name: string, content: string, type = 'application/json') {
  const bytes = new TextEncoder().encode(content)
  return {
    name,
    size: bytes.byteLength,
    type,
    text: () => Promise.resolve(content),
    arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
  }
}

function makeBinaryFile(name: string, bytes: Uint8Array, type = 'application/octet-stream') {
  return {
    name,
    size: bytes.byteLength,
    type,
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
  }
}

describe('extensionOf', () => {
  it('取小写扩展名（含点）', () => {
    expect(extensionOf('resume.JSON')).toBe('.json')
    expect(extensionOf('my.backup.json')).toBe('.json')
    expect(extensionOf('noext')).toBe('')
  })
})

describe('securityCheck — 类型/大小/含宏三道闸门', () => {
  it('合法 JSON 文件通过', async () => {
    const result = await securityCheck(makeFileLike('backup.json', '{"doc":"id"}'))
    expect(result.ok).toBe(true)
  })

  it('空扩展名被拒绝', async () => {
    const result = await securityCheck(makeFileLike('noext', 'x'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bad-extension')
  })

  it('不允许的扩展名被拒绝', async () => {
    const result = await securityCheck(makeFileLike('virus.exe', 'x'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bad-extension')
  })

  it('不允许的 MIME 被拒绝', async () => {
    const result = await securityCheck(
      makeFileLike('a.json', 'x', 'application/x-msdownload'),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bad-mime')
  })

  it('超大文件被拒绝', async () => {
    const big = 'x'.repeat(MAX_FILE_BYTES + 1)
    const result = await securityCheck(makeFileLike('big.json', big))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('file-too-large')
  })

  it('OLE2 宏容器被拒绝（在 .json 内容中嗅探到）', async () => {
    const bytes = new Uint8Array([...OLE2_MAGIC, 0, 0, 0, 0])
    const result = await securityCheck(makeBinaryFile('macro.json', bytes, 'application/json'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('macro-detected')
  })

  it('vbaProject 签名被拒绝', async () => {
    const bytes = new TextEncoder().encode('PK\x03\x04vbaProject.bin\x00')
    const result = await securityCheck(makeBinaryFile('m.json', bytes, 'application/json'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('macro-detected')
  })

  it('script 内容被拒绝', async () => {
    const bytes = new TextEncoder().encode('hello <script>alert(1)</script>')
    const result = await securityCheck(makeBinaryFile('s.json', bytes, 'application/json'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('script-detected')
  })

  it('reason 不含文件名（FR-SEC-004 脱敏）', async () => {
    const result = await securityCheck(makeFileLike('secret_name.json', 'x', 'bad/type'))
    if (!result.ok) expect(result.reason).not.toContain('secret_name')
  })

  it('空文件通过大小检查但可能被类型/宏检查拦截', async () => {
    const result = await securityCheck(makeFileLike('empty.json', ''))
    // 空 JSON 内容不应触发宏/脚本检测，但类型合法则应通过
    expect(result.ok).toBe(true)
  })
})

describe('detectThreat', () => {
  it('正常内容无威胁', () => {
    expect(detectThreat(new TextEncoder().encode('{"hello":"world"}'))).toBeNull()
  })

  it('OLE2 魔数检出', () => {
    const bytes = new Uint8Array(OLE2_MAGIC)
    expect(detectThreat(bytes)).toBe('macro-detected')
  })

  it('script 标签检出', () => {
    const bytes = new TextEncoder().encode('<script>evil()</script>')
    expect(detectThreat(bytes)).toBe('script-detected')
  })

  it('php 标签检出', () => {
    const bytes = new TextEncoder().encode('<?php system("rm"); ?>')
    expect(detectThreat(bytes)).toBe('script-detected')
  })
})

describe('DEFAULT_SECURITY_POLICY', () => {
  it('默认只允许 .json', () => {
    expect(DEFAULT_SECURITY_POLICY.allowedExtensions).toContain('.json')
    expect(DEFAULT_SECURITY_POLICY.allowedExtensions).toHaveLength(1)
  })

  it('默认上限 10 MiB', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024)
    expect(DEFAULT_SECURITY_POLICY.maxBytes).toBe(MAX_FILE_BYTES)
  })
})
