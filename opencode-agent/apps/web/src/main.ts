import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// A2UI 渲染器初始化
import { provideA2UI, DEFAULT_CATALOG, defaultTheme } from 'a2ui-vue'
import 'a2ui-vue/dist/a2ui-vue.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 注入 A2UI（Agent 输出的结构化 JSON 会渲染为 Vue 组件）
provideA2UI({
  app,
  catalog: DEFAULT_CATALOG,
  theme: defaultTheme,
})

app.mount('#app')
