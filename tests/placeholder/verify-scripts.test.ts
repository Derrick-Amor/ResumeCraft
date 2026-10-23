import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(new URL('../../scripts/verify.mjs', import.meta.url))

function runVerify(name: string): { stdout: string; status: number | null } {
  const result = spawnSync(process.execPath, [scriptPath, name], { encoding: 'utf8' })
  return { stdout: result.stdout, status: result.status }
}

describe.each(['layout', 'export', 'import'])('verify:%s 占位脚本', (name) => {
  it('可执行、退出码 0，且明确打印 PLACEHOLDER 与未实现卡号', () => {
    const { stdout, status } = runVerify(name)
    expect(status).toBe(0)
    expect(stdout).toContain('PLACEHOLDER:')
    expect(stdout).toMatch(/TC-\d+/)
    expect(stdout).toContain('未实现')
  })

  it('未知参数不被当成通过（退出码非 0）', () => {
    const { status } = runVerify('not-a-real-verify')
    expect(status).not.toBe(0)
  })
})
