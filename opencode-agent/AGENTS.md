# AGENTS.md — 项目交接与环境信息

> 本文件固化端到端验证（2026-07-03）的结论与所有环境信息，供后续开发/部署参考。
> 敏感凭据（密码/密钥）不写明文，标注实际存放位置。

## 8. 多环境部署体系（2026-07-03 搭建）

### 架构

4 个环境，渐进式部署链路：

```
本地开发（pnpm dev）
  → 阿里云 ACK 测试环境（前端+后端镜像部署到 K8s）
  → 公司 K8s 预发环境（从 ACR 同步镜像）
  → 公司 K8s 生产环境
```

镜像单向流转：本地 buildx (amd64) → 阿里云 ACR → 公司 registry（从 ACR 同步）

### 环境配置矩阵

| 维度 | 本地开发 | 阿里云 ACK（测试）| 公司 K8s（预发）| 公司 K8s（生产）|
|-----|---------|-----------------|---------------|---------------|
| **前端+后端** | 本地 pnpm dev | 部署到 ACK | 部署到公司 K8s | 部署到公司 K8s |
| **平台 namespace** | N/A | opencode-platform-test | opencode-platform-staging | opencode-platform-prod |
| **实例 namespace** | N/A | opencode-instances-test | opencode-instances-staging | opencode-instances-prod |
| **镜像 registry** | 不需要 | 阿里云 ACR | 公司 registry | 公司 registry |
| **数据库** | 腾讯云 MySQL agenthub | 腾讯云 MySQL agenthub_test | 独立 RDS agenthub_staging | 独立 RDS agenthub_prod |
| **域名/Ingress** | localhost:5173 | opencode-test.internal | opencode-staging.company.com | opencode.company.com |
| **副本数** | N/A | 1/1 | 1/1 | 2/2 |

> 本地和阿里云测试共用腾讯云 MySQL，靠库名隔离（agenthub / agenthub_test）

### 4 个镜像

| 镜像 | Dockerfile | 用途 |
|------|-----------|------|
| opencode | apps/opencode/Dockerfile | opencode 实例（npm opencode-ai） |
| opencode-sidecar | apps/sidecar/Dockerfile | 监控服务（Skill CRUD + 监控聚合） |
| opencode-server | apps/server/Dockerfile | 管理后端（Hono + MySQL + K8s） |
| opencode-web | apps/web/Dockerfile + nginx.conf | 前端（Vite build + nginx 托管 + /api 代理） |

构建命令：`make build`（amd64），`make push`（推 ACR）。详见 `Makefile`。

### K8s 部署清单（Kustomize）

```
deploy/k8s/
├── base/                    # 共享基础清单（server + web + ingress）
└── overlays/
    ├── ack-test/            # 阿里云测试环境（已验证）
    ├── staging/             # 公司预发（骨架，待公司集群信息）
    └── prod/                # 公司生产（骨架）
```

部署：
```bash
# 1. 建 namespace + Secret（首次）
kubectl create ns opencode-platform-test
kubectl create secret generic opencode-server-secret -n opencode-platform-test \
  --from-literal=MYSQL_HOST=... --from-literal=MYSQL_PASSWORD=... ...

# 2. 部署
kubectl apply -k deploy/k8s/overlays/ack-test
```

详见 `deploy/k8s/README.md`。

### ACK 测试环境部署验证（✅ 2026-07-03）

| 链路 | 结果 |
|---|---|
| opencode-web Pod (nginx) | ✅ 1/1 Running |
| opencode-server Pod (Hono) | ✅ 1/1 Running |
| 前端 HTML 托管 | ✅ HTTP 200 |
| nginx → 后端 /api/health 代理 | ✅ {"ok":true} |
| 用户注册（写 agenthub_test 库） | ✅ |
| 用户登录（JWT） | ✅ |

### 关键实现细节

1. **@opencode/shared 需编译**：package.json exports 已改为指向 dist/index.js。
   Dockerfile 里 builder 阶段先 `pnpm --filter @opencode/shared run build`，
   runner 阶段手动 COPY shared dist 到 node_modules（pnpm symlink 只拷了 package.json）。
   本地开发用 tsx 仍读源码（tsx 能直接跑 .ts）。

2. **nginx proxy_pass 用直接短名**（不用变量）：nginx 用 /etc/resolv.conf 解析，
   能利用 K8s search domain（svc.cluster.local）。
   initContainer（nslookup wait）保证后端 Service 就绪后再启动 nginx。

3. **镜像必须 buildx --platform linux/amd64**：ACK 节点是 amd64，Mac M 默认构建 arm64 会 `exec format error`。

4. **阿里云云盘最小 20Gi**：PVC_SIZE 默认 20Gi，STORAGE_CLASS_NAME 必须指定（集群无默认 SC）。

5. **imagePullSecret 需手动建**：ACR 免密插件未生效，每个 namespace 要手动建 acr-auth。

## 1. 项目架构概览

OpenCode 容器管理平台。配置 → 部署 → 对话 → 管理 OpenCode agent 实例。

```
opencode-agent/  (pnpm monorepo)
├── apps/
│   ├── web/          Vue 3 前端（Vite + Tailwind v4 + Pinia）:5173
│   ├── server/       管理后端（Hono + Drizzle + MySQL + JWT + K8s）:3000
│   ├── sidecar/      监控服务 sidecar（Hono：Skill CRUD + 监控聚合 + 审计）:8080
│   └── opencode/     opencode 实例镜像 Dockerfile（npm 装 opencode-ai）
├── packages/shared/  前后端共享类型 / 配置生成器 / 常量
├── .npmrc            npm/pnpm 国内镜像源（registry.npmmirror.com）
└── .dockerignore     Docker 构建上下文过滤
```

部署模型：**每实例 = 一个 Pod，内含 2 个独立容器**（opencode + sidecar），共享 PVC。
- opencode 容器：用官方 npm 包 `opencode-ai` 自建镜像（公司服务器拉不到 ghcr）
- sidecar 容器：自研监控服务镜像
- 两者通过共享 PVC（skills 子目录）通信，改 skill 文件即时生效

## 2. 镜像信息

### 2.1 opencode 实例镜像

| 项 | 值 |
|---|---|
| Dockerfile | `apps/opencode/Dockerfile` |
| 基础镜像 | `node:20-alpine` |
| 安装方式 | `npm install -g opencode-ai@<version>`（国内源 npmmirror） |
| 运行用户 | opencode（uid/gid=1500，非 root） |
| 配置目录 | `/home/opencode/.config/opencode/`（XDG 标准路径） |
| 数据目录 | `/home/opencode/.local/share/opencode/` |
| 端口 | 4096 |
| 启动命令 | `opencode serve --hostname 0.0.0.0 --port 4096` |

构建（本机 arm64 用 buildx 跨平台）：
```bash
# 默认 latest
docker buildx build --platform linux/amd64 -f apps/opencode/Dockerfile \
  -t <registry>/opencode:latest --load .

# 指定版本（对应 npm opencode-ai 的版本号）
docker buildx build --platform linux/amd64 -f apps/opencode/Dockerfile \
  --build-arg OPENCODE_VERSION=1.17.13 -t <registry>/opencode:1.17.13 --load .
```

### 2.2 sidecar 监控镜像

| 项 | 值 |
|---|---|
| Dockerfile | `apps/sidecar/Dockerfile` |
| 基础镜像 | `node:22-alpine`（pnpm 11 / lockfile v9 需 Node>=22） |
| 构建方式 | 多阶段：builder（tsc 编译）→ runner（仅 dist + prod 依赖） |
| 运行用户 | root（仅读 dist + 挂载的 PVC，无安全风险） |
| 端口 | 8080 |
| 启动命令 | `node apps/sidecar/dist/index.js` |

构建：
```bash
docker buildx build --platform linux/amd64 -f apps/sidecar/Dockerfile \
  -t <registry>/opencode-sidecar:latest --load .
```

### 2.3 镜像 Registry

| 项 | 值 |
|---|---|
| Registry 地址 | `registry.cn-hangzhou.aliyuncs.com` |
| Namespace | `citics_lwj` |
| 推送账号 | `lwjlwjlwj33712563`（密码见下） |
| 已推镜像 | `citics_lwj/opencode:latest`、`citics_lwj/opencode-sidecar:latest` |

推送：
```bash
REGISTRY="registry.cn-hangzhou.aliyuncs.com/citics_lwj"
docker push ${REGISTRY}/opencode:latest
docker push ${REGISTRY}/opencode-sidecar:latest
```

> **注意**：必须用 `docker buildx build --platform linux/amd64` 构建，因为 ACK 节点是 amd64，
> 本机（Mac M 芯片）默认构建 arm64 会架构不匹配。

## 3. K8s 集群信息（阿里云 ACK）

| 项 | 值 |
|---|---|
| 集群类型 | 阿里云 ACK（杭州 region） |
| API Server | `https://47.96.115.61:6443` |
| K8s 版本 | v1.36.1-aliyun.1 |
| 节点数 | 2（amd64，Alibaba Cloud Linux Lifsea 3） |
| 容器运行时 | containerd 2.1.6 |
| Kubeconfig | `/tmp/ack-kubeconfig.yaml`（临时；正式见下） |

### 3.1 连接方式

```bash
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
kubectl get nodes
```

### 3.1.1 port-forward 访问地址表

验证时一次全部启动：
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

| 服务 | 本地地址 | 集群内地址 | 凭据 |
|------|---------|-----------|------|
| OMA 前端 | http://localhost:8088 | opencode-web.opencode-platform-test.svc:80 | acktest / test123456 |
| OMA 后端 | http://localhost:3001 | opencode-server.opencode-platform-test.svc:3000 | Bearer token |
| Higress Console | http://localhost:8090 | higress-console.higress-system.svc:8080 | admin / admin |
| Higress Gateway | http://localhost:8091 | higress-gateway.higress-system.svc:80 | — |
| Nacos Console | http://localhost:8082 | nacos.nacos-system.svc:8080 | —（鉴权关闭） |
| Nacos API | http://localhost:8848 | nacos.nacos-system.svc:8848 | — |
| Prometheus | http://localhost:9090 | prometheus.monitoring.svc:9090 | — |
| Grafana | http://localhost:3000 | grafana.monitoring.svc:3000 | admin / admin |

### 3.1.2 ACK 集群 namespace 资源总览

| Namespace | 用途 | 关键 Pod |
|-----------|------|---------|
| `opencode-platform-test` | OMA 平台（前端+后端） | opencode-web / opencode-server |
| `opencode-instances-test` | Agent 实例（用户部署的） | 各实例 Pod（opencode + sidecar） |
| `higress-system` | API 网关 + 密钥保管箱 | higress-gateway / higress-console / higress-controller |
| `nacos-system` | 服务发现 + AI Registry | nacos |
| `monitoring` | 监控 | prometheus / grafana |

### 3.2 StorageClass

集群**无默认 StorageClass**，PVC 必须显式指定 `storageClassName`：
- `alicloud-disk-essd`（ESSD，推荐）
- `alicloud-disk-ssd`（SSD）
- `alicloud-disk-efficiency`（高效云盘）

> **注意**：阿里云云盘**最小 20Gi**，代码里 `k8s.ts` 写的 `512Mi` 会导致 PVC 一直 Pending。
> 后端 `apps/server/src/services/k8s.ts` 的 PVC 申请量需改成 ≥20Gi。

### 3.3 镜像拉取认证

ACK 的 ACR 免密插件（`acr-credential-secret-aggregation`）**未生效**——该 secret 内容为空 `{"auths":{}}`。
需手动在每个 namespace 创建 imagePullSecret 并挂到 ServiceAccount：

```bash
# 在目标 namespace 创建 secret（密码：见下方"敏感凭据"）
kubectl create secret docker-registry acr-auth \
  --docker-server=registry.cn-hangzhou.aliyuncs.com \
  --docker-username=lwjlwjlwj33712563 \
  --docker-password='<ACR_PASSWORD>' \
  -n <namespace>

# 挂到 default ServiceAccount
kubectl patch sa default -n <namespace> \
  -p '{"imagePullSecrets":[{"name":"acr-auth"}]}'
```

> **TODO**：后端 `k8s.ts` 的 `deployInstance()` 需要自动创建/引用 imagePullSecret，
> 否则经管理平台部署的实例会 ImagePullBackOff。

### 3.4 关于 Ingress + 域名

> 当前 ACK 集群**不安装 Ingress Controller**，通过 `kubectl port-forward` 访问。
> 这是**有意设计**——不开放公网访问，仅限管理员验证。**以后不用管 Ingress。**

### 3.5 验证用 namespace

`opencode-instances-test`：部署实例的 namespace（`INSTANCE_NAMESPACE` 环境变量决定）。

### 3.5 Higress 网关（密钥保管箱 + LLM 代理）

| 项 | 值 |
|---|---|
| 部署方式 | Helm chart（`higress.io/higress`）安装在 `higress-system` namespace |
| Console 地址 | `higress-console.higress-system.svc:8080`（集群内） |
| Gateway 地址 | `higress-gateway.higress-system.svc:80`（集群内数据面） |
| Gateway 公网 | `116.62.145.226` |
| 管理员 | `admin` / `admin`（Secret `higress-console` 里的 `adminUsername`/`adminPassword`） |
| Admin API | `/session/login`（POST，字段名 `username`/`password`，cookie 名 `_hi_sess`）|
| LLM Provider 管理 | `POST /v1/ai/providers`（type/tokens/protocol/rawConfigs.apiUrl）|
| AI 路由管理 | `POST /v1/ai/routes`（不设 domain 则匹配所有 host）|
| 消费者管理 | `POST /v1/consumers`（credentials: key-auth Bearer）|

> **关键**：Higress AI route 不设 `domains` 则匹配所有 host（agent 不需带特定 Host header）。
> Route name 必须全小写（K8s Ingress name 限制）。

### 3.6 Nacos 3.2（AI 资源控制平面）

| 项 | 值 |
|---|---|
| 部署方式 | K8s YAML（standalone 模式），安装在 `nacos-system` namespace |
| API 地址 | `nacos.nacos-system.svc:8848` |
| Console | `nacos.nacos-system.svc:8080`（Nacos 3.x console 独立端口） |
| 镜像 | `registry.cn-hangzhou.aliyuncs.com/citics_lwj/nacos-server:v3.2.0-amd64` |
| 鉴权 | 当前关闭（`NACOS_AUTH_ENABLE=false`），开发测试用 |
| 版本 | 3.2.0（支持 Agent Registry / MCP Registry / Skill Registry） |

> **注意**：Nacos 3.2 要求即使关闭鉴权也要设 `NACOS_AUTH_TOKEN`（Base64），否则启动崩溃。
> Health 端点路径从 v1 的 `/nacos/v1/console/health/readiness` 变为 v3 的 `/nacos/v3/admin/core/state`。
> 内存需求 ≥1.5Gi（Java 应用），limits 给 2Gi。

## 4. 数据库信息（腾讯云 MySQL）

| 项 | 值 |
|---|---|
| 类型 | 腾讯云 TDSQL-C MySQL（CynosDB） |
| Host | `sh-cynosdbmysql-grp-l9wk8j8e.sql.tencentcdb.com` |
| Port | `26471` |
| 库（本地开发） | `agenthub` |
| 库（ACK 测试环境） | `agenthub_test` |
| 库（预发） | `agenthub_staging`（待建） |
| 库（生产） | `agenthub_prod`（待建） |
| 用户 | `root` |
| 配置文件 | 项目根 `.env`（已在 .gitignore） |

> 本地和 ACK 测试共用腾讯云 MySQL，靠库名隔离（agenthub / agenthub_test）。

初始化：
```bash
pnpm --filter @opencode/server exec tsx src/db/init.ts    # 建库
# 若 drizzle-kit push 报 check_constraints（MySQL 5.x 兼容问题）：
pnpm --filter @opencode/server exec drizzle-kit generate
# 然后执行 src/db/migrations/*.sql
```

## 5. 敏感凭据（不写明文）

| 凭据 | 存放位置 | 说明 |
|---|---|---|
| MySQL 密码 | `.env` → `MYSQL_PASSWORD` | `cap@ctcs06030` |
| ACR 推送密码 | docker login 凭据 / macOS keychain | `liawenjie1997102`（用户 lwjlwjlwj33712563） |
| ACK kubeconfig | `/tmp/ack-kubeconfig.yaml` | 含 client-cert/key，集群管理员权限 |
| JWT 密钥 | `.env` → `JWT_SECRET` | 开发用默认值，生产需改 |

> 上述明文仅在本文件中记录一次供快速联调。**生产环境务必轮换**，并从本文件移除。

## 5.1 Docker / 镜像代理仓库

### 阿里云 ACR（本项目自建镜像 + 公共镜像 retag）

| 项 | 值 |
|---|---|
| Registry 地址 | `registry.cn-hangzhou.aliyuncs.com` |
| Namespace | `citics_lwj` |
| 推送账号 | `lwjlwjlwj33712563`（密码见上方凭据表） |
| 已推镜像 | opencode / opencode-sidecar / opencode-server / opencode-web / nacos-server / prometheus / grafana |

### Docker 镜像代理（拉取公共镜像用，解决 docker.io 被墙）

| 源仓库 | 代理地址 | 说明 |
|--------|---------|------|
| Docker Hub（docker.io） | `niddmerfwaxuyqg5mh.xuanyuan.run` | prometheus / grafana / nacos 等公共镜像 |
| GitHub（ghcr.io） | `niddmerfwaxuyqg5mh-ghcr.xuanyuan.run` | — |
| Kubernetes（registry.k8s.io） | `niddmerfwaxuyqg5mh-k8s.xuanyuan.run` | — |
| Quay.io | `niddmerfwaxuyqg5mh-quay.xuanyuan.run` | — |
| Google（gcr.io） | `niddmerfwaxuyqg5mh-gcr.xuanyuan.run` | — |

**用法**：通过代理拉取公共镜像 → retag 到阿里云 ACR → K8s 从 ACR 拉。
```bash
# 示例：拉 prometheus 并推到 ACR
PROXY="niddmerfwaxuyqg5mh.xuanyuan.run"
REGISTRY="registry.cn-hangzhou.aliyuncs.com/citics_lwj"
docker pull ${PROXY}/prom/prometheus:latest
# amd64 转换（本机 arm64 需用 buildx）
docker buildx build --platform linux/amd64 -t ${REGISTRY}/prometheus:latest --push - <<EOF
FROM ${PROXY}/prom/prometheus:latest
EOF
```

> **注意**：本机 Mac M 芯片默认拉 arm64，ACK 节点是 amd64。
> 必须用 `docker buildx build --platform linux/amd64` 转换，否则 `exec format error`。

## 5.2 Redis

> **当前项目未使用 Redis。** 所有状态存 MySQL（用户/实例/Provider/MCP/Skill/审计日志）。
> 后续如需缓存或会话管理可引入，配置如下预留：
> - `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` 环境变量
> - 建议用腾讯云 Redis（和 MySQL 同 region）

## 6. 本地开发

```bash
pnpm install
# 数据库（首次）
pnpm --filter @opencode/server exec tsx src/db/init.ts

# 连 ACK 集群部署（而非 Mock）
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
export IMAGE_REGISTRY=registry.cn-hangzhou.aliyuncs.com/citics_lwj
export SIDECAR_IMAGE=registry.cn-hangzhou.aliyuncs.com/citics_lwj/opencode-sidecar:latest

pnpm dev   # 前端:5173 + 后端:3000 + sidecar:8080
```

## 7. 端到端验证结论（2026-07-03）

### 第一阶段：镜像 + sidecar↔opencode（✅ 已验证）

| 链路 | 结果 |
|---|---|
| amd64 镜像构建（opencode + sidecar） | ✅ buildx 跨平台构建成功 |
| 镜像推送 ACR + ACK 拉取 | ✅ 需手动建 imagePullSecret（免密插件未生效） |
| opencode serve 启动 | ✅ 监听 4096，version 1.15.12 / 1.17.13 |
| sidecar 启动 + 健康检查 | ✅ /health 返回 200 |
| sidecar → opencode 同 Pod 通信 | ✅ OPENCODE_BASE=http://localhost:4096 |
| sidecar 监控聚合 (/monitor/health) | ✅ `{"healthy":true}` |
| sidecar 会话/Agent 聚合 | ✅ /monitor/sessions、/monitor/components 正常 |
| sidecar skill CRUD | ✅ /skills 返回 []（空列表正常） |
| PVC 共享（skills 目录） | ✅ fsGroup=1500 生效，两容器均读写正常 |
| 路径对齐（XDG ~/.config/opencode） | ✅ opencode 实际读 XDG 路径，非 /root/.opencode |

### 第二阶段：管理后端 → K8s → 实例（✅ 已验证）

| 链路 | 结果 |
|---|---|
| 后端 KUBECONFIG 连 ACK | ✅ k8sAvailable()=true |
| API POST /instances/deploy | ✅ 创建实例记录 + K8s 资源（status=running） |
| deployInstance() 自动创建 ConfigMap | ✅ |
| deployInstance() 自动创建 Secret（API key） | ✅ |
| deployInstance() 自动创建 PVC（20Gi ESSD） | ✅ Bound |
| deployInstance() 自动创建 imagePullSecret | ✅ `opencode-pull-secret`（用 IMAGE_PULL_* 凭据） |
| deployInstance() 自动创建 Deployment（双容器） | ✅ 2/2 Running |
| 后端代理 → opencode /health | ✅ `{"healthy":true,"version":"1.15.12"}` |
| 后端代理 → opencode /session | ✅ `[]` |
| 后端代理 → opencode /agent | ✅ 返回 build 等 agent |
| 后端代理 → opencode /mcp | ✅ `{}` |
| 后端代理 → opencode /provider | ✅ 返回 provider 列表 |

### 本地联调方式（后端不在集群内时）

后端默认用集群内 DNS（`name.namespace.svc:4096`）访问 opencode，本地后端解析不到。
需用 `kubectl port-forward` + 环境变量：

```bash
# 1. port-forward 实例 Pod
export KUBECONFIG=/tmp/ack-kubeconfig.yaml
POD=$(kubectl get pod -n <ns> -l 'opencode/instance=<name>' -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward -n <ns> pod/$POD 14096:4096 18080:8080

# 2. 后端设 OPENCODE_PROXY_BASE 指向转发端口
OPENCODE_PROXY_BASE=http://localhost:14096 pnpm --filter @opencode/server run dev
# （proxy.ts 的 sidecarBase 会从 OPENCODE_PROXY_BASE 推导 :8080）
```

### 已修复的问题（本次）

1. ~~`k8s.ts` PVC 申请量 512Mi~~ → 改为可配置（`PVC_SIZE`，默认 20Gi）
2. ~~`k8s.ts` 未创建 imagePullSecret~~ → 新增 `ensureImagePullSecret()`，用 IMAGE_PULL_* 自动创建
3. ~~`k8s.ts` 未指定 storageClassName~~ → 新增 `STORAGE_CLASS_NAME` 配置
4. ~~`k8s.ts` 未创建 Service~~ → deployInstance() 自动创建 ClusterIP Service（4096+8080），deleteInstance() 级联清理
5. **`versions/index.ts` 版本 1.7/1.5 在 npm 不存在**：用户选这些版本构建镜像会失败（未修，用户自知）

### 待验证（下一步）

- [x] ~~前端配置向导 → 部署 → 实例列表显示真实状态~~ ✅ 经 Vite(5173)→后端(3000)→ACK 链路验证通过
- [x] ~~前端 ChatView → 创建会话 → 发送消息~~ ✅ 会话创建成功，消息发送成功（DeepSeek 返回 401 因占位 key，链路本身通）
- [ ] 前端 MonitorView → 展示真实 health/agent/provider 数据（API 已通，需浏览器实测渲染）
- [ ] SSE 流式响应实测（当前用同步 message 接口）
- [ ] Skill zip 上传 → sidecar 写 PVC → opencode 即时发现
- [x] ~~用真实 DeepSeek API key 端到端对话~~ ✅ 模型 `deepseek-v4-flash` 真实回复成功（error:null，回复内容正确）
- [x] ~~**`k8s.ts` 未创建 Service**~~ ✅ 已补：deployInstance() 自动创建 ClusterIP Service（4096+8080），deleteInstance() 级联清理

### 第三阶段：前端全链路（✅ 已验证，2026-07-03）

经 Vite(5173) → 后端(3000) → port-forward → ACK Pod 完整路径验证：

| 链路 | 结果 |
|---|---|
| 登录获取 token | ✅ |
| GET /instances（实例列表） | ✅ 返回 running 实例 |
| GET /instances/:id（详情） | ✅ |
| GET /instances/:id/health | ✅ `{"healthy":true,"version":"1.15.12"}` |
| GET /instances/:id/agent | ✅ build agent |
| GET /instances/:id/skills | ✅ [] |
| POST /instances/:id/sessions（创建会话） | ✅ 返回 session id |
| POST /sessions/:sid/message（发消息） | ✅ opencode 转发到 DeepSeek（401 占位 key，链路通） |

> 对话链路证明：前端消息格式（`{parts:[{type:text,text}]}`）正确，opencode 正确解析转发，
> 响应结构（`info`+`parts`）正确返回。

### 第四阶段：真实 LLM 对话（✅ 已验证，2026-07-03）

用真实 DeepSeek API 凭据部署实例并对话：

| 配置项 | 值 |
|---|---|
| baseURL | `https://api.deepseek.com/v1` |
| 模型 | `deepseek-v4-flash` |
| Provider | openai-compatible（自定义 baseURL） |

验证：
- 创建会话 ✅
- 发送消息 "你好，请用一句话介绍你自己" → `error:null`，`model:deepseek-v4-flash` ✅
- 发送 "1+1等于几" → DeepSeek 回复 "2" ✅（含思考过程）

> **配置方式**：DeepSeek 自定义 baseURL 需用 `@ai-sdk/openai-compatible` provider，
> 不能用内置 deepseek provider（后者走 OAuth 不接受自定义 baseURL）。
> 详见 `references/providers.md` 的 Custom Provider 章节。

## 9. 第五阶段：版本管理 + 审批链路重做（✅ 2026-07-04）

### 9.1 Agent 版本管理

实例从「单条记录」改为「同 group 多版本」模型。解决用户反馈：编辑配置不应创建新实例。

**DB schema**（`instances` 表新增字段，migration `0001_instance_versioning.sql`）：
- `display_name` — 用户填的展示名（必填）
- `group_id` — 稳定短 UUID（如 `ag-7f3k2x`），同逻辑实例所有版本共用
- `version_num` — 版本号（1, 2, 3...）
- `is_active` — 当前活跃版本（同 group 同时只有一个为 1）

**K8s 资源命名**（`apps/server/src/services/k8s.ts`）：
- 版本化：ConfigMap/Secret/Deployment = `${group_id}-v${n}[-{config|secret}]`
- 稳定复用：PVC = `${group_id}-pvc`（同 group 跨版本共享）
- 稳定切 selector：Service = `${group_id}`（用 JSON patch replace 整个 selector）

**API**（`apps/server/src/routes/instances.ts`）：
- `POST /deploy` 入参改用 `displayName`，后端生成 `group_id`
- `PUT /:id` = 部署新版本（version+1，复用 PVC，scale down 旧版本，patch Service）
- `GET /:id/versions`、`POST /:id/rollback`、`DELETE /:id`（删整个 group + PVC）

**注意**：旧实例迁移后 `group_id = name`（兼容）。旧 Deployment 无 `opencode/group` label，迁移时需手动 scale down + 补 label。

### 9.2 审批链路（Human-in-the-Loop）

**ACK 实测确认的 opencode 1.15.x permission 协议**（关键！）：

| 维度 | 真实形态 |
|------|---------|
| 消息发送 | **必须异步**（`prompt_async` + `returnImmediately`）。同步 `/message` 遇 bash=ask 会永久阻塞 |
| permission 事件 | `/event` SSE 流，`type:"permission.asked"`，数据在 `properties` 字段（非 `data`） |
| permissionID | `properties.id`（如 `per_f2d2a36bf001...`） |
| sessionID | `properties.sessionID`（**大写 ID**） |
| 工具名 | `properties.permission`（如 `"bash"`） |
| 命令 | `properties.patterns`（数组，如 `["ls -la"]`） |
| 裁决端点 | `POST /session/:sessionId/permissions/:permissionID` |
| 裁决 body | `{ response: "once" \| "always" \| "reject" }`（**不是** allow/deny！） |
| pending 列表 | `GET /permission`（列出所有未裁决的） |

**❌ 之前的错误**（已修复）：
- 用了 `/tui/control/next`（TUI 专用，headless 不派发）
- 同步 `/message`（遇 ask 死锁）
- respond body 用 `{allowed: boolean}`（应为 `{response:"once"|"always"|"reject"}`）

**sidecar 实现**（`apps/sidecar/src/services/permission-watcher.ts`）：
- 后台订阅 opencode `/event` SSE，捕获 `permission.asked` 入内存队列（按 sessionID 索引）
- `a2a.ts` 的 `/tasks/control-next?sessionId=` 出队，`/tasks/respond` 把前端的 allow/deny 转成 opencode 的 once/always/reject
- ⚠️ 路由顺序：`/tasks/control-next` 必须在 `/tasks/:id` 之前注册（否则被参数路由捕获）

**前端**（`ChatView.vue`）：
- 发消息后立即启动 permission 控制循环（带 sessionId）
- SSE 解析用 `properties` 字段，识别 `permission.asked` / `message.part.updated` / `session.idle`
- `respond` 传 `{sessionId, permissionId, response:"allow"|"deny", remember}`

### 9.3 实例名改 UUID

用户不再填唯一标识（K8s 资源名），改填「展示名」（必填）。后端生成短 UUID（`ag-xxxxxx`）作 `group_id`，K8s 资源名基于 `group_id`。列表/详情展示 `displayName`。

### 9.4 实例详情页二级 tab

`InstanceLayout.vue` 自渲染顶栏（返回按钮 + displayName + 版本 + 状态）+ 横向 tab（对话/Skills/监控/设置），不再套 AppShell。
