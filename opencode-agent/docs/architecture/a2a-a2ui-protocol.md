# A2A + A2UI 协议集成

> 最后更新：2026-07-04

## 一、A2A（Agent-to-Agent）协议 — 已实现

### 架构定位

A2A 是 OMA 平台的**标准对话与控制协议**。前端不再直接调 opencode API，而是统一走 A2A 端点。任何 Agent 只需实现 sidecar 的 5 个 A2A 端点即可接入。

### 调用链

```
前端 ChatView
  → POST /api/instances/:id/a2a/message（后端代理）
    → sidecar POST /message:send（A2A 适配层）
      → opencode POST /session/:id/message（原生 API）
        → Higress Gateway → DeepSeek（LLM 代理）
```

### 已实现的 A2A 端点

| 端点 | 方法 | 用途 | sidecar 内部转发 |
|------|------|------|-----------------|
| `/.well-known/agent.json` | GET | Agent 发现（agent card） | 从 opencode /agent 构建 |
| `/message:send` | POST | 对话入口（同步 + 异步） | opencode /session/:id/message 或 prompt_async |
| `/tasks/:id` | GET | 任务状态查询 | opencode session 消息历史 |
| `/tasks/control-next` | GET | **审批请求**（Human-in-the-Loop） | opencode /tui/control/next |
| `/tasks/respond` | POST | **审批决定** | opencode /tui/control/response |

### Human-in-the-Loop 审批流程

```
Agent 执行中需要审批
  → sidecar 监听 opencode /tui/control/next
  → 返回 A2A Task 状态 INPUT_REQUIRED（含审批详情）
  → 前端收到 INPUT_REQUIRED，弹出 PermissionPrompt
  → 用户点「允许」/「拒绝」
  → 前端 POST /tasks/respond（带决定）
  → sidecar 转发给 opencode /tui/control/response
  → opencode 继续执行，Task 恢复 WORKING
```

### 接入新 Agent 的步骤

1. 为新 Agent 写一个 sidecar（Node/Hono）
2. 实现上述 5 个 A2A 端点（内部适配该 Agent 的原生 API）
3. 部署到 K8s（同 opencode 模式：双容器 Pod + 共享 PVC）
4. sidecar 启动自动注册到 Nacos

OMA 前端、对话 UI、审批 UI、监控、Nacos 注册全都不用改。

---

## 二、A2UI（Agent-to-UI）协议 — 计划集成

### 什么是 A2UI

A2UI 是 Google 主导的**开放协议**，定义 AI Agent 如何用结构化 JSON 描述 UI 意图。Agent 输出 A2UI JSON，渲染器（如 a2ui-vue）将其转换为真实的可交互 Vue 组件。

```
AI Agent  ──(A2UI JSON)──►  a2ui-vue 渲染器  ──►  用户界面
```

参考链接：
- [A2UI 官网](https://a2ui.org/)
- [Google 官方介绍](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [a2ui-vue（shawnwang15）](https://github.com/shawnwang15/a2ui-vue)
- [a2ui-vue 文档](https://shawnwang15.github.io/a2ui-vue/)

### 为什么集成 A2UI

当前 ChatView 只能显示纯文本回复。集成 A2UI 后：
- Agent 可以返回**卡片、列表、表单、图表**等结构化 UI（不只是文本）
- Agent 不需要了解 HTML/CSS，只需输出结构化 JSON
- 前端统一渲染，跨 Agent 一致

### a2ui-vue 技术细节

- Vue 3 + TypeScript + Composition API
- 完整支持 A2UI v0.9 规范
- 20+ 内置组件（布局、内容、媒体、输入）
- 提供 `provideA2UI`、`useMessageProcessor`、`A2UISurface` 等 Composables
- 与 OMA 当前技术栈完全兼容（Vue 3 + Vite + Tailwind v4）

### 集成方案（待实施）

#### 1. 安装

```bash
pnpm --filter @opencode/web add a2ui-vue
```

#### 2. 初始化（main.ts）

```ts
import { provideA2UI, DEFAULT_CATALOG, defaultTheme } from 'a2ui-vue'
import 'a2ui-vue/dist/a2ui-vue.css'

provideA2UI({
  app,
  catalog: DEFAULT_CATALOG,
  theme: defaultTheme,  // 可对接 OMA 的淡蓝主题
})
```

#### 3. ChatView 集成

在 ChatView 消息渲染区，检测 assistant 消息是否包含 A2UI 结构：
- 如果是纯文本 → 走当前文本渲染
- 如果是 A2UI JSON → 用 `A2UISurface` 渲染结构化 UI

```vue
<!-- assistant 消息支持 A2UI 结构化渲染 -->
<A2UISurface
  v-if="m.type === 'a2ui'"
  :surface-id="m.surfaceId"
/>
<pre v-else>{{ m.text }}</pre>
```

#### 4. Agent 侧适配

sidecar A2A 层在转换 opencode 回复时，检测回复中的 A2UI JSON（通过特定标记或 DataPart 类型），传递给前端。

> 注：A2UI 需要配合 Agent 的 prompt 设计（让 Agent 输出 A2UI 格式的 JSON），后续在 Skill 配置中加入 A2UI 输出指南。
