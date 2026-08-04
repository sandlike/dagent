# OMA 配置流向

> 最后更新：2026-07-04

## Phase 0（当前）：直连模式

```
用户在前端向导直接配置 LLM key / MCP URL / Skill zip
                    │
                    ▼
generateConfig() 生成 opencode.json
  - provider.apiKey → {env:DEEPSEEK_API_KEY} 占位符
  - mcp.xxx.url → 用户填的原始 URL
  - skills → 手动上传到 sidecar PVC
                    │
                    ▼
部署到 K8s：ConfigMap（opencode.json）+ Secret（env）
                    │
                    ▼
opencode 容器读 opencode.json + 环境变量
  - 直连 LLM API（如 https://api.deepseek.com/v1）
  - 直连 MCP server（用户填的 URL）
```

### 已知问题
- apiKey 明文转占位符后，明文未随部署请求到后端，没进 Secret（Phase 1 修复）
- MCP 直连，无统一网关（Phase 5 修复）
- Skill 手动上传，不跨实例共享（Phase 3 修复）

## Phase 1+（目标）：Higress 代理模式

```
① 用户在前端配置 LLM（如 DeepSeek）
  → OMA 后端调 Higress admin API：注册 LLM 代理路由 + 存真实 key（消费者认证）
  → Higress 返回一个 OMA 签发的消费者 key（如 oma-llm-xxxxx）

② 用户在前端配置 MCP remote service
  → OMA 后端调 Higress admin API：注册 MCP 代理路由 + 存真实 token
  → 同时调 Nacos API：注册 MCP 元信息到 MCP Registry

③ 用户在前端配置 Skill
  → OMA 后端调 Nacos API：注册到 Skill Registry（内容 + 元信息 + 版本）

④ 创建实例时
  → OMA 后端生成 opencode.json：
      provider.baseURL = https://higress-llm-gateway/llm/deepseek  （Higress 地址）
      provider.apiKey = {env:OMA_LLM_KEY}  （OMA 签发的消费者 key）
      mcp.xxx.url = https://higress-mcp-gateway/mcp/xxx  （Higress 地址）
  → sidecar 从 Nacos Skill Registry 拉选定的 Skill 到本地 PVC
  → sidecar 启动后把 A2A agent card 注册到 Nacos Agent Registry
```

### 收益
- opencode **只看到 Higress 地址 + OMA key**，真实凭据不进 Pod
- 换 key / 吊销 / 审计，全在 Higress 层操作，不用改 opencode 配置
- MCP / LLM 统一限流计费，Higress 层可观测

## 配置存储位置对照

| 配置项 | Phase 0 | Phase 1+ |
|--------|---------|----------|
| LLM API key | 前端 store（丢失风险） | Higress 消费者认证 |
| MCP token | opencode.json 明文 | Higress 消费者认证 |
| Skill 内容 | 实例 PVC（不共享） | Nacos Skill Registry |
| opencode.json | ConfigMap | ConfigMap（内容指向 Higress） |
| OMA 消费者 key | N/A | K8s Secret → opencode env |
| Agent 元信息 | K8s labels | Nacos Agent Registry（A2A） |
