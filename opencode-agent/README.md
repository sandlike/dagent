# OpenCode 容器管理平台

> 配置 → 部署 → 对话 → 管理 OpenCode agent 实例的 Web 平台。
> 前端 Vue 3 + 管理后端 Hono + 监控服务 sidecar Hono + MySQL，Monorepo（pnpm workspace）。

## 目录结构

```
opencode-agent/
├── apps/
│   ├── web/          # Vue 3 前端（Vite + Tailwind v4 + Pinia）
│   ├── server/       # 管理平面后端（Hono + Drizzle + MySQL + JWT + K8s）
│   └── sidecar/      # 监控服务 sidecar（Hono：Skill CRUD + 监控聚合 + 审计）
├── packages/
│   └── shared/       # 前后端共享类型 / 配置生成器 / 常量
├── docs/             # 前端设计文档
├── opencode-platform-design/   # 设计稿（HTML）
└── PRD.md            # 产品需求文档
```

## 架构

```
┌──────────┐    /api    ┌──────────┐           ┌─────────────────────┐
│  web 前端 │ ─────────▶ │ 管理后端  │ ──proxy──▶│ Pod                 │
│ (Vue)    │            │ (Hono)   │           │ ┌────────────────┐  │
└──────────┘            │ +JWT/K8s │           │ │ opencode :4096 │  │
                        └────┬─────┘           │ ├────────────────┤  │
                             │ skill CRUD/监控  │ │ sidecar :8080  │  │
                             └─────────────────▶│ └───────┬───────┘  │
                                                │  共享 PVC .opencode│
                                                └─────────────────────┘
```

sidecar 与 opencode 同 Pod、共享 PVC，改 skill 文件**即时生效无需重启**。

## 快速开始

### 1. 环境要求

- Node.js ≥ 20
- pnpm ≥ 9

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填写 MySQL 连接（库需先存在，名为 agenthub）
```

### 3. 安装依赖

```bash
pnpm install
```

### 4. 初始化数据库

首次运行需建库 + 建表：

```bash
# 建库（确保 agenthub database 存在）
pnpm --filter @opencode/server exec tsx src/db/init.ts

# 推送表结构（若 drizzle-kit push 报 check_constraints 错误，
# 是 MySQL 5.x 与 drizzle-kit 的兼容问题，改用生成的迁移文件）
pnpm --filter @opencode/server exec drizzle-kit generate
# 然后执行 src/db/migrations/*.sql（用 mysql2 或任意客户端）
```

### 5. 启动开发服务

```bash
pnpm dev   # 同时启动前端(5173) + 后端(3000) + sidecar(8080)
```

- 前端：http://localhost:5173
- 管理后端：http://localhost:3000
- sidecar：http://localhost:8080
- 前端通过 Vite proxy 把 `/api` 转发到后端

> 本地联调 sidecar 时，给后端设 `SIDECAR_BASE=http://localhost:8080`，否则后端默认走 K8s Pod DNS。

## 主要功能

| 功能 | 状态 |
|------|------|
| 注册 / 登录（JWT） | ✅ |
| 实例列表（搜索/过滤） | ✅ |
| 配置向导（4 步 + 实时 JSON 预览 + 导入） | ✅ |
| 一键部署（ConfigMap/Secret/Deployment/PVC） | ✅ K8s 不可达时自动降级 Mock |
| Skill 管理（zip 上传/卸载/下载） | ✅ sidecar 实现，即时生效 |
| 内嵌对话（会话/消息/SSE） | ✅ 视图就绪，依赖 opencode 实例 |
| 运行时监控（健康/会话/MCP/Agent） | ✅ 视图就绪，依赖 opencode 实例 |
| 实例设置（编辑配置/重启/删除） | ✅ |

## 监控服务 sidecar

独立可运行，与 opencode 同 Pod 共享 PVC。端口 `:8080`。

| API | 说明 |
|-----|------|
| `GET /skills` | 列出所有 skill（解析 frontmatter） |
| `POST /skills` | 上传 zip（multipart: name + file），自动剥离顶层目录 |
| `GET /skills/:name` | skill 详情（含 SKILL.md 原文） |
| `GET /skills/:name/download` | 打包下载 |
| `DELETE /skills/:name` | 删除（即时生效） |
| `GET /monitor/health` | opencode 健康检查聚合 |
| `GET /monitor/sessions` | 会话列表（合并状态） |
| `GET /monitor/components` | MCP/Agent/Provider 并发聚合 |
| `GET /audit?limit=N` | 审计日志（skill 增删等） |

安全：zip 路径穿越拦截、skill 名称校验（K8s 友好命名）、SKILL.md 必须存在。

## 技术决策

详见 `PRD.md` 第 7 节。关键决策：
- K8s 部署走独立后端 + ServiceAccount（本地用 kubeconfig）
- opencode.json 通过 ConfigMap 挂载（必选），改配置需重启 Pod
- Skill 文件改 PVC 即时生效，无需重启（监控服务 sidecar 管理）
- 每实例独立 PVC；共享 namespace + label(owner) 隔离
- 自带账号体系 + JWT，不依赖公司 SSO
- 监控指标严格对齐 opencode API（无 Token 用量）
- sidecar 与平台后端同为 Node + Hono，可复用类型/工具链

## 备注

- 对话/监控功能依赖真实的 opencode 实例运行，无实例时前端会显示空状态。
- 生产部署需构建 sidecar 镜像（`apps/sidecar/Dockerfile`），K8s 模板已引用 `opencode-sidecar:latest`（可通过 `SIDECAR_IMAGE` 环境变量覆盖）。
