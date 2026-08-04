# OMA 总体架构

> 最后更新：2026-07-04

## 一、核心定位

OMA（Oh-My-Agent）是 **AI Agent 治理与运营平台**。它自身不重新发明 AI 基础设施，而是作为上层控制面，编排和纳管多个开源组件：

| 组件 | 角色 | OMA 的关系 |
|------|------|-----------|
| **opencode** | Agent 运行时（开源，不改造） | OMA 部署和纳管的实例 |
| **sidecar** | 实例内伴随服务（OMA 自研） | 封装 opencode 为 A2A、桥接 Nacos/Higress |
| **Nacos 3.2** | AI 资源控制平面 | OMA 调用其 API 注册/发现 Agent、MCP、Skill |
| **Higress** | AI 网关 + 密钥保管箱 | OMA 调用其 admin API 注册 LLM/MCP 代理路由 |
| **Prometheus + Grafana + Loki** | 监控栈 | OMA 自动部署，sidecar 暴露 metrics |

## 二、架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OMA 管理平台（控制面）                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ 前端 Vue  │  │ 管理后端  │  │  DB      │  │ K8s 编排  │            │
│  │ (Web UI) │  │ (Hono)   │  │ (MySQL)  │  │ (k8s.ts) │            │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └────┬─────┘            │
│       │              │                           │                   │
│       │    ┌─────────┴──────────────────────────┘                   │
│       │    │  调用 Nacos/Higress admin API                          │
└───────┼────┼───────────────────────────────────────────────────────┘
        │    │
        ▼    ▼
┌──────────────────┐        ┌──────────────────┐
│   Nacos 3.2      │        │    Higress       │
│  ┌────────────┐  │        │  ┌────────────┐  │  用户配的 DeepSeek/OpenAI key
│  │Agent Reg   │  │        │  │LLM 代理    │  │  ← 存这里（密钥保管箱）
│  │(A2A)       │  │        │  │(消费者认证) │  │
│  ├────────────┤  │        │  ├────────────┤  │  opencode 调 LLM/MCP 时
│  │MCP Reg     │  │        │  │MCP 代理    │  │  用 Higress 地址 + OMA key
│  │            │  │        │  │(消费者认证) │  │
│  ├────────────┤  │        │  └────────────┘  │
│  │Skill Reg   │  │        └──────────────────┘
│  │(SkillHub)  │  │
│  └────────────┘  │
└──────────────────┘
        ▲
        │ 注册/心跳
┌───────┴───────────────────────────────────────────────────┐
│              每个实例 Pod                                    │
│  ┌──────────────────┐      ┌──────────────────────┐        │
│  │ opencode (4096)  │◄────►│ sidecar (8080)       │        │
│  │                  │ HTTP │  ├─ Skill CRUD        │        │
│  │ opencode.json 里 │      │  ├─ 监控聚合          │        │
│  │ 的 LLM/MCP 地址  │      │  ├─ A2A 适配层        │        │
│  │ 全指向 Higress   │      │  │  (→ Nacos Agent Reg)│        │
│  │                  │      │  └─ Prometheus metrics│        │
│  └──────────────────┘      └──────────────────────┘        │
│         │  共享 PVC（skills + data）  │                     │
│         └────────────────────────────┘                      │
└────────────────────────────────────────────────────────────┘
```

## 三、关键设计决策

### 3.1 密钥安全：Higress 消费者认证

**问题**：当前 apiKey 明文留在前端 store，部署后丢失，opencode 环境变量缺失。

**方案**：用户配的真实 key 存 Higress 消费者认证。opencode.json 里只写 Higress 地址 + OMA 签发的消费者 key。Higress 代理时验证 OMA key、注入真实 upstream key。

**收益**：
- 真实凭据不进 Pod
- 统一审计、可吊销
- 换 key 不用改 opencode 配置

### 3.2 服务发现：Nacos 3.2 AI Registry

**问题**：当前实例发现完全靠 K8s service DNS 硬拼，跨集群/跨系统不可发现。

**方案**：利用 Nacos 3.2 原生的三大 Registry：
- **Agent Registry（A2A）**：sidecar 启动时自动注册 agent card
- **MCP Registry**：用户配 MCP 时注册元信息
- **Skill Registry**：Skill 集中管理、跨实例共享

### 3.3 监控：自建独立栈

自动部署 Prometheus + Grafana + Loki，sidecar 暴露 /metrics。

### 3.4 Higress + Nacos 部署

OMA 自动安装（Helm chart 依赖），用户无需自己配。

## 四、当前架构边界（待改造）

当前项目（Phase 0 状态）的已知限制：

1. **服务发现层缺失**：server→实例靠 K8s service DNS 硬拼
2. **配置中心缺失**：所有配置塞在 ConfigMap + MySQL config_json 字段
3. **MCP 直连**：remote MCP 直接写 URL，无网关
4. **密钥链路缺口**：apiKey 明文转占位符后未进 Secret
5. **DB schema 扁平**：无 provider/mcp/skill 独立表
6. **审计日志写在容器本地**：重启丢失

这些将在 Phase 1-5 逐步解决。

## 五、协议层（A2A + A2UI）

OMA 平台通过两层协议实现可插拔 Agent 架构：

### A2A（Agent-to-Agent）— 对话与控制

前端与 Agent 之间统一用 A2A 协议通信。任何 Agent 只需实现 sidecar 的 5 个 A2A 端点即可接入，前端对话/审批/监控全不用改。

详见 [A2A + A2UI 协议文档](./a2a-a2ui-protocol.md)。

### A2UI（Agent-to-UI）— 生成式 UI（计划中）

Agent 回复不再只是纯文本，支持返回结构化 UI（卡片/表单/图表）。使用 [a2ui-vue](https://github.com/shawnwang15/a2ui-vue) 渲染器。

```
Agent → A2UI JSON（描述 UI 意图）→ a2ui-vue 渲染器 → 用户界面
```

### 协议栈全景

```
用户浏览器
  │
  ├─ A2UI（结构化 UI 渲染）← a2ui-vue 渲染器
  │
  ├─ A2A（对话 + 审批 + 任务状态）
  │    ├─ POST /a2a/message:send     → 对话
  │    ├─ GET  /a2a/control-next     → 审批请求
  │    └─ POST /a2a/respond          → 审批决定
  │
  └─ OMA 管理面（LLM/MCP/Skill/监控）
       │
       ├─ Higress（密钥保管箱 + LLM/MCP 代理）
       ├─ Nacos（Agent 发现 + Skill Registry）
       └─ Prometheus + Grafana（监控）
```
