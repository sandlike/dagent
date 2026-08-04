# Mem0 本地验证环境

> 配套文档：[docs/architecture/memory-store.md](../../docs/architecture/memory-store.md)

Phase 1 本地验证用，跑通「Mem0 记忆写入 + 按 `user_id`/`agent_id` 精确隔离检索」的最小闭环。

## 架构

```
docker compose up -d
  ├─ postgres (pgvector:pg16, 8432)
  │   ├─ mem0_app 库（应用元数据）
  │   └─ mem0 库（向量数据，memories 表）
  └─ mem0-api (REST server, 8888)
      ├─ LLM：DeepSeek（事实抽取）
      └─ Embedder：通义 text-embedding-v3（向量化）
```

**不含**：
- memory-gateway（Node 服务，本地用 `pnpm --filter @opencode/memory-gateway dev` 跑，调本 compose 起的 Mem0）
- Neo4j（P1/P2 用不上图谱）

## 前置依赖

1. **DeepSeek API key**：项目 `.env` 里已有，事实抽取用
2. **通义 DashScope API key**：[阿里云控制台](https://dashscope.console.aliyun.com/) → API-KEY 管理
   - 新用户有免费额度，足够本地验证
   - 走 OpenAI 兼容模式：`https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 模型：`text-embedding-v3`（1024 维）

## 使用

### 1. 配 .env

```bash
cd deploy/memory-local
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 和 TONGYI_API_KEY
```

### 2. 起服务

```bash
docker compose up -d --build
```

首次构建较慢（clone mem0 源码 + pip 装依赖，约 3-5 分钟）。后续启动秒级。

查看日志：
```bash
docker compose logs -f mem0   # 看 Mem0 API 启动情况
docker compose logs -f postgres
```

健康检查：
```bash
curl http://localhost:8888/health
# {"status":"healthy",...}
```

### 3. 跑验证

```bash
./verify.sh
```

预期输出：
```
[1/5] 健康检查                              ✓
[2/5] 写入记忆（user=u1, agent=ag-001）     ✓
[3/5] 检索记忆（应该能查到张三的技能）       ✓
[4/5] 跨 user 隔离（u2 查不到 u1）          ✓
[5/5] 跨 agent 隔离（ag-002 查不到 ag-001） ✓
通过: 5    失败: 0
```

**5 项全过 = Mem0 的三轴隔离（user_id × agent_id）可用**，可以进 Phase 1 的 gateway 开发了。

### 4. 手动试用

```bash
# 写入一段对话，Mem0 自动抽取事实
curl -X POST http://localhost:8888/memories/ \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"user","content":"我喜欢用 Rust 写系统工具"}
    ],
    "user_id":"u1","agent_id":"ag-001"
  }'

# 检索
curl -X POST http://localhost:8888/search/ \
  -H "Content-Type: application/json" \
  -d '{"query":"技术栈","user_id":"u1","agent_id":"ag-001"}'

# 列出该用户所有记忆
curl "http://localhost:8888/memories/?user_id=u1&agent_id=ag-001"
```

### 5. 清理

```bash
docker compose down -v   # -v 删数据卷，彻底重来
```

## 常见问题

### Q: `docker compose up` 卡在 build mem0

首次构建要 clone GitHub 源码 + pip 装依赖。如果网络慢：
- Dockerfile 已配清华 pip 源
- git clone 走的是 GitHub 直连，如果拉不动，手动 `git clone https://github.com/mem0ai/mem0.git` 后把 `server/` 目录拷到 `deploy/memory-local/mem0-server/repo/`，改 Dockerfile 用本地源码

### Q: Mem0 启动报 `alembic upgrade head` 失败

alembic 要连 `mem0_app` 库做 migration。检查：
- `init-db.sh` 是否执行了（看 postgres 容器日志有没有 `creating databases`）
- 环境变量 `PG_PASSWORD` / `POSTGRES_PASSWORD` 是否一致

### Q: 写入记忆后 search 查不到

Mem0 的事实抽取是**异步**的（调 DeepSeek）。`verify.sh` 里已经 sleep 3 秒，如果 DeepSeek 响应慢可能要更久。手动验证时多等几秒再 search。

### Q: embedding 报 401

通义 DashScope key 无效或没开通 text-embedding-v3 服务。去[控制台](https://dashscope.console.aliyun.com/)确认：
1. API-KEY 没过期
2. 已开通"向量检索/向量化"服务（默认新用户开通）

### Q: 想换成本地 embedding（不想用通义）

需要重新 patch——mem0 SDK 的 `ollama` embedder provider 读 `openai_base_url` 不同的字段（`ollama_base_url`）。
改 `mem0-server/patch_config.py` 的 embedder 段：
```python
"openai_base_url": ...  # 改成
"ollama_base_url": os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434"),
```
并把 provider 从 `openai` 改成 `ollama`，model 改 `bge-m3`，去掉 `embedding_dims`（ollama provider 自动检测）。
本机起 ollama：`ollama pull bge-m3 && ollama serve`，然后 `docker compose build mem0 && docker compose up -d`。

## 实现细节（给后续维护者）

### Mem0 配置是怎么注入的

Mem0 server 启动时读 `main.py` 里的 `DEFAULT_CONFIG`（硬编码走 OpenAI）。国内环境用不了 OpenAI，
本方案在 **Dockerfile 构建阶段用 `patch_config.py` 源码注入** DeepSeek/通义的 base_url：

```
Dockerfile builder 阶段：
  COPY patch_config.py
  RUN python patch_config.py main.py    # 精确替换 llm/embedder 配置段
```

patch 后的 llm/embedder config：
- llm：provider=openai, model=deepseek-chat, openai_base_url=DeepSeek, api_key=$DEEPSEEK_API_KEY
- embedder：provider=openai, model=text-embedding-v3, openai_base_url=通义, api_key=$TONGYI_API_KEY, embedding_dims=1024

`openai_base_url` 是 mem0 SDK 的字段（见 `mem0/embeddings/openai.py`、`mem0/llms/openai.py`），
让 openai provider 走任意 OpenAI 兼容 endpoint。

> 也可以用运行时 `POST /configure` 动态改配置（会持久化到 mem0_app.settings 表），
> 但首次启动时 Memory 实例已经用错误配置初始化，不如源码 patch 干净。

### mem0 server 没有官方 Docker Hub 镜像

- `mem0/mem0-api-server`（Docker Hub）已 2025-09 停更，且**仅 arm64**
- ACK 是 amd64，必须从 [GitHub 源码](https://github.com/mem0ai/mem0/tree/main/server)构建
- 本方案 clone `v2.0.11` 的 `server/` 目录，用自带 `requirements.txt` 装依赖
- 官方 `requirements.txt` 用纯 `psycopg`（需 libpq 系统库），slim 镜像没有，**必须补装 `psycopg-binary`**

### mem0 server 路由（无尾斜杠）

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/memories` | 写入记忆（messages → 自动抽取事实） |
| POST | `/search` | 语义检索 |
| GET | `/memories` | 列出记忆（?user_id=&agent_id=） |
| GET | `/configure` | 查看当前配置 |
| GET | `/docs` | FastAPI Swagger 文档（兼做健康检查） |

**注意**：路径**无尾斜杠**（`/memories/` 会 404）。

## 下一步

- [ ] 开发 `apps/memory-gateway`（enforce-identity 中间件 + MCP server，只暴露 `memory_search`）
- [ ] 在 `apps/server` 加 `injectMemoryMcp()`，deploy 时把 gateway 注入 opencode 配置
- [ ] sidecar 监听 `session.idle`，会话结束自动 POST 对话到 gateway → Mem0
