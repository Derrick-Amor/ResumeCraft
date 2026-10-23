import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
// Element Plus 的按需样式由各组件模块自行引入；这里必须排在 App 之后导入，
// 保证桥接层的 `--el-*` 映射覆盖在组件库默认变量之上（详见文件头注释）。
import './design/element-plus-bridge.css'

const app = createApp(App)

// 状态管理：Pinia 在此注册，业务 store 由各卡在自己的模块目录内定义（TC-003 起）
app.use(createPinia())

app.mount('#app')
