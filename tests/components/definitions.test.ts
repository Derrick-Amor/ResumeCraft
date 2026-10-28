/**
 * TC-005：组件定义回归测试
 * 重点验「语言轨差异写在声明里」（契约 §3 不变量 2），而不是在 UI 层判断。
 */

import { describe, expect, it } from 'vitest'

import {
  ALL_COMPONENTS,
  AWARDS,
  BASIC_INFO,
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  SKILLS,
  fieldsOfType,
} from '../../src/components/definitions'
import { createRegistry, defaultFields, filterFieldsForTrack } from '../../src/components/registry'

describe('组件清单', () => {
  it('P0 共 6 个组件，type 唯一', () => {
    expect(ALL_COMPONENTS).toHaveLength(6)
    const types = ALL_COMPONENTS.map((d) => d.type)
    expect(new Set(types).size).toBe(types.length)
    expect(types).toEqual(['basics', 'education', 'experience', 'projects', 'skills', 'awards'])
  })

  it('每个组件都能登记进注册表（不重复、不冲突）', () => {
    const registry = createRegistry()
    for (const d of ALL_COMPONENTS) registry.register(d)
    expect(registry.list()).toHaveLength(6)
  })

  it('每个组件都带 L1 与 L2 样式档（不变量 ③）', () => {
    for (const d of ALL_COMPONENTS) {
      expect(Object.keys(d.styles.L1).length).toBeGreaterThan(0)
      expect(Object.keys(d.styles.L2).length).toBeGreaterThan(0)
    }
  })

  it('每个组件都有必填字段，避免建出空壳', () => {
    for (const d of ALL_COMPONENTS) {
      expect(d.fields.some((f) => f.required === true)).toBe(true)
    }
  })
})

describe('语言轨裁剪（不变量 ②）', () => {
  it('照片只在中文简历出现', () => {
    expect(fieldsOfType(BASIC_INFO, 'zh').map((f) => f.key)).toContain('photo')
    expect(fieldsOfType(BASIC_INFO, 'en').map((f) => f.key)).not.toContain('photo')
  })

  it('GPA 只在中文简历出现', () => {
    expect(fieldsOfType(EDUCATION, 'zh').map((f) => f.key)).toContain('gpa')
    expect(fieldsOfType(EDUCATION, 'en').map((f) => f.key)).not.toContain('gpa')
  })

  it('熟练度只在中文简历出现', () => {
    expect(fieldsOfType(SKILLS, 'zh').map((f) => f.key)).toContain('level')
    expect(fieldsOfType(SKILLS, 'en').map((f) => f.key)).not.toContain('level')
  })

  it('工作/项目/奖项两条轨字段一致', () => {
    for (const d of [EXPERIENCE, PROJECTS, AWARDS]) {
      expect(fieldsOfType(d, 'zh').map((f) => f.key)).toEqual(fieldsOfType(d, 'en').map((f) => f.key))
    }
  })

  it('defaultFields 随轨裁剪，不会把照片带进英文简历', () => {
    expect(defaultFields(BASIC_INFO, 'en')).not.toHaveProperty('photo')
    expect(defaultFields(BASIC_INFO, 'zh')).toHaveProperty('photo')
  })

  it('filterFieldsForTrack 是唯一裁剪入口，结果稳定', () => {
    const a = filterFieldsForTrack(EDUCATION.fields, 'en').map((f) => f.key)
    const b = filterFieldsForTrack(EDUCATION.fields, 'en').map((f) => f.key)
    expect(a).toEqual(b)
  })
})

describe('校验器', () => {
  it('basics 缺姓名与电话时报两条错', () => {
    const r = BASIC_INFO.validate({ email: 'a@b.com' }, 'zh')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.map((e) => e.path).sort()).toEqual(['name', 'phone'])
  })

  it('英文简历不因缺照片而报错', () => {
    const r = BASIC_INFO.validate(
      { name: 'Zhang Ming', phone: '138', email: 'z@example.com' },
      'en',
    )
    expect(r.ok).toBe(true)
  })

  it('bullets 必须是数组', () => {
    const r = EXPERIENCE.validate({ company: 'X', role: 'Y', bullets: '不是数组' }, 'zh')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]?.path).toBe('bullets')
  })
})
