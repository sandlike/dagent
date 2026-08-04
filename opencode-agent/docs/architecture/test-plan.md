# OMA 平台测试方案

> 本文件描述各功能的端到端测试步骤，用于浏览器验证。

## 前置准备

### 启动 port-forward（一次全部启动）
【全部可以启动没有问题】
```bash
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
pkill -f "kubectl port-forward" 2>/dev/null; sleep 2

kubectl port-forward -n opencode-platform-test svc/opencode-web    8088:80   &
kubectl port-forward -n opencode-platform-test svc/opencode-server 3001:3000 &
kubectl port-forward -n higress-system    svc/higress-console    8090:8080  &
kubectl port-forward -n higress-system    svc/higress-gateway    8091:80    &
kubectl port-forward -n nacos-system      svc/nacos             8848:8848  &
kubectl port-forward -n nacos-system      svc/nacos             8082:8080  &
kubectl port-forward -n monitoring        svc/prometheus        9090:9090  &
kubectl port-forward -n monitoring        svc/grafana           3000:3000  &
```

### 访问地址

| 服务 | 地址 | 凭据 |
|------|------|------|
| OMA 前端 | http://localhost:8088 | acktest / test123456 |
| OMA 后端 API | http://localhost:3001 | Bearer token |
| Higress Console | http://localhost:8090 | admin / admin |
| Higress Gateway | http://localhost:8091 | — |
| Nacos Console | http://localhost:8082 | —（鉴权关闭） |
| Nacos API | http://localhost:8848 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | admin / admin |

---

## 测试 1：LLM 管理（Higress 密钥代理）【测试通过】

### 步骤
1. 登录后，点左侧「LLM 管理」
2. 应看到已配的 DeepSeek provider（状态 active）
3. 点「添加 Provider」→ 填名称/选 DeepSeek/填 API Key → 创建. 
4. 在 Higress Console 验证：`curl http://localhost:8090/v1/ai/providers`（需先登录拿 cookie） 【前端页面可以看到】

### 预期
- ✅ 列表显示 provider（名称 + 类型 + 真实 URL + 模型列表） 满足
- ✅ 创建后 Higress 里自动注册 Provider + Consumer + Route
- ✅ 删除后 Higress 资源级联清理

20260704 20:05 
【已解决】模型管理：Provider 创建时可自定义模型列表（chips 输入），列表页支持编辑模型 + 测试连接按钮（调 Higress gateway /v1/models 或最小 chat completions 探测，显示延迟/模型列表/错误）。
【已解决】前端浏览器 tab 名已改为「OMA · OhMyAgent」。


---

## 测试 2：新建实例（走 Higress）【测试通过】

### 步骤
1. 点左侧「Agent 管理」→「新建实例」
2. Step 1：填实例名、选 Agent 类型（OpenCode）
3. Step 2：从下拉选已配的 LLM Provider（不填 key）→ 选模型
4. Step 3：权限策略选「全部允许」
5. Step 4：跳过 MCP/Skill
6. 点「一键部署」
7. 回到实例列表，等待状态变为「运行中」

### 预期
- ✅ Step 2 不需要填 API Key（从已配 provider 选）
- ✅ 部署后实例状态 = running
- ✅ K8s 里 Pod 2/2 Running
- ✅ opencode.json 里 baseURL 指向 Higress gateway，apiKey 是 OMA key

20260704 20:05 
【已解决】实例标识改为 UUID：用户填「展示名」（必填），系统生成短 UUID（如 ag-7f3k2x）作为 K8s 资源名 group_id。列表/详情展示 displayName。详见下方「Agent 版本管理」。


---

## 测试 3：对话（A2A 协议）【测试通过】

### 步骤
1. 点进实例 →「对话」Tab
2. 点「新建会话」
3. 输入 `你好，请用一句话介绍自己` → 回车发送
4. 等待回复

### 预期
- ✅ 用户消息立即显示在右侧（蓝色气泡）
- ✅ Assistant 回复逐字/增量显示在左侧（灰色气泡）
- ✅ 如果 Agent 调了工具（如 bash/read），中间显示可折叠的 tool call 卡片
- ✅ 回复内容来自 DeepSeek（真实 LLM 回复）

### 验证调用链
```bash
# 确认走的是 A2A 端点（不是直接调 opencode）
# 在浏览器 DevTools Network 里看请求：
# POST /api/instances/:id/a2a/message → 200
```
20260704 
测试不通过，发送你好之后，没有反馈，点击创建新会话，不能发送。刷新之后进入之后，会话列表进入无信息
更新：可通过，问题已经解决

20260704 20：08
【已解决】实例详情页改为二级横向 tab 布局：顶栏含「← 返回」按钮 + 展示名 + 版本号 + 状态 Badge，下方横向 tab「对话 | Skills | 监控 | 设置」。

---

## 测试 4：审批交互（Human-in-the-Loop）

### 前置
需要一个权限设为 `ask` 的实例。

### 步骤
1. 新建实例时，Step 3 权限策略选「自定义」→ 把 `bash` 设为 `ask`
2. 部署实例
3. 进入对话，发消息让 Agent 执行 bash 命令（如 `帮我执行 ls -la`）
4. Agent 执行 bash 时应弹出审批卡片

### 预期
- ✅ Agent 执行 bash 前弹出 PermissionPrompt（工具名 + 命令内容）
- ✅ 点「允许」→ Agent 继续执行
- ✅ 点「拒绝」→ Agent 停止该操作

20260704 20：02  测试不通过（旧）
- 帮我执行 ls -la
- (no response)

【已解决 2026-07-04】审批链路彻底重做并 ACK 实测验证通过。
根因（3 层缺陷）：
1. 同步 `POST /session/:id/message` + bash=ask = 死锁（opencode 等 permission，HTTP 永久阻塞）
2. sidecar 用了 `/tui/control/*` —— TUI 客户端专用端点，headless `opencode serve` 不派发
3. control-next 不带 sessionId + respond body 格式错

修复（基于 ACK 实测确认的 opencode 1.15.x 协议）：
- **消息发送改异步**：`returnImmediately=true` + `prompt_async`，立即返回 WORKING，回复通过 SSE 增量
- **permission 事件**：opencode 通过 `/event` SSE 派发 `type:"permission.asked"` 事件，数据在 `properties` 字段：
  - `properties.id` = permissionID（裁决用）
  - `properties.sessionID` = 会话（注意大写 ID）
  - `properties.permission` = 工具名（如 "bash"）
  - `properties.patterns` = 要审批的命令（如 ["ls -la"]）
- **裁决端点**：`POST /session/:sessionId/permissions/:permissionID`，body `{ response: "once"|"always"|"reject" }`
  - `once` = 允许一次（前端 allow + 不勾选记住）
  - `always` = 始终允许（前端 allow + 勾选记住）
  - `reject` = 拒绝（前端 deny）
- **sidecar permission-watcher**：后台订阅 opencode `/event`，捕获 permission.asked 缓存到内存队列
- **A2A 桥接**：`control-next?sessionId=` 出队，`/tasks/respond` 转 opencode 枚举

实测验证（my-opencode, bash=ask, 有效 key）：
1. 异步发 "list files using ls" → WORKING ✅
2. 8 秒后 control-next → `{type:permission, tool:bash, input:ls, permissionId:per_...}` ✅
3. respond allow → `{ok:true, data:true}` ✅
4. opencode pending 队列清空，agent 继续执行 ✅

【已解决】版本管理：编辑配置/改权限不再创建新实例。改为同 group 多版本（v1/v2/...），复用 PVC，Service 名稳定切 selector。详见下方「Agent 版本管理」。allow↔ask 等权限修改通过部署新版本生效（opencode.json 不热加载）。

---

## Agent 版本管理（2026-07-04 新增）

### 模型
一个逻辑实例 = 一个 `group_id`（稳定短 UUID），可有多个版本 v1/v2/v3...
- 同时只有一个版本在跑（PVC 是 RWO，强制约束）
- 部署/回滚 = scale 旧版本到 0（释放 PVC）→ 起目标版本 → patch Service selector

### K8s 资源命名
| 资源 | 名字 | 共享方式 |
|---|---|---|
| ConfigMap / Secret / Deployment | `${group_id}-v${n}[-{config\|secret}]` | 每版本独立 |
| PVC | `${group_id}-pvc` | 同 group 复用（跨版本保留数据） |
| Service | `${group_id}` | 稳定名，切版本改 selector |

### API
- `POST /instances/deploy` — 首次部署（v1），入参用 `displayName`（必填），系统生成 group_id
- `PUT /instances/:id` — 更新配置 = 部署新版本（version+1），旧版本 is_active=0
- `GET /instances/:id/versions` — 列同 group 所有版本
- `POST /instances/:id/rollback` — body `{versionNum}`，回滚
- `DELETE /instances/:id` — 删整个 group + PVC
- `GET /instances` — 只返回 is_active=1

### 切版本中断
PVC 复用 + RWO 约束 → 切版本有数秒中断（scale down 旧版本等 Pod 终止 → 起新版本）。




---

## 测试 5：Skill 上传

### 步骤
1. 点进实例 →「Skills」Tab
2. 点上传 → 选择 `weather-query.zip`（项目根目录下）
3. 等待上传完成
4. 应在列表中看到 `weather-query` skill

### 预期
- ✅ 上传成功后列表显示 skill（名称 + 描述）
- ✅ 在 Pod 里验证文件存在：`kubectl exec ... ls /home/opencode/.config/opencode/skills/`
- ✅ opencode 能发现该 skill（Agent 在对话中可调用）




---

## 测试 6：MCP 管理

### 步骤
1. 点左侧「MCP 管理」
2. 点「添加 MCP Server」→ 填名称/选 Remote/填 URL → 创建
3. 查看列表

### 预期
- ✅ 列表显示 MCP Server（名称 + 类型 + URL + 「走 Higress 网关代理」标记）
- ✅ Remote 类型自动注册到 Higress
- ✅ 列表删除正常

---

## 测试 7：A2A Agent Card

### 步骤
```bash
# 直接 curl agent card
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
POD=$(kubectl get pod -n opencode-instances-test -l 'opencode/instance=a2a-demo' -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n opencode-instances-test pod/$POD -c monitor-sidecar -- wget -qO- http://localhost:8080/.well-known/agent.json | python3 -m json.tool
```

### 预期
- ✅ 返回标准 A2A Agent Card（name/description/version/skills/url）
- ✅ skills 数组包含 agent 能力列表（build/plan 等）

---

## 测试 8：监控（Prometheus + Grafana）

### 步骤
```bash
# Prometheus targets
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
# 浏览器打开 http://localhost:9090/targets

# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000 &
# 浏览器打开 http://localhost:3000（admin/admin）
```

### 预期
- ✅ Prometheus targets 里 `oma-sidecar` 和 `oma-server` 都是 UP
- ✅ Grafana 能查到 `http_requests_total` 指标
- ✅ 发几条对话后，请求计数增加

---

## 测试 9：A2UI 结构化 UI

### 前置
Agent 需要配置 A2UI 输出提示词（见 `docs/architecture/a2ui-agent-prompt.md`）。

### 步骤
1. 把 A2UI 提示词配到实例的 skill 或 instructions 里
2. 对话中请求结构化输出，如 `用卡片格式展示北京今天的天气信息`
3. Agent 输出 A2UI JSON 代码块

### 预期
- ✅ Agent 回复包含 ` ```a2ui-json ` 代码块
- ✅ 前端自动检测并渲染为结构化 UI（不是纯文本）
- ✅ 纯文本回复仍正常显示（向下兼容）

---

## 测试 10：Nacos Agent 注册

### 步骤
```bash
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
# 查 Nacos 服务列表
kubectl exec -n nacos-system deploy/nacos -- curl -s "http://localhost:8848/nacos/v3/admin/ns/service/list?pageNo=1&pageSize=20" | python3 -m json.tool
```

### 预期
- ✅ 服务列表包含 `oma-agent--a2a-demo`（或对应实例名）
- ✅ sidecar 启动日志有 `✅ Agent registered to Nacos`
