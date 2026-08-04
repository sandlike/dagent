# PRD: OpenCode Container Management Platform

> 版本：v0.3 | 日期：2026-06-28 | 状态：草案（12 个卡点全部决策完成，新增对话模块，架构已定）

---

## 1. 背景与目标

### 1.1 问题

用户通过对话生成 OpenCode 配置文件（`opencode.json` + custom skills），但没有便捷的方式将配置部署到 K8s 上运行，也无法在线管理容器内已安装的 skills。

### 1.2 目标

构建一个轻量管理平台，覆盖**配置生成 → K8s 部署 → 运行时 Skill 管理** 全链路。

### 1.3 关键指标

| 指标 | 目标值 |
|------|--------|
| 配置生成到容器启动 | ≤ 3 分钟 |
| Skill 增删操作生效 | 实时（无需重启 Pod） |
| 容器启动时完整加载 | 配置 + Skills + Agent 全部就绪 |

---

## 2. 用户场景

### 2.1 场景 A：生成配置并部署

```
用户登录管理平台
  → 选择或配置 model / provider / 权限
  → 系统生成 opencode.json
  → 一键触发 K8s 部署
  → 系统创建 ConfigMap + Secret + Deployment
```

### 2.2 场景 B：管理运行时 Skills

```
用户进入容器详情页
  → 查看已安装 Skills 列表（名称、大小、修改时间）
  → 删除不需要的 Skill（实时生效）
  → 上传新的 SKILL.md（实时生效）
```

### 2.3 场景 C：查看容器状态

```
用户查看容器运行状态
  → OpenCode health check
  → 最近会话数、Token 用量
  → Pod 日志（可选）
```

---

## 3. 功能需求

### 3.1 配置生成器

配置生成器是配置页的核心，采用**分步向导 + 实时 JSON 预览**双栏布局：左侧分步收集信息，右侧实时生成 `opencode.json` 并展示部署清单。

**第一版范围（v1，决策已定）：核心子集 —— Provider + 权限 + MCP + Skill 管理**

| 功能 | 说明 |
|------|------|
| 模型选择 | DeepSeek / OpenAI / Anthropic / Bedrock / Azure / 自定义 OpenAI 兼容；含主模型 `model` 与 `small_model` |
| 权限策略 | 预设模式（只读 / 审批 / 全开 / 自定义）+ 工具×动作表格（allow/ask/deny）+ bash glob 规则 |
| MCP 服务器 | local（command/cwd/env）/ remote（url/headers/OAuth）；内置 filesystem/github/postgres 模板 |
| Skill 管理 | 额外 skill 路径/URL + skill 权限规则 + 上传自定义 SKILL.md |
| 配置预览 | 实时 JSON 预览，可直接编辑 |
| 配置导入 | 支持从已有 `opencode.json` 反向解析回填表单（含从对话 App 导出的配置） |
| 配置导出 | 导出 `opencode.json`（含 ConfigMap / Secret / 部署清单） |

> **后续迭代（v2+）**：自定义 Agent、Hook/Plugin 配置。配置页数据模型现在即为这两项预留，避免返工。

#### 配置页信息架构（v1 四步向导）

```
┌─────────────────────────────┬──────────────────────────────┐
│  分步配置区（左）            │  实时预览区（右）              │
│                             │                              │
│  Step 1 实例基本信息          │  opencode.json (可编辑)       │
│   - 实例名称 / namespace     │  { "provider": {...},         │
│   - 默认 agent（build/plan） │    "model": "...",           │
│                             │    "permission": {...},       │
│  Step 2 模型与 Provider      │    "mcp": {...} }            │
│   - Provider 模板            │                              │
│   - API Key（→ Secret）      │  ──────────────────────       │
│   - 主模型 / 小模型           │  部署清单：                    │
│                             │   ✅ ConfigMap: opencode.json │
│  Step 3 权限策略              │   🔒 Secret: API Key/密码     │
│   - 预设模式单选              │   📦 Deployment: 镜像/PVC     │
│   - 工具×动作表格             │   🌐 Service/Ingress          │
│   - bash glob 规则           │   📂 skills 目录               │
│                             │                              │
│  Step 4 MCP + Skills         │  [导入配置] [导出] [一键部署]  │
│   - MCP 服务器列表            │                              │
│   - Skill 路径/权限/上传      │                              │
└─────────────────────────────┴──────────────────────────────┘
```

#### 敏感信息处理规则

配置页必须区分三类信息去向，这是生成正确部署清单的前提：

| 信息类型 | 例子 | 去向 |
|---------|------|------|
| 普通配置 | provider baseURL、permission、mcp | ConfigMap `opencode.json` |
| 密钥 | API Key、OAuth secret、server password | **Secret**（用 `{env:VAR}` 占位符引用） |
| 文件型内容 | SKILL.md、自定义 agent markdown、本地 plugin | PVC `.opencode/` 目录 |

### 3.2 K8s 部署管理

| 功能 | 说明 |
|------|------|
| 部署模板 | 预置 Deployment + Service + Ingress + ConfigMap + Secret |
| 一键部署 | 调用 K8s API 创建/更新全部资源 |
| 配置化 ConfigMap | 自动将用户生成的配置写入 ConfigMap |
| 密钥注入 | Provider API Key + Server Password 通过 Secret 注入 |
| 容器镜像 | 预构建 Dockerfile，自动拉取 |

### 3.3 Skill 管理侧车（Sidecar）

| 功能 | 说明 |
|------|------|
| 列表查询 | `GET /skills` → 返回容器内所有 skill |
| 安装 Skill | `POST /skills/{name}` → 上传 SKILL.md |
| 删除 Skill | `DELETE /skills/{name}` → 删除 skill 目录 |
| 实时生效 | 操作 PVC 共享卷，无需重启 OpenCode |

### 3.4 运行时监控

| 功能 | 说明 |
|------|------|
| 健康检查 | 调用 OpenCode `/global/health` → `{ healthy, version }` |
| 会话概览 | `GET /session` 会话数；`GET /session/status` 会话状态；展示会话标题/时间 |
| 实时事件 | 订阅 `GET /event` SSE 流，实时刷新会话状态变更 |
| MCP/Agent/Provider 状态 | `GET /mcp`、`/agent`、`/provider`（附加） |
| Pod 日志流 | 流式显示容器 stdout/stderr（可选） |

> **注（Q8 决策）**：经核实 opencode HTTP API，**不提供 Token 用量/成本字段**，也无聚合统计端点。原 PRD 承诺的"Token 用量"已删除，监控指标严格对齐 API 实际能力。

### 3.5 内嵌对话

每个 OpenCode 实例本身就是对话服务（`opencode serve` 暴露 HTTP API）。平台内嵌对话 UI，用户在平台内直接与自己部署的实例对话。

| 功能 | 说明 |
|------|------|
| 会话列表 | `GET /session` 展示该实例的会话 |
| 发送消息 | `POST /session/:id/message`（同步）或 `/prompt_async`（异步） |
| 消息历史 | `GET /session/:id/message` 拉取消息与分片 |
| 权限控制 | 用户**仅能访问自己部署的实例**（Q7 决策），后端按实例 `owner` label 鉴权 |
| 流式响应 | 订阅 `GET /event` SSE，实时展示回复 |

> 此模块由 Q7 澄清引出：原 PRD 3.1"支持从对话 App 集成"实指"平台内嵌对实例的对话能力"，非对接外部产品。

---

## 4. 架构设计

```
┌──────────────────────────────────────────────────────────┐
│                      前端 Web UI                            │
│  登录 │ 配置向导 │ 实例列表 │ 对话 │ Skill 管理 │ 监控        │
└────────┬────────────────────────────┬────────────────────┘
         │                            │
    ┌────┴──────────┐          ┌──────┴──────────┐
    │ 管理平面后端    │          │ 实例对话/监控代理 │
    │ - 账号/JWT 鉴权 │          │ (转发到实例 API)  │
    │ - K8s client   │          └──────┬──────────┘
    │   (ServiceAccount)│               │
    └────┬──────────┘                   │
         │                              │
    ┌────┴──────────────────────────────┴────┐
    │            K8s 共享 Namespace            │
    │   (label: owner=<user> 区分归属)         │
    │  ┌──────────────────────────────────┐   │
    │  │ Pod (每用户每实例一个)              │   │
    │  │ ┌──────────┐  ┌──────────────┐   │   │
    │  │ │ opencode │  │ 监控服务 sidecar│   │   │
    │  │ │ :4096    │  │ :8080         │   │   │
    │  │ │ (对话API) │  │ skill CRUD    │   │   │
    │  │ └──────────┘  │ 监控聚合       │   │   │
    │  │               └──────────────┘   │   │
    │  │  ConfigMap: opencode.json (只读)   │   │
    │  │  PVC: .opencode/ (skill 文件, RW)  │   │
    │  └──────────────────────────────────┘   │
    └──────────────────────────────────────────┘
```

### 组件说明

| 组件 | 技术选型 | 职责 |
|------|----------|------|
| 前端 | React / Vue + Tailwind | 登录、配置向导、实例列表、内嵌对话、Skill 管理、监控 |
| 管理平面后端 | Node/Go（含 K8s client） | 账号/JWT 鉴权；通过 ServiceAccount+RBAC 调 K8s API 创建/更新 Deployment、ConfigMap、Secret；代理到实例的对话/监控请求 |
| 监控服务 sidecar | Python FastAPI | 与 opencode 同 Pod 共享 PVC：skill CRUD（zip 目录级，改 PVC 即时生效无需重启）；聚合 opencode `/global/health`、`/session`、`/event` 等为监控数据 |
| 镜像 | Docker + Node:22-alpine | 打包 opencode CLI（镜像构建/分发测试环境再定） |

---

## 5. 数据流

```
用户选择配置 → 配置页向导收集信息 → 前端生成 opencode.json
  → POST /api/deploy → 管理平面后端写 ConfigMap（opencode.json 必选挂载，非可选）
  → 后端通过 ServiceAccount 调 K8s API 创建 Deployment（含 ConfigMap + Secret + PVC）
  → Pod 启动 → opencode serve 加载配置

（编辑现有实例时：导入 opencode.json → 反向解析回填向导 → 修改后重新部署）
（配置 JSON 变更 → 改 ConfigMap → 需重启 Pod 才生效）

用户管理 Skills（无需重启实例）
  → 前端 → 管理平面后端 → 监控服务 sidecar → 改 PVC 中 skill 文件
  → opencode 下一次调用 skill 工具时即时感知（Q2 验证）

用户对话
  → 前端 → 管理平面后端（校验 owner 鉴权）→ opencode 实例 /session/:id/message
  → SSE 流式返回回复
```

---

## 6. 里程碑

| 阶段 | 内容 | 时间 |
|------|------|------|
| P0 | 监控服务 sidecar（skill CRUD + 监控聚合）+ Dockerfile 打包 | 1-2 天 |
| P1 | 管理平面后端（账号/JWT + K8s client + 实例代理）+ 前端 Skill 管理页 | 3-4 天 |
| P2 | 配置生成器 v1（向导：Provider + 权限 + MCP + Skill 管理，含导入）+ K8s 一键部署 | 4-5 天 |
| P3 | 内嵌对话 UI + 运行时监控（健康/会话/状态/SSE） | 2-3 天 |
| P4 | 配置生成器 v2（自定义 Agent + Hook/Plugin）、SSO 对接、多实例编排 | 后续迭代 |

> 注：用户体系（账号/JWT + label 隔离）随 P1 落地，"仅自己实例"权限边界在 P1 即生效。k8s/镜像仓库相关在测试环境联调。

---

## 7. 决策记录（2026-06-28，全部已定）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 配置页 v1 范围 | **核心子集**：Provider + 权限 + MCP + Skill 管理（约 4-5 天）。自定义 Agent、Hook/Plugin 列为后续迭代 |
| D2 | 配置导入 | **支持**：实现 opencode.json parser，导入后回填向导表单 |
| D3 | 自定义 Agent 形式（v2） | **Markdown 文件**：写入 `.opencode/agents/xxx.md`，复用 skill 管理的文件上传到 PVC 机制 |
| Q1 | K8s API 暴露方式 | **独立后端 + ServiceAccount/RBAC**；kubectl proxy 仅留作本地开发调试 |
| Q2 | Skill 热更新 | **监控服务改 PVC 即时生效，无需重启**；仅配置 JSON 变更需重启 Pod |
| Q3 | ConfigMap 语义 | **opencode.json 走 ConfigMap 挂载（必选）**，原"可选项"措辞已删除 |
| Q4 | 镜像构建与分发 | **测试环境再定**（开发阶段先逻辑开发，不依赖真实 k8s/镜像仓库） |
| Q5 | Skills 隔离 | **每实例独立 PVC**，互不共享 |
| Q6 | Skill 粒度 | **目录级 zip 上传**，解压到 `.opencode/skills/<name>/`，支持带资源文件 |
| Q7 | 配置 UI 归属 + 对话能力 | 平台**内嵌对话 UI**，用户**仅能访问自己实例**；配置页自包含，原"对话 App 集成"实指此（见 3.5） |
| Q8 | 监控数据来源 | 经核实 opencode API：**删除 Token 用量**（API 不提供），监控只做健康/会话数/状态/标题/时间/SSE 实时 |
| Q9+Q12 | 登录与鉴权 | **自带账号体系**（用户名密码 + JWT），不依赖公司 SSO；SSO 留作后续可选 |
| Q10+Q11 | 多租户与资源隔离 | **共享 namespace + label(owner) 隔离**；PVC 每实例一个，随实例删除级联回收 |

### 架构演进说明（相对 v0.1）

1. 原"skill-mgr sidecar"升级为**监控服务 sidecar**（skill CRUD + 监控聚合）。
2. 新增**管理平面后端**层（账号鉴权 + K8s client + 实例代理），取代原模糊的"K8s Proxy"。
3. 新增**内嵌对话**功能模块（3.5），平台不只是部署管理，还提供对实例的对话入口。
4. 引入**用户体系**（账号/JWT + label 隔离），支撑"仅自己实例"的权限边界。
