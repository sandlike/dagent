# 公司级记忆库（Memory Store）设计方案

> 最后更新：2026-07-07
> 状态：设计稿（待实施）

## 一、目标

给 OMA 平台上每个 opencode agent 实例提供长期记忆能力，支持：

1. **per-user + per-agent 定位**：检索"某用户在某 agent"的记忆
2. **跨 agent 访问**：某用户在 agent B 能读 agent A 的记忆（需管理员授权）
3. **ID 绝对稳定**：`agent_id` / `user_id` **不经过模型**，强制从传输层注入，模型无法伪造或漏填

## 二、核心设计原则：ID 不过模型

MCP 工具调用的默认链路是：

```
模型 →（填工具参数）→ MCP Server → 记忆库
```

若 `user_id` / `agent_id` 是工具参数，模型可能漏填、填错、甚至幻觉成别人的 ID。
**唯一的可靠解法：把这两个 ID 从"工具参数"降级为"传输层凭证"——HTTP header。**

模型看到的工具 schema 长这样（**无任何 ID 参数**）：

```json
{ "name": "memory_search", "inputSchema": { "query": "string", "limit": "number" } }
{ "name": "memory_add",    "inputSchema": { "content": "string" } }
```

而 `X-Agent-Id` / `X-User-Id` 由 OMA server 在 deploy 时写进 ConfigMap（`opencode.json` 的 `mcp.memory.headers`），opencode 容器每次调 MCP 自动带上，**模型在 tool-call 里结构上无法触及**。gateway 每请求强制校验，缺失即 401。

这与项目现有的 Higress `OMA_LLM_KEY` 模式完全同构——LLM key 这么干，记忆库 ID 也这么干。

### 2.1 header 透传已源码级验证（2026-07-07）

方案成立的前提是 opencode 真的把 `mcp.<name>.headers` 透传给远端 MCP server。**已验证 PASS**，双重证据：

**证据 A — 官方文档**（`references/mcp.md:42-64`）明确 `headers` 字段语义为 "Custom HTTP headers"，支持 `{env:VAR}` 替换。

**证据 B — 源码级反编译**（opencode-ai 是 bun-compiled 单文件，内嵌完整 Effect-TS 源码）：

```js
// 第 1 层：MCP.connectRemote 读 headers 塞进 transport
transport: new StreamableHTTPClientTransport(url,
  { requestInit: config.headers ? { headers: config.headers } : void 0 })

// 第 2 层：每个请求都合并 headers（不是只 connect 一次）
async _commonHeaders() {
  const builtin = {};  // mcp-session-id / OAuth bearer 等
  const user = normalize(this._requestInit?.headers);  // 用户配置的 headers
  return new Headers({ ...builtin, ...user });  // 用户 headers 最后展开（可覆盖内建）
}

// 第 3 层：实际 POST 请求
const headers = await this._commonHeaders();
const resp = await fetch(this._url, { ...this._requestInit, method: "POST", headers, body });
```

**关键结论**：
1. 任意自定义 header（`X-Agent-Id`/`X-User-Id`/任意 key）**逐请求透传**，initialize 之后所有 tools/list、tools/call 都带
2. **用户 headers 优先级高于内建**（`new Headers({...内建, ...用户})`）——可用自定义 `Authorization`，不被 OAuth bearer 顶掉
3. **HTTP 和 SSE 两种 transport 都透传**——不用担心 fallback 到 SSE 时 header 丢失
4. 容器 1.15.13 + 本地 1.15.12 同一份逻辑

完整证据链见**附录 A**。

## 三、技术选型

### 3.1 记忆引擎：Mem0 OSS

| 维度 | 选择 |
|------|------|
| 项目 | [Mem0](https://github.com/mem0ai/mem0) |
| 原生三轴 | `user_id`（跨 agent 用户维度）/ `agent_id`（单 agent 内）/ `run_id`（单次会话） |
| 部署 | Docker Compose：API + Postgres/pgvector + Neo4j（图谱） |
| 能力 | LLM 驱动的事实抽取/合并/去重（模型不必主动 `memory_add`） |
| 接口 | REST API（`/memories`、`/search`） |

三轴正好对应需求：
- `user_id` = 跨 agent 的用户维度（"某用户跨 agent"）
- `agent_id` = 单 agent 内的用户记忆（"某用户在某 agent"）
- `run_id` = 单次会话（可选）

> **重要**：Mem0 默认把这三个当**工具参数**（会过模型），所以**必须改造一层注入网关**把它们从 header 注入、从 schema 里删掉。这是本方案的核心。

### 3.2 注入网关：独立服务 `apps/memory-gateway`

不在 opencode 与 Mem0 之间直连，而是加一层 Hono 服务做身份强制 + 协议转换：

```
opencode → memory-gateway（强制身份 + 删 ID 参数）→ Mem0 OSS
```

**为什么独立服务，不嵌 sidecar**：
- sidecar 当前无 user 上下文（`apps/sidecar/src/env.ts` 只有 `OPENCODE_DIR`/`OPENCODE_BASE`）
- 独立服务可单独伸缩，授权逻辑集中，不污染 sidecar 职责

### 3.3 与其他方案对比

| 项目 | 原生 user_id+agent_id | 自托管 | 与 opencode 兼容 | 适合度 | 备注 |
|------|---|---|---|---|---|
| **Mem0** | ✅ | ✅ | ✅ 官方有 MCP | **最佳** | 事实抽取/合并智能 |
| Zep | ✅ | ✅ 需 Postgres+Neo4j | ✅ | 中 | 时序知识图谱，重 |
| Letta (MemGPT) | ✅ | ✅ | ❌ 冲突 | 低 | 本身是 agent runtime，与 opencode 竞品 |
| Cognee | ✅ | ✅ | ✅ | 中 | 类型化图谱，偏研究 |

## 四、整体架构

```
opencode 容器（模型）
  └─ MCP 客户端 — 只看到 memory_search / memory_add 两个工具，参数无任何 ID
       │  HTTP，header 强制带 X-Agent-Id / X-User-Id / Authorization（deploy 时写死）
       ▼
[memory-gateway]（新建 apps/memory-gateway，Hono + @modelcontextprotocol/sdk）
  │  1. 校验 Authorization（Higress consumer key）
  │  2. 从 header 读 X-Agent-Id / X-User-Id，缺失 → 401（绝对稳定，模型无法触及）
  │  3. 从 header 读 X-Allowed-Cross-Agents（deploy 时静态授权的源 agent 列表）
  │  4. 转发到 Mem0 REST API，body 注入 user_id/agent_id
  │  5. memory_search 时，自动合并 {当前 agent} ∪ {允许的源 agent} 的记忆（模型无感）
  ▼
[Mem0 OSS]（Docker Compose：API + Postgres/pgvector + Neo4j）
  POST /memories  { messages, user_id, agent_id }
  POST /search    { query, user_id, agent_id }
  GET  /memories?user_id=&agent_id=
```

## 五、数据模型：`memory_grants` 表（跨 agent 授权）

授权表存 OMA server 的 MySQL，gateway 不连 DB（纯 header 驱动，无状态）。

```sql
-- apps/server/src/db/migrations/0002_memory_grants.sql
CREATE TABLE `memory_grants` (
  `id` int AUTO_INCREMENT NOT NULL,
  `grantee_user_id` int NOT NULL,          -- 被授权的用户（= users.id）
  `source_agent_id` varchar(64) NOT NULL,  -- 源 agent（= groupId，记忆来源）
  `target_agent_id` varchar(64) NOT NULL,  -- 目标 agent（= groupId，授权生效的 agent）
  `scope` enum('read','read_write') NOT NULL DEFAULT 'read',
  `status` enum('active','revoked') NOT NULL DEFAULT 'active',
  `granted_by` int NOT NULL,               -- 管理员（= users.id）
  `created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
  `updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
  CONSTRAINT `memory_grants_id` PRIMARY KEY(`id`)
);
CREATE INDEX `idx_mg_grantee_target` ON `memory_grants`(`grantee_user_id`, `target_agent_id`);
CREATE INDEX `idx_mg_source` ON `memory_grants`(`source_agent_id`);
```

**语义**：`grantee_user_id` 在 `target_agent_id` 里能读 `source_agent_id` 的记忆。

migration 风格仿 `0001_instance_versioning.sql`（存储过程 + information_schema 判断，幂等）。
drizzle 定义仿 `apps/server/src/db/schema.ts` 的 `auditLogs` 表，导出 `MemoryGrantRow` / `NewMemoryGrant`。

## 六、改动清单

### 6.1 模块 A：deploy 时注入 memory MCP（核心，最小侵入）

**文件**：`apps/server/src/routes/instances.ts`

新增同文件 helper（放在 `rewriteConfigForHigress` 旁边）：

```ts
function injectMemoryMcp(
  configJson: string,
  ownerId: number,
  groupId: string,
  allowedCrossAgents: string[] = [],
): string {
  const memUrl = env.memoryGatewayUrl   // 新增 env
  const key = env.memoryConsumerKey     // 新增 env（OMA 签发的全局 memory consumer key）
  try {
    const cfg = JSON.parse(configJson)
    cfg.mcp = cfg.mcp ?? {}
    const headers: Record<string, string> = {
      'X-Agent-Id': groupId,
      'X-User-Id': String(ownerId),
      'Authorization': `Bearer ${key}`,
    }
    if (allowedCrossAgents.length > 0) {
      headers['X-Allowed-Cross-Agents'] = allowedCrossAgents.join(',')
    }
    cfg.mcp.memory = { type: 'remote', url: memUrl, headers }
    return JSON.stringify(cfg)
  } catch { return configJson }
}
```

**注入点 1 — POST `/deploy`**（`instances.ts`）：
- 现状：`line 89` Higress 重写 → `line 92` 生成 groupId → `line 97` 写库
- 改造：在 `line 92` 之后、`line 97` 之前插入授权查询 + 注入：

```ts
const groupId = `ag-${randomShortId()}`   // line 92（已存在）
// 新增：查该用户在该 agent 上被授予的跨 agent 读源
const grants = await db.select().from(schema.memoryGrants)
  .where(and(
    eq(schema.memoryGrants.granteeUserId, user.sub),
    eq(schema.memoryGrants.targetAgentId, groupId),
    eq(schema.memoryGrants.status, 'active'),
  ))
configJson = injectMemoryMcp(configJson, user.sub, groupId, grants.map(g => g.sourceAgentId))
// 之后是 line 97 的写库
```

> 首次 deploy 时 groupId 是新的，grants 通常为空。跨 agent 场景主要走 PUT（版本更新）或单独的"刷新授权"接口。

**注入点 2 — PUT `/:id`**（版本更新，`instances.ts` line 154+）：
- `groupId = cur.groupId`（line 175，已有）
- Higress 重写后（line 197 之后）插入同样的授权查询 + `injectMemoryMcp` 调用

**新增 env**（`apps/server/src/env.ts`）：

```ts
memoryGatewayUrl: process.env.MEMORY_GATEWAY_URL ?? '',
memoryConsumerKey: process.env.MEMORY_CONSUMER_KEY ?? '',
```

**关于 `buildMcpBlock`**：`packages/shared/src/config/index.ts:85-106` 经核实**无 bug**（两个分支都是 `block[name] = entry`）。`injectMemoryMcp` 在 server 端直接操作 configJson 字符串，不经过 `generateConfig`/`buildMcpBlock`，与用户在向导里配的 MCP 互不干扰。

### 6.2 模块 B：新建 `apps/memory-gateway` 服务

**目录结构**（仿 `apps/sidecar`）：

```
apps/memory-gateway/
├── package.json              # name: @opencode/memory-gateway；依赖 hono + @modelcontextprotocol/sdk + zod
├── tsconfig.json             # 抄 sidecar，ESM/NodeNext
├── Dockerfile                # 抄 sidecar 多阶段（builder tsc → runner prod deps），node:22-alpine
└── src/
    ├── index.ts              # Hono app，端口 8090，/health + /mcp（MCP over HTTP 端点）
    ├── env.ts                # sidecar 风格：process.env.XXX ?? 默认
    ├── mcp-server.ts         # @modelcontextprotocol/sdk 定义 memory_search 工具（只读）
    ├── mem0-client.ts        # fetch 转发到 Mem0 REST API（注入 user_id/agent_id）
    └── middleware/
        └── enforce-identity.ts  # 强制校验 X-Agent-Id/X-User-Id/Authorization
```

**核心 1：`mcp-server.ts`**（只暴露 `memory_search`，工具 schema **绝不含 ID**）：

> **设计决策**：只给模型读记忆的能力（`memory_search`），**不暴露写工具**。记忆写入由 sidecar 在会话结束时自动调用 Mem0 抽取（见 6.7 节）。理由：Mem0 的核心价值是"给它对话原文，LLM 自动抽取事实并去重"，让模型主动 `memory_add` 会绕过这套抽取逻辑，产生重复/低质量记忆，且浪费 token。

```ts
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: '搜索该用户在当前 agent 的长期记忆（跨 agent 授权的记忆会自动合并）',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number', default: 5 } },
        required: ['query'],
        // ⚠️ 没有 user_id / agent_id —— 模型填不了，也无法伪造
      },
    },
  ],
}))
```

`tools/call` handler 从 AsyncLocalStorage 取 ID（enforce-identity 中间件注入），模型传入的参数**只有 query**：

```ts
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const ctx = getCurrentCtx()
  if (req.params.name === 'memory_search') {
    const { query, limit } = req.params.arguments
    // 1. 查当前 agent
    let results = await mem0Search({ query, user_id: ctx.userId, agent_id: ctx.agentId, limit })
    // 2. 自动合并允许的跨 agent 源（模型无感）
    for (const srcAgent of ctx.allowedCrossAgents) {
      const more = await mem0Search({ query, user_id: ctx.userId, agent_id: srcAgent, limit })
      results = results.concat(more)
    }
    return { content: [{ type: 'text', text: JSON.stringify(dedupe(results)) }] }
  }
})
```

**核心 2：`enforce-identity.ts`**（绝对稳定的保证）：

```ts
app.use('/mcp/*', async (c, next) => {
  const agentId = c.req.header('X-Agent-Id')
  const userId  = c.req.header('X-User-Id')
  const auth    = c.req.header('Authorization')
  if (!agentId || !userId || !auth) {
    return c.json({ error: 'identity headers required' }, 401)  // 缺一即拒
  }
  if (!await verifyConsumerKey(auth)) return c.json({ error: 'invalid credential' }, 401)
  const allowed = c.req.header('X-Allowed-Cross-Agents')?.split(',').filter(Boolean) ?? []
  runWithCtx({ agentId, userId: Number(userId), allowedCrossAgents: allowed }, () => next())
})
```

**核心 3：`mem0-client.ts`**（转发到 Mem0 REST API，只实现 search；写入由 sidecar 调，见 6.7）：

```ts
export async function mem0Search(p: { query: string; user_id: number; agent_id: string; limit?: number }) {
  const r = await fetch(`${env.mem0BaseUrl}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${env.mem0ApiKey}` },
    body: JSON.stringify({
      query: p.query,
      user_id: String(p.user_id),   // Mem0 用 string
      agent_id: p.agent_id,
      limit: p.limit ?? 5,
    }),
  })
  return (await r.json()) as Mem0Memory[]
}
// 注意：Mem0 的 /memories 写入不由 gateway 处理，改由 sidecar 在会话结束时调用（见 6.7）
```

**`package.json` 关键依赖**：

```json
{
  "name": "@opencode/memory-gateway",
  "type": "module",
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsc", "start": "node dist/index.js" },
  "dependencies": {
    "hono": "...", "@hono/node-server": "...",
    "@modelcontextprotocol/sdk": "^1.x",
    "zod": "..."
  }
}
```

> 无需连 DB、无需 drizzle、无需 mysql2——gateway 是纯无状态转发层，身份全靠 header。

### 6.3 模块 C：Mem0 OSS 部署

**文件**：`deploy/k8s/base/memory.yaml`（新增）

用官方镜像 + Postgres/pgvector + Neo4j，3 个工作负载：

```yaml
# 1. Postgres + pgvector（记忆向量存储）
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: mem0-postgres, labels: { app: mem0-postgres } }
spec:
  serviceName: mem0-postgres
  replicas: 1
  template:
    spec:
      containers:
        - name: postgres
          image: pgvector/pgvector:pg16   # 从代理仓库 retag 到 ACR
          env:
            - { name: POSTGRES_DB, value: mem0 }
            - { name: POSTGRES_PASSWORD, valueFrom: { secretKeyRef: { name: mem0-secret, key: PG_PASSWORD } } }
          ports: [{ containerPort: 5432 }]
          volumeMounts: [{ name: data, mountPath: /var/lib/postgresql/data }]
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        storageClassName: alicloud-disk-essd   # 必须显式指定（集群无默认 SC）
        accessModes: ['ReadWriteOnce']
        resources: { requests: { storage: 20Gi } }   # 阿里云最小 20Gi
---
# 2. Neo4j（图谱，可选）
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: mem0-neo4j }
# 同构，镜像 neo4j:5.x，7687/7474 端口，2Gi 内存（Java），20Gi PVC
---
# 3. Mem0 API（REST server）
apiVersion: apps/v1
kind: Deployment
metadata: { name: mem0-api }
spec:
  template:
    spec:
      containers:
        - name: api
          image: mem0ai/mem0:latest   # 从代理 retag 到 ACR
          env:
            - { name: MEM0_STORE_PROVIDER, value: pgvector }
            - { name: MEM0_STORE_PG_URL, value: postgresql://postgres:***@mem0-postgres:5432/mem0 }
            - { name: MEM0_GRAPH_STORE_PROVIDER, value: neo4j }
            - { name: MEM0_GRAPH_STORE_URL, value: bolt://mem0-neo4j:7687 }
            - { name: MEM0_EMBEDDER, value: openai }   # 嵌入模型，可走 Higress 接 DeepSeek/通义
          ports: [{ containerPort: 8080 }]
---
# 4. Services（mem0-api / mem0-postgres / mem0-neo4j 同构）
apiVersion: v1
kind: Service
metadata: { name: mem0-api }
spec: { selector: { app: mem0-api }, ports: [{ port: 8080 }] }
```

**镜像处理**（遵循项目约定）：
- `mem0ai/mem0`、`pgvector/pgvector`、`neo4j` 从代理 `niddmerfwaxuyqg5mh.xuanyuan.run` 拉取 → buildx amd64 → 推 `registry.cn-hangzhou.aliyuncs.com/citics_lwj/`
- `apps/memory-gateway/Dockerfile` 照 `apps/sidecar/Dockerfile` 多阶段构建，buildx `--platform linux/amd64`

**Secret**（手动建，仿 opencode-server-secret）：

```bash
kubectl create secret generic mem0-secret -n opencode-platform-test \
  --from-literal=PG_PASSWORD=... \
  --from-literal=NEO4J_PASSWORD=... \
  --from-literal=MEM0_API_KEY=...
```

### 6.4 模块 D：memory-gateway K8s 部署

**文件**：`deploy/k8s/base/memory-gateway-deployment.yaml`（新增，抄 `server-deployment.yaml`）

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: memory-gateway-config }
data:
  MEM0_BASE_URL: "http://mem0-api.opencode-platform-test.svc:8080"
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: memory-gateway }
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: gateway
          image: opencode-memory-gateway:latest   # overlay 覆盖
          ports: [{ containerPort: 8090 }]
          envFrom:
            - configMapRef: { name: memory-gateway-config }
            - secretRef: { name: memory-gateway-secret }   # MEM0_API_KEY, MEMORY_CONSUMER_KEY
          readinessProbe: { httpGet: { path: /health, port: 8090 } }
---
apiVersion: v1
kind: Service
metadata: { name: memory-gateway }
spec: { selector: { app: memory-gateway }, ports: [{ port: 8090 }] }
```

**`deploy/k8s/base/kustomization.yaml`**：
- `resources` 加 `memory.yaml` 和 `memory-gateway-deployment.yaml`
- `images` 加 `- name: opencode-memory-gateway newTag: latest`

三个 overlay（ack-test/staging/prod）按需 patch。

### 6.5 模块 E：Higress 集成（gateway 鉴权）

**文件**：`apps/server/src/services/higress.ts` 新增 `setupMemoryRoute()`（仿 `apps/server/src/routes/mcp-servers.ts:48-83` 的 `/v1/service` + `/v1/routes` 三件套，**不是** LLM 的 AI route）：

```ts
export async function setupMemoryRoute(opts: {
  serviceName: string; serviceUrl: string; pathPrefix: string
}): Promise<{ routeName: string; consumerName: string; consumerKey: string; gatewayUrl: string }> {
  const lowerName = 'memory-gateway'
  const upstreamName = `mg-upstream-${lowerName}`
  const routeName = `mg-route-${lowerName}`
  const consumerName = `mg-consumer-${lowerName}`
  const consumerKey = genKey('oma-mem')
  // 1. /v1/service 创建 upstream（指向 memory-gateway K8s Service）
  // 2. /v1/consumers 创建 consumer（credentials: key-auth BEARER [consumerKey]）
  // 3. /v1/routes 创建 route（path: /mcp/，authConfig 启用，allowedConsumers: [consumerName]）
  return { routeName, consumerName, consumerKey, gatewayUrl: `${env.higress.gatewayUrl}/mcp` }
}
```

> 这个 `consumerKey` 就是模块 A 里 `env.memoryConsumerKey` 的来源——**全局一份**（所有 agent 共用同一个 consumer key 进 Higress，真正的 per-user/per-agent 隔离由 gateway 内部 `X-Agent-Id`/`X-User-Id` 完成）。也可做成 per-agent consumer key（更细，但 deploy 时多一步）。

### 6.6 模块 F：管理端授权 API + 前端

**后端 API**（`apps/server/src/routes/memory-grants.ts`，仿 `mcp-servers.ts`）：
- `GET /api/memory-grants` — 列出当前用户相关的授权（管理员看全部）
- `POST /api/memory-grants` — 创建授权（仅 admin）
- `DELETE /api/memory-grants/:id` — 撤销授权
- 创建/撤销后，触发目标 agent 重新 deploy 或热刷新 ConfigMap（更新 `X-Allowed-Cross-Agents` header）

在 `apps/server/src/index.ts` 挂载：

```ts
app.use('/api/memory-grants/*', authMiddleware)
app.route('/api/memory-grants', memoryGrantsRoute)
```

**前端**（`apps/web`）：
- 新增"记忆授权"管理页（管理员视角），仿现有 Providers/MCP 管理页风格
- 表格：被授权用户 / 源 agent / 目标 agent / scope / 状态 / 操作
- 此部分为 P1，可后置

### 6.7 模块 G：Mem0 OSS 配置 + sidecar 自动抽取

本节解决两个问题：(1) Mem0 的 embedder/LLM 在 ACK 上怎么跑；(2) 记忆何时写入 Mem0。

#### 6.7.1 Mem0 的 embedder/LLM 选型

Mem0 OSS 需要两个模型：
- **embedder**：把记忆文本向量化（用于检索）
- **LLM**：从对话里抽取事实 + 去重合并（Mem0 的核心智能）

gateway 用 Mem0 的 TypeScript SDK，配置通过 `Memory.fromConfig()` 传入：

```ts
// apps/memory-gateway/src/mem0-client.ts
import { Memory } from 'mem0ai'

export const memory = Memory.fromConfig({
  vector_store: {
    provider: 'pgvector',
    config: {
      host: env.pgHost, port: 5432, dbname: 'mem0',
      user: 'postgres', password: env.pgPassword,
      collection: 'oma_memories',
    },
  },
  // LLM 用于事实抽取——直接复用项目现有 DeepSeek 凭据走 Higress
  llm: {
    provider: 'deepseek',
    config: {
      model: 'deepseek-chat',
      api_key: env.deepseekApiKey,                       // = OMA_LLM_KEY（Higress consumer key）
      openai_base_url: env.deepseekBaseUrl,              // = Higress gateway URL
      temperature: 0.1,                                  // 低温度保证抽取确定性
    },
  },
  // embedder 用通义 text-embedding-v3（OpenAI 兼容，走 Higress）
  embedder: {
    provider: 'openai',                                  // TS SDK 仅支持 openai/gemini/azure_openai/ollama
    config: {
      model: 'text-embedding-v3',
      api_key: env.tongyiApiKey,
      openai_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
  },
})
```

> **为什么不用 DeepSeek 做 embedding**：DeepSeek 只有 chat completion，**没有 embedding 接口**。
> **为什么不用阿里通义 native provider**：Mem0 TS SDK 没有，但 `openai` provider 支持自定义 `openai_base_url`，通义提供 OpenAI 兼容模式（`/compatible-mode/v1`）。

#### 6.7.2 TS SDK 的 provider 限制（重要）

Mem0 的 TS SDK embedder provider 只有 4 个（比 Python SDK 少）：

| 组件 | Python SDK | **TS SDK（gateway 用）** |
|------|-----------|----------------------|
| Embedder | openai, gemini, azure_openai, ollama, huggingface, vertexai, aws_bedrock | **openai, gemini, azure_openai, ollama** |
| LLM | openai, anthropic, gemini, groq, ollama, aws_bedrock, azure_openai, litellm | openai, anthropic, gemini, groq, ollama, azure_openai, mistral, **deepseek** |

**结论**：
- LLM 直接用 `deepseek` provider（TS SDK 原生支持），走 Higress，复用现有凭据
- embedder 用 `openai` provider + 通义 `text-embedding-v3` 的 OpenAI 兼容 endpoint
- 备选：`ollama` provider + 本地 bge-m3（完全离线，但要多跑 Ollama Pod）

#### 6.7.3 记忆写入：sidecar 会话结束自动抽取（方案 X）

**核心设计**：模型不主动写记忆。sidecar 监听 opencode 的会话事件，在会话结束时把整段对话发给 Mem0，由 Mem0 的 LLM 自动抽取事实。

```
opencode 对话（全程模型和用户都不操心存什么）
    ↓ session.idle 事件（opencode SSE /event）
sidecar.permission-watcher.ts（已订阅该 SSE）
    ↓ 捕获 session.idle
GET /session/:id/message（拉整段对话）
    ↓
POST http://memory-gateway/memories
Body: { messages: [...], user_id, agent_id }   ← ID 从 sidecar 的 AGENT_NAME + 实例 ownerId 注入
    ↓
gateway → Mem0 POST /memories
    ↓ Mem0 的 DeepSeek LLM 自动抽取事实
    ↓ 向量化（通义 embedding）
    ↓ 去重/合并（覆盖旧事实）
写入 pgvector
```

**实现位置**：`apps/sidecar/src/services/permission-watcher.ts` 已订阅 opencode `/event` SSE，在同一处加一个分支监听 `session.idle`：

```ts
// apps/sidecar/src/services/permission-watcher.ts（现有 SSE 订阅逻辑扩展）
// 已有：捕获 permission.asked 入队
// 新增：捕获 session.idle → 触发记忆抽取
if (event.type === 'session.idle') {
  const sessionId = event.properties.sessionID
  const messages = await opencodeClient.getMessages(sessionId)        // GET /session/:id/message
  await fetch(`${env.memoryGatewayUrl}/memories`, {
    method: 'POST',
    headers: {
      'X-Agent-Id': env.agentName,                                     // = groupId（K8s 注入）
      'X-User-Id': env.ownerId,                                        // = ownerId（K8s 注入，见下方说明）
      'Authorization': `Bearer ${env.memoryConsumerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),                                 // gateway 注入 user_id/agent_id
  })
}
```

**sidecar 需新增 env**（`apps/sidecar/src/env.ts`，由 K8s 注入）：

```ts
agentName: process.env.AGENT_NAME ?? '',              // = groupId（k8s.ts deployInstance 已注入）
ownerId: process.env.OWNER_ID ?? '',                  // = ownerId（k8s.ts 需新增 env 注入）
memoryGatewayUrl: process.env.MEMORY_GATEWAY_URL ?? '',
memoryConsumerKey: process.env.MEMORY_CONSUMER_KEY ?? '',
```

> **ownerId 注入**：`apps/server/src/services/k8s.ts` 的 `createVersionResources()` 给 sidecar 容器加一个 env `OWNER_ID: String(res.ownerId)`（label `opencode/owner` 已有，改成 env 即可）。

**gateway 新增 `/memories` 端点**（`apps/memory-gateway/src/index.ts`）：

```ts
// gateway 收到 sidecar 的对话抽取请求（非 MCP 协议，是普通 HTTP）
app.post('/memories', enforceIdentity, async (c) => {
  const ctx = c.get('ctx')                        // enforce-identity 注入（从 header 读 ID）
  const { messages } = await c.req.json()
  await memory.add(messages, { user_id: String(ctx.userId), agent_id: ctx.agentId })
  return c.json({ ok: true })
})
```

**方案 X 的权衡**：
- ✅ 记忆质量最高（Mem0 全套抽取/去重/合并）
- ✅ 模型零感知，不浪费 token 决定"要不要记"
- ✅ 用户透明
- ⚠️ 实时性下降：会话内的记忆要等 `session.idle` 才沉淀。**实际影响可忽略**——记忆主要用于跨会话的长期上下文，下次会话才用到

## 七、跨 agent 记忆访问流程（端到端）

```
① 管理员授权
   OMA 前端配置"用户 A 在 agent Y 可读 agent X 的记忆"
   → 写 memory_grants 行（grantee=A, source=ag-X, target=ag-Y）

② 重新 deploy agent Y（或热刷新）
   server 查 memory_grants WHERE grantee=A AND target=ag-Y → [ag-X]
   → 写进 opencode.json 的 mcp.memory.headers['X-Allowed-Cross-Agents'] = 'ag-X'

③ 用户 A 在 agent Y 对话
   模型调 memory_search("用户偏好")

④ gateway 收到
   header 有 X-Agent-Id=ag-Y, X-User-Id=A, X-Allowed-Cross-Agents=ag-X

⑤ gateway 查 Mem0
   分别查 (user=A, agent=ag-Y) 和 (user=A, agent=ag-X)
   合并去重返回

⑥ 模型只看到合并结果，不知道记忆来自哪个 agent
   —— 模型全程无法干预跨 agent 决策，也无法伪造 ID
```

## 八、分阶段实施与验证

### Phase 1（P0，核心机制）— 预计 2-3 天

1. **起 Mem0 OSS（docker compose）+ 配通义 embedding + DeepSeek 抽取**（验证 embedding/LLM 选型可跑）
2. 新建 `apps/memory-gateway`：骨架 + enforce-identity 中间件 + `memory_search` 工具 + mem0-client + `/memories` 端点
3. 建表：`0002_memory_grants.sql` migration + schema.ts 定义
4. `apps/server`：`injectMemoryMcp()` + env + 注入点（POST /deploy 和 PUT /:id）
5. **本地验证**（header 透传 + ID 强制注入 + 自动抽取）：
   - **A. header 透传验证**（卡点）：本地起一个 echo MCP server，配 opencode remote MCP 带 `X-Test: hello` header，确认 server 收到 header ✓（源码已证明透传，实测兜底）
   - **B. ID 强制验证**：curl 调 gateway，不带 header → 401；带正确 header → 通；伪造 body 里的 user_id（试图塞进 MCP 工具参数）→ 被忽略，仍用 header 值 ✓
   - **C. 自动抽取验证**：curl 模拟 sidecar POST `/memories` 带对话 → Mem0 写入；再调 `memory_search` → 检索到抽取的事实 ✓

### Phase 2（P0，部署集成）— 预计 1-2 天

6. `deploy/k8s/base/memory.yaml`：Mem0 OSS 三件套部署到 ACK（buildx amd64 + 推 ACR + imagePullSecret）
7. `deploy/k8s/base/memory-gateway-deployment.yaml` + kustomization 更新
8. Higress：`setupMemoryRoute()` + 创建 consumer，`MEMORY_CONSUMER_KEY` 写进 server Secret
9. **端到端**：经 OMA deploy 一个实例 → opencode 容器里看到 `mcp.memory` 配置 → 对话时模型能用 memory_search → 会话结束后 sidecar 自动抽取到 Mem0

### Phase 3（P1，跨 agent + 管理端）— 预计 2-3 天

10. `memory-grants` API（CRUD + admin 白名单）
11. deploy/PUT 时查 grants 并注入 `X-Allowed-Cross-Agents`
12. gateway 的 memory_search 合并逻辑
13. 前端授权管理页
14. 端到端验证跨 agent 读

## 九、风险与待确认

1. **~~Mem0 OSS 嵌入模型~~（已验证）**：✅ 选型确定——**通义 `text-embedding-v3`** 走 OpenAI 兼容 endpoint（`dashscope.aliyuncs.com/compatible-mode/v1`），经 Higress。DeepSeek 无 embedding 接口，但可直接做 Mem0 的 LLM 抽取 provider（TS SDK 原生支持 `deepseek`）。备选：本地 Ollama bge-m3（完全离线）。
2. **Mem0 OSS REST API 精确字段**：计划里的 `/search`、`/memories` body shape 基于文档概览，实现时需对照 Mem0 官方 REST API 文档逐字段对齐（特别是 `user_id`/`agent_id` 是 string 还是 int——Mem0 用 string，gateway 要 `String(ownerId)` 转换）。
3. **管理员识别**：项目当前 JWT 无 role 字段（`apps/server/src/lib/jwt.ts` 的 `JwtPayload` 只有 `sub` + `username`）。Phase 3 的授权 API 需要管理员校验，先用 `ADMIN_USER_IDS` env 白名单（最快），后续可给 JWT 加 role。
4. **授权变更的生效方式**：静态授权下，改 grants 后需重新 deploy 目标 agent 才更新 header。若需实时生效，Phase 3 可加"热刷新 ConfigMap"接口（不重建 Pod，只改 ConfigMap + 让 opencode 重载——但 opencode 是否支持配置热重载需验证，可能仍需 restart）。
5. **资源消耗**：Neo4j 是 Java 应用，内存 ≥1.5Gi（参考 Nacos）。ACK 测试环境 2 节点需确认资源余量。**可先不部署 Neo4j，只用 Postgres/pgvector**（Mem0 支持纯向量模式，图谱可选）。
6. **~~MCP transport 协议~~（已验证）**：✅ opencode 1.15.x 的 remote MCP 用 StreamableHTTP（SSE fallback），header 透传**源码级确认**（见 2.1 节与附录 A）。gateway 用 `@modelcontextprotocol/sdk` 的 `StreamableHTTPServerTransport` 实现即可，两种 transport 都会带自定义 header。
7. **`session.idle` 事件可靠性**：sidecar 自动抽取依赖 opencode 的 `session.idle` SSE 事件。该事件类型在 opencode SDK 类型定义中存在，社区有使用示例，但 1.14.42+ 曾有 SSE 不转发事件的 bug（issue #27966）。需在目标 opencode 版本（1.15.13）实测确认事件能正常推送。退路：改用轮询 `GET /session` 检查会话状态。

## 十、关键文件清单（实现时按此索引）

| 用途 | 路径 |
|------|------|
| 注入点（POST /deploy） | `apps/server/src/routes/instances.ts:89-97` |
| 注入点（PUT /:id） | `apps/server/src/routes/instances.ts:175,197` |
| Higress 重写参考 | `apps/server/src/routes/instances.ts:32-67` |
| MCP 类型（headers 结构） | `packages/shared/src/types/index.ts:121-139` |
| MCP 配置 schema（headers 字段定义） | `references/mcp.md:42-64` |
| Higress 普通 HTTP route 模板 | `apps/server/src/routes/mcp-servers.ts:48-83` |
| Higress 封装（login/fetch/genKey） | `apps/server/src/services/higress.ts:14-54` |
| Dockerfile 多阶段样板 | `apps/sidecar/Dockerfile` |
| Hono app 入口样板 | `apps/sidecar/src/index.ts` |
| env.ts 样板 | `apps/sidecar/src/env.ts` |
| **sidecar 会话事件订阅（自动抽取改造点）** | `apps/sidecar/src/services/permission-watcher.ts` |
| **sidecar env 注入点（需加 OWNER_ID）** | `apps/server/src/services/k8s.ts:339-356` |
| migration 幂等风格 | `apps/server/src/db/migrations/0001_instance_versioning.sql` |
| schema.ts 表定义样板 | `apps/server/src/db/schema.ts:134-149`（audit_logs） |
| K8s Deployment 样板 | `deploy/k8s/base/server-deployment.yaml` |
| 镜像代理（拉公共镜像） | `niddmerfwaxuyqg5mh.xuanyuan.run`（docker.io 代理） |

## 十一、参考资料

- [Mem0 官方仓库](https://github.com/mem0ai/mem0)
- [Mem0 OSS 配置文档](https://docs.mem0.ai/open-source/configuration)
- [Mem0 REST API 文档](https://docs.mem0.ai/open-source/features/rest-api)
- [Mem0 自托管 Docker 指南](https://mem0.ai/blog/self-host-mem0-docker)
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Agent memory: Letta vs Mem0 vs Zep vs Cognee](https://forum.letta.com/t/agent-memory-letta-vs-mem0-vs-zep-vs-cognee/88)
- [Mem0 论文（arXiv 2025）](https://arxiv.org/abs/2504.19413)

## 附录 A：opencode remote MCP header 透传证据链

> 本方案成立的核心前提是"opencode 把 `mcp.<name>.headers` 透传给远端 MCP server"。
> 以下为源码级证据链，2026-07-07 验证。验证版本：opencode-ai 1.15.12（本地）/ 1.15.13（容器）。

### A.1 验证方法

opencode-ai 是 **bun-compiled 单文件可执行**（108MB Mach-O），内部用 bun 的 `bunfs` 嵌入完整 TS/JS 源码（基于 Effect-TS 框架）。变量名被混淆（如 `S1`、`$2`、`H$`），但逻辑完整可读。

定位手段：从二进制 `strings` 抽取关键字符串（如 `"StreamableHTTPClientTransport already started!"`），反查其所属 class，再顺藤摸到调用点。

### A.2 证据链

#### 证据 1：配置 schema 字段名是 `headers`（官方文档）

`references/mcp.md:42-64`：
```jsonc
"jira": {
  "type": "remote",
  "url": "https://jira.example.com/mcp",
  "headers": { "Authorization": "Bearer {env:JIRA_TOKEN}" }
}
```
字段表（`mcp.md:62`）：`headers` = "Custom HTTP headers"。`{env:VAR}` 支持环境变量替换。

#### 证据 2：`MCP.connectRemote` 读 headers 注入 transport（反编译源码）

```js
J = B.fn("MCP.connectRemote")(function*(K, H) {  // K=server name, H=config object
  let A = H.oauth === false,
      b = typeof H.oauth === "object" ? H.oauth : void 0,
      k = C3(K, H.url);
  let U;  // authProvider (OAuth)，仅当未禁用
  if (!A) U = new h1(K, H.url, { clientId: b?.clientId, ... });

  // *** 核心证据：headers 注入两种 transport ***
  let E = [
    { name: "StreamableHTTP",
      transport: new S1(k, { authProvider: U,
        requestInit: H.headers ? { headers: H.headers } : void 0 }) },
    { name: "SSE",
      transport: new $2(k, { authProvider: U,
        requestInit: H.headers ? { headers: H.headers } : void 0 }) }
  ];
});
```

- `S1` = `StreamableHTTPClientTransport`（从错误字符串 `"StreamableHTTPClientTransport already started!"` 反查确认）
- `$2` = `SSEClientTransport`（同法确认）
- `H.headers` 来自配置对象，被装进 `requestInit.headers`

#### 证据 3：每个请求都合并 headers（不是只 connect 时用一次）

`StreamableHTTPClientTransport._commonHeaders()`：
```js
async _commonHeaders() {
  let Z = {};  // 内建 headers
  if (this._authProvider) {
    let X = await this._authProvider.tokens();
    if (X) Z.Authorization = `Bearer ${X.access_token}`;
  }
  if (this._sessionId) Z["mcp-session-id"] = this._sessionId;
  if (this._protocolVersion) Z["mcp-protocol-version"] = this._protocolVersion;
  let $ = H$(this._requestInit?.headers);  // 用户配置的 headers（归一化为 plain object）
  return new Headers({ ...Z, ...$ });      // 用户 headers 最后展开（可覆盖内建）
}

function H$(Z) {  // headers 归一化辅助函数
  if (!Z) return {};
  if (Z instanceof Headers) return Object.fromEntries(Z.entries());
  if (Array.isArray(Z)) return Object.fromEntries(Z);
  return { ...Z };
}
```

#### 证据 4：POST 请求实际构造

`StreamableHTTPClientTransport.send`：
```js
let Y = await this._commonHeaders();
Y.set("content-type", "application/json");
Y.set("accept", "application/json, text/event-stream");
let J = { ...this._requestInit, method: "POST", headers: Y, body: JSON.stringify(Z), signal };
let D = await (this._fetch ?? fetch)(this._url, J);
```

### A.3 结论

| 验证项 | 结果 |
|--------|------|
| headers 字段被 opencode 读取 | ✅ `MCP.connectRemote` 直接读 `H.headers` |
| 注入到 transport | ✅ 装进 `requestInit.headers`，传给 HTTP 和 SSE 两种 |
| 每请求都带（非一次性） | ✅ `_commonHeaders()` 每次 POST/DELETE 都调用 |
| 用户可覆盖内建 header | ✅ `new Headers({...内建, ...用户})` 用户在后，优先级高 |
| HTTP + SSE 都透传 | ✅ 两种 transport 共用 `requestInit` |
| 支持 `{env:VAR}` | ✅ 官方文档 + 二进制大量 `{env:` 字符串 |

**方案核心前提成立，无需实测兜底**。建议 Phase 1 仍加一个最小 echo MCP server 实测（半天工作量），作为保险——但属于"确认而非探路"。
