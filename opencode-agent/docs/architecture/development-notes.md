# 开发经验与踩坑记录

> 本文档沉淀 OMA 平台开发过程中的关键技术发现、踩坑经验和正确做法。
> 每条都经过 ACK 实测验证。新增经验请追加到对应章节。

---

## 1. opencode HTTP API（1.15.x 实测）

### 1.1 同步 vs 异步消息发送

| 端点 | 行为 | 适用场景 |
|------|------|---------|
| `POST /session/:id/message` | **同步**，等完整回复 | OMA 默认对话（简单可靠） |
| `POST /session/:id/prompt_async` | 异步，立即返回 204 | 流式/SSE 场景（浏览器 EventSource 不可靠时慎用） |
| `GET /session/:id/message` | 列消息历史 | **含 tool 调用过程**（同步 message 响应不含） |

**关键坑**：同步 `/message` 遇到 `bash=ask` 会**阻塞等待裁决**。
- 这不是 bug，是特性：阻塞期间可通过 `GET /permission` 拿到 pending 请求，裁决后同步 HTTP 自动解除阻塞返回回复。
- OMA 正是利用这点：前端发消息后立即轮询 `control-next`，阻塞期间弹审批卡片，用户裁决后回复自动到达。

### 1.2 Permission（审批）协议

**ACK 实测确认的端点**（2026-07-04）：

```
GET  /permission                           → 列出所有 pending permission
POST /session/:sid/permissions/:permissionID  → 裁决
   body: { response: "once" | "always" | "reject" }
   - once   = 允许一次
   - always = 始终允许（记住）
   - reject = 拒绝
```

**permission 事件**（通过 `/event` SSE 流派发）：
```json
{
  "type": "permission.asked",
  "properties": {
    "id": "per_xxx",          ← permissionID（裁决用）
    "sessionID": "ses_xxx",   ← 注意大写 ID
    "permission": "bash",     ← 工具名
    "patterns": ["ls -la"]    ← 要审批的命令
  }
}
```

**踩过的坑**：
- ❌ 用 `/tui/control/next` —— 这是 TUI 客户端专用，headless `opencode serve` 不派发
- ❌ 同步 `/message` + bash=ask + 不裁决 = **永久死锁**
- ❌ respond body 用 `{allowed: true}` —— 应该是 `{response: "once"|"always"|"reject"}`
- ❌ 异步模式 + 前端依赖 SSE 重置 sending —— 浏览器 EventSource 链路不可靠，会永久转圈

### 1.3 SSE 事件结构

事件顶层：`{ id, type, properties }`（数据在 **properties** 字段，不是 data）。

| type | 含义 |
|------|------|
| `permission.asked` | 审批请求 |
| `message.part.delta` | 文本增量（`properties.delta`，按 `messageID` 关联） |
| `message.part.updated` | part 快照（text/tool 状态） |
| `message.updated` | 消息元信息（`info.time.completed` 标志完成） |
| `session.idle` / `idle` | 会话空闲（整轮处理结束） |
| `session.error` | 错误（`properties.error`） |

### 1.4 Tool 调用信息

同步 `/message` 响应的 `parts` **只含最终 text**（step-start/text/step-finish），**不含 tool 调用**。
要拿到 tool 调用过程（bash/write/edit 等），必须 **GET 消息历史**：
```json
{
  "info": { "role": "assistant" },
  "parts": [
    { "type": "step-start" },
    { "type": "tool", "tool": "write", "state": { "status": "completed", "input": { "filePath": "/workspace/hi.py", "content": "..." } } },
    { "type": "step-finish" }
  ]
}
```

**关键坑**：一次回复可能是**多条 assistant 消息**（第 1 条含 tool 调用，第 2 条含最终 text）。
提取时要收集「最后一个 user 消息之后的**所有** assistant 消息」，不能只取最后一条（否则漏掉 tool）。

OMA 做法：sidecar 同步分支拿到回复后，再查一次历史（带 5 秒超时兜底），把 tool parts 提取到 artifacts 里返回前端。

### 1.5 opencode serve 鉴权

`opencode serve` 默认**无鉴权**（1.15.x）。Pod 内 `localhost:4096`（或 `127.0.0.1:4096`）可直接访问。
- ⚠️ busybox `wget localhost` 会解析到 IPv6 `::1` 而 opencode 没监听 IPv6 → `Connection refused`。**必须用 `127.0.0.1`**。
- Node `fetch` 优先解析 IPv4，所以 sidecar 的 `opencodeFetch`（用 localhost）正常。

---

## 2. A2UI 协议（v0.9，a2ui-vue 0.9.3）

### 2.1 v0.8 vs v0.9 关键差异（踩过大坑）

| 维度 | v0.8（错误） | v0.9（正确） |
|------|------------|------------|
| 组件结构 | `{ component: { Card: { child: "x" } } }`（嵌套） | `{ id: "root", component: "Card", child: "x" }`（**扁平，component 是字符串**） |
| Text | `{ text: { literalString: "hi" } }` | `{ component: "Text", text: "hi" }`（text 直接字符串） |
| children | `{ children: { explicitList: ["a","b"] } }` | `{ children: ["a","b"] }`（直接 id 数组） |
| Button action | `{ action: { name, context: [...] } }` | `{ action: { event: { name, context: {...} } } }`（**包在 event 里**） |
| 渲染信号 | 需要 `beginRendering` | **不需要**，但 root 必须叫 `"root"` |
| catalogId | URL | `"default"` 即可 |

### 2.2 a2ui-vue 集成

```ts
// main.ts
import { provideA2UI, DEFAULT_CATALOG, defaultTheme } from 'a2ui-vue'
import 'a2ui-vue/dist/a2ui-vue.css'
provideA2UI({ app, catalog: DEFAULT_CATALOG, theme: defaultTheme })

// 组件内
import { A2UISurface, useMessageProcessor } from 'a2ui-vue'
const processor = useMessageProcessor()
processor.processMessages(messages)  // createSurface + updateComponents
processor.onEvent((event) => {       // Button 点击
  const name = event.message.action.name
})
```

### 2.3 审批卡片 A2UI 消息构造

见 `apps/web/src/lib/a2ui-permission.ts`。组件树：
```
Card(root) → Column → [Text(标题), Text(工具), Text(命令), Row → [Button(拒绝), Button(允许)]]
```

### 2.4 降级策略（重要）

A2UI 渲染失败时（schema 偏差、库 bug 等）**必须降级到原生卡片**，绝不让整个 ChatView 崩溃。
- `A2UISurface` 用 `defineAsyncComponent` 懒加载
- `processMessages` 用 try/catch 包裹
- 失败时 `useFallback = true`，模板走原生卡片分支，console.warn 提示

---

## 3. 版本管理（K8s 资源命名）

### 3.1 模型

一个逻辑实例 = 一个 `group_id`（稳定短 UUID），多版本 v1/v2/v3。
**同时只有一个版本在跑**（PVC 是 RWO，强制约束）。

| 资源 | 命名 | 共享 |
|------|------|------|
| ConfigMap/Secret/Deployment | `${group_id}-v${n}[-{config\|secret}]` | 每版本独立 |
| PVC | `${group_id}-pvc` | 同 group 复用 |
| Service | `${group_id}` | 稳定名，切版本改 selector |

### 3.2 切版本的坑

- **Service selector 必须用 JSON patch `replace`**（不能 strategic/merge patch）：
  - merge patch 对 map 是合并，**删不掉旧的 `opencode/instance` label**
  - 残留旧 label 会导致 selector 同时要求新旧 label，匹配不到任何 Pod → endpoints 空
- selector **只用 `opencode/group` + `opencode/version`**，不用 `opencode/instance`（后者带版本号会匹配不上）
- 部署新版本流程：scale down 旧版本（等 Pod 终止释放 RWO PVC）→ 起新版本 → patch Service selector

### 3.3 旧实例迁移

迁移前的实例 `name` = K8s 资源名。迁移后 `group_id = name`（兼容）。
但旧 Deployment 没有 `opencode/group` label，`scaleDownOtherVersions` 找不到它 → 会残留。
迁移时需手动：scale down 旧 Deployment + 补 label。

---

## 4. 前端

### 4.1 中文输入法回车误发送

`@keydown.enter.exact.prevent="send"` 在输入法 composing 状态下也会触发。
**修复**（三重保险）：
1. `e.isComposing`（浏览器原生标志，最可靠）
2. `compositionstart`/`compositionend` 自己跟踪 `isComposing` ref（处理时序）
3. `e.keyCode === 229`（旧浏览器兼容）

### 4.2 对话 sending 状态管理

同步模式下 `sending` 必须在 `finally` 块重置，**不能依赖 SSE 事件重置**（SSE 不可靠）。
异步模式（若未来启用）必须加超时兜底，防止 SSE 丢事件导致永久转圈。

---

## 5. 部署

### 5.1 Docker 构建缓存陷阱

`docker buildx build` 即便 `--no-cache`，COPY 层可能命中 builder 内容寻址缓存，导致 **Docker 内 vite build 用的是旧源码**。
- 症状：镜像 digest 是新的，但 bundle 内容是旧的
- 排查：对比「本地 dist 的 bundle hash」和「nginx 里 bundle hash」
- 解决：必要时 `docker buildx prune` 清 builder 缓存，或改 Dockerfile 直接 COPY 本地预构建 dist

### 5.2 K8s 同 tag 镜像不自动更新

Deployment 的 `imagePullPolicy: IfNotPresent`（默认）在同 tag 下不会拉新 digest。
- `kubectl rollout restart` 可能还用本地缓存的旧镜像
- **可靠做法**：`kubectl delete pod -l app=xxx` 强制重建 Pod 拉新镜像

### 5.3 实例 Pod 重启拉新 sidecar

sidecar 镜像更新后，必须 `kubectl rollout restart deploy/<实例>` 让实例 Pod 拉新 sidecar。
平台（server/web）和实例（opencode/sidecar）是**独立**的 Deployment，重启平台不会重启实例。

---

## 6. Higress / LLM 密钥

### 6.1 DeepSeek key 401 问题

a2a-demo 实例曾出现 `Unauthorized`（401），原因是 Higress consumer key 失效或路由配置丢失。
- 排查：在 LLM 管理页点「测试连接」
- 测试连接端点：`POST /api/providers/:id/test` → 调 Higress gateway `/v1/models` 或最小 chat completions

### 6.2 Higress AI 路由坑

- 路由名**必须全小写**（含大写字母会 422）
- 路由**不设 domains**（匹配所有 host），否则 404
- Cookie 名是 `_hi_sess`（不是 JSESSIONID）
