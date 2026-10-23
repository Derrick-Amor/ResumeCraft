import { fileURLToPath, URL } from 'node:url'

import { defineConfig, mergeConfig } from 'vitest/config'

// tsconfig.node.json 走 module=nodenext，相对导入必须带扩展名
import viteConfig from './vite.config.ts'

// 复用 vite.config.ts 的插件链（含 Element Plus 按需引入），
// 让测试里 <el-*> 的解析方式与生产构建保持一致；此处只叠加测试专属配置。
export default mergeConfig(
  viteConfig,
  defineConfig({
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
      server: {
        deps: {
          // Element Plus 的按需样式注入是 `element-plus/theme-chalk/*.css` 这种裸导入，
          // 默认被 externalize 后交给 Node 解析会报 "Unknown file extension .css"；
          // inline 后由 Vite 管道处理（样式在测试里被忽略，但导入可解析）。
          inline: ['element-plus'],
        },
      },
    },
  }),
)
