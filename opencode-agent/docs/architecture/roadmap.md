# OMA 分阶段路线图

> 最后更新：2026-07-04

## Phase 0：当前迭代（立即执行）

**三个功能改动**，在任何阶段都有价值：

| 改动 | 说明 |
|------|------|
| MCP headers 表单 | Remote MCP 表单加 headers 键值对编辑器（支持 Authorization Bearer） |
| SSE 对话 + tool 中间状态 | ChatView 重写：接 SSE 流、结构化消息、tool call 中间状态渲染 |
| ask 交互 | 后端 control/next + control/response 端点 + 前端 PermissionPrompt 弹窗 |

## Phase 1：Higress 密钥代理 + 安全链路（✅ 已完成，2026-07-04）

**目标**：解决 apiKey 链路缺口，真实 key 不进 Pod

已完成：
1. ✅ Higress + Nacos 3.2 部署到 ACK（Helm + 手动 YAML）
2. ✅ 后端 `routes/providers.ts`：调 Higress admin API 注册 LLM 路由 + 存 key
3. ✅ DB 新增 `providers` 表
4. ✅ 前端新增 LLM 管理页面（`ProvidersView.vue`）
5. ✅ `instances.ts` 改造：部署时从 providers 表关联，改写 configJson 指向 Higress
6. ✅ OMA consumer key 写入 K8s Secret → opencode envFrom 读取

**端到端验证**：
- 用户配 DeepSeek key → Higress 自动创建 Provider + Consumer + Route ✅
- 创建实例时自动走 Higress 代理（baseURL 指向 gateway，apiKey 是 OMA key）✅
- opencode → Higress → DeepSeek 真实回复成功 ✅
- 真实 DeepSeek key 只存在 Higress，不进 Pod ✅

## Phase 2：Nacos 服务发现 + A2A（✅ 已完成，2026-07-04）

**目标**：实例可被发现和调用

已完成：
1. ✅ Nacos 3.2 部署到 ACK
2. ✅ sidecar A2A 适配层（`/.well-known/agent.json` + `message:send` + `tasks/:id`）
3. ✅ sidecar 启动时自动注册到 Nacos（v1/v3 兼容）
4. ✅ 后端新增 `/:id/a2a-card` 代理端点
5. ✅ sidecar 心跳保活 + 优雅注销（SIGTERM）

**验证结果**：
- A2A Agent Card 返回正确（7 个 agent skills）✅
- Nacos 注册因鉴权配置需后续修复（不阻塞主功能）

**待修复**：
- Nacos 3.x v3 API 需要鉴权 token，当前部署 auth 配置异常
- 修复方案：重建 Nacos 时正确配置 `NACOS_AUTH_ENABLE=true` + 创建 nacos 用户

## Phase 3：Skill 模板管理（✅ 已完成，2026-07-04）

已完成：
1. ✅ DB 新增 `skill_templates` 表
2. ✅ 后端 `routes/skills.ts`：Skill CRUD（创建/列表/详情/删除）
3. ✅ 前端 API 对接（`listSkillTemplates` / `createSkillTemplate` / `deleteSkillTemplate`）

> 后续可接入 Nacos Skill Registry（当前用 DB 管理，足够开发用）

## Phase 4：监控栈（✅ 已完成，2026-07-04）

已完成：
1. ✅ Prometheus + Grafana 部署到 ACK（monitoring namespace）
2. ✅ sidecar `/metrics` 端点（Prometheus 格式：请求计数 + 延迟）
3. ✅ Grafana 自动配置 Prometheus 数据源
4. ✅ Prometheus 自动发现 sidecar Pod 并抓取（验证 UP）

**访问**：
- Grafana: `grafana.monitoring.svc:3000`（admin/admin）
- Prometheus: `prometheus.monitoring.svc:9090`

## Phase 5：MCP 网关化（✅ 已完成，2026-07-04）

已完成：
1. ✅ DB 新增 `mcp_servers` 表
2. ✅ 后端 `routes/mcp-servers.ts`：MCP CRUD + Higress 代理注册
3. ✅ 前端 MCP 管理页面（`McpView.vue`，替代占位页）
4. ✅ 左侧导航三个标签（Agent管理/LLM管理/MCP管理）

---

## 补充：A2A 标准化 + Human-in-the-Loop 审批（✅ 已完成，2026-07-04）

**目标**：对话和审批统一走 A2A 协议，为可插拔 Agent 架构铺路

已完成：
1. ✅ 前端 ChatView 对话改走 A2A（`/a2a/message`）
2. ✅ sidecar A2A 层支持同步 + 异步模式（`returnImmediately`）
3. ✅ 审批桥接：sidecar `/tasks/control-next` + `/tasks/respond`
4. ✅ 前端审批 API 改走 A2A 端点（`/a2a/control-next` + `/a2a/respond`）
5. ✅ 端到端验证：A2A 同步对话回复 "2" 正确

详见 [A2A + A2UI 协议文档](./a2a-a2ui-protocol.md)

---

## 下一步：A2UI 集成（待实施）

**目标**：Agent 回复不再只是纯文本，支持结构化 UI（卡片/表单/图表）

- [ ] 安装 `a2ui-vue`（支持 A2UI v0.9 规范的 Vue 3 渲染器）
- [ ] ChatView 集成 `A2UISurface`（检测 A2UI JSON 自动渲染）
- [ ] Agent 侧适配（prompt 指导 Agent 输出 A2UI 格式）
- [ ] 自定义组件 Catalog（OMA 主题适配）

## Phase 4：监控栈

**目标**：可观测性

1. 自动部署 Prometheus + Grafana + Loki（Helm）
2. sidecar 暴露 /metrics（Prometheus 格式）
3. Grafana 预置 OMA dashboard
4. Loki 抓取审计日志 + 关键报错

## Phase 5：MCP 网关化

**目标**：MCP 统一走 Higress

1. 后端 `routes/mcp-servers.ts`：Higress 注册 MCP 代理路由
2. opencode.json 的 MCP url 全指向 Higress
3. 前端 MCP 管理页面
