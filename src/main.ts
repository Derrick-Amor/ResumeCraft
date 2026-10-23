import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'

const app = createApp(App)

// 状态管理：Pinia 在此注册，业务 store 由各卡在自己的模块目录内定义（TC-003 起）
app.use(createPinia())

app.mount('#app')
