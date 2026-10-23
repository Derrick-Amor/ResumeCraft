import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需引入（TC-002 B 段）：
    // 模板里的 <el-*> 在构建期被解析成具体组件 + 该组件自己的样式，未用到的组件不进包。
    // 刻意不做全量注册（app.use(ElementPlus)）与全量样式（element-plus/dist/index.css）。
    // 函数式 API（ElMessage 等）由使用方显式 `import { ElMessage } from 'element-plus'`，
    // 不引入 unplugin-auto-import，避免多一个隐式全局来源。
    // dts 放在 src/ui/controls/ 下：tsconfig.app.json 的 include 已覆盖 src/**/*.ts，
    // 不必改动该文件；同时不新增 src/ 一级目录。
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/ui/controls/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
