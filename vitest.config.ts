import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 单元/集成测试默认跑 node 环境；需要 DOM 的卡在用例文件头部用
    // `// @vitest-environment jsdom` 单独声明，避免全量测试被 DOM 依赖拖慢。
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    reporters: 'default',
  },
})
