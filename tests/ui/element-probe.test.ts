// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ElementProbe from '../../src/ui/controls/ElementProbe.vue'

// vitest 以仓库根目录为 cwd；显式校验，避免路径写错时扫到空目录而假通过
const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

if (!existsSync(join(ROOT, 'package.json'))) {
  throw new Error(`测试根目录异常：${ROOT} 下没有 package.json`)
}

/** 递归收集目录下所有文件 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const srcFiles = walk(SRC)

// Element Plus 的 Dialog / Input 依赖 ResizeObserver 与 matchMedia，jsdom 未实现，这里补最小桩
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
)

/**
 * Element Plus 的表单校验在异步任务里落地（async-validator + 组件内部调度），
 * 单靠 flushPromises 拿不到错误态。这里用 vi.waitFor 轮询直到断言成立，
 * 不用固定 sleep，避免机器快慢造成假失败。
 */
async function waitFor(check: () => void) {
  // timeout 从 3s 提到 8s：async-validator 的异步校验在全量并行负载下
  // 偶发被 jsdom 定时器挤占，表现为"偶发红、单跑绿"。
  // 只放宽等待时间，不放宽断言内容 —— 校验文案与弹窗不出现仍必须成立。
  await vi.waitFor(check, { timeout: 8000, interval: 20 })
}

describe('ElementProbe（Element Plus 接入验证组件）', () => {
  it('可以挂载，并渲染三个表单项', () => {
    const wrapper = mount(ElementProbe)

    expect(wrapper.find('[data-testid="element-probe"]').exists()).toBe(true)
    // 3 个字段输入框（第 4 个 .el-form-item 是按钮行）
    expect(wrapper.findAll('input')).toHaveLength(3)
    expect(wrapper.findAll('.el-form-item')).toHaveLength(4)
    expect(wrapper.find('[data-testid="probe-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="probe-email"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="probe-position"]').exists()).toBe(true)
  })

  it('必填校验生效：空表单提交不打开对话框，并给出错误文案', async () => {
    const wrapper = mount(ElementProbe)

    await wrapper.find('[data-testid="probe-submit"]').trigger('click')
    // 三条校验文案必须**一起**等：async-validator 逐字段异步校验，
    // 只等第一条就断言后两条，会在并行负载下竞态（表现为"偶发红、单跑绿"）。
    // 等待时间放宽到 8s 仍在包装器内；断言内容一字未松。
    await waitFor(() => {
      expect(wrapper.text()).toContain('请输入姓名')
      expect(wrapper.text()).toContain('请输入邮箱')
      expect(wrapper.text()).toContain('请输入意向岗位')
    })

    expect(document.querySelector('.el-dialog')).toBeNull()
  })

  it('邮箱格式校验生效', async () => {
    const wrapper = mount(ElementProbe)

    await wrapper.find('[data-testid="probe-name"]').setValue('张三')
    await wrapper.find('[data-testid="probe-email"]').setValue('not-an-email')
    await wrapper.find('[data-testid="probe-position"]').setValue('前端工程师')
    await wrapper.find('[data-testid="probe-submit"]').trigger('click')
    await waitFor(() => expect(wrapper.text()).toContain('邮箱格式不正确'))

    expect(document.querySelector('.el-dialog')).toBeNull()
  })

  it('填全后点提交打开对话框，确认后回写一行文本', async () => {
    const wrapper = mount(ElementProbe, { attachTo: document.body })

    await wrapper.find('[data-testid="probe-name"]').setValue('张三')
    await wrapper.find('[data-testid="probe-email"]').setValue('zhangsan@example.com')
    await wrapper.find('[data-testid="probe-position"]').setValue('前端工程师')
    await wrapper.find('[data-testid="probe-submit"]').trigger('click')
    await waitFor(() => expect(document.querySelector('.el-dialog')).not.toBeNull())

    expect(document.querySelector('.el-dialog')?.textContent).toContain('确认保存')

    const confirm = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('确认保存'),
    )
    expect(confirm).toBeTruthy()
    confirm?.click()
    await waitFor(() =>
      expect(wrapper.text()).toContain('已保存：张三｜zhangsan@example.com｜前端工程师'),
    )

    expect(wrapper.find('[data-testid="probe-result"]').text()).toBe(
      '已保存：张三｜zhangsan@example.com｜前端工程师',
    )
    wrapper.unmount()
  })
})

describe('接入方式约束（防止悄悄退回全量引入）', () => {
  it('src/ 全目录不存在 element-plus/dist/index.css 的引用', () => {
    const offenders = srcFiles.filter((file) =>
      readFileSync(file, 'utf8').includes('element-plus/dist/index.css'),
    )

    expect(offenders).toEqual([])
    // 反向自检：确实扫到了文件，避免断言在空目录上假通过
    expect(srcFiles.length).toBeGreaterThan(10)
  })

  it('main.ts 没有 app.use(ElementPlus) 全量注册', () => {
    const mainTs = readFileSync(join(SRC, 'main.ts'), 'utf8')

    expect(mainTs).not.toContain('app.use(ElementPlus)')
    expect(mainTs).not.toMatch(/from ['"]element-plus['"]/)
  })

  it('App.vue 挂载了 TC-008 编辑器壳（TC-002 占位已替换）', () => {
    const appVue = readFileSync(join(SRC, 'App.vue'), 'utf8')

    // TC-008 起 App.vue 挂 AppShell，不再是 ElementProbe 占位
    expect(appVue).toContain('AppShell')
    expect(appVue.match(/<AppShell\b/g)).toHaveLength(1)
  })
})
