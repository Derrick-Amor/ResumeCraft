import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { APP_VERSION } from '../src/version'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}

describe('工程骨架冒烟', () => {
  it('APP_VERSION 是合法 semver', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  })

  it('APP_VERSION 与 package.json 的 version 一致', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('包名与产品一致', () => {
    expect(pkg.name).toBe('resumecraft')
  })
})
