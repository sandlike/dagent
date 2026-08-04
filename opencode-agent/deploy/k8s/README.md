# K8s 部署清单（Kustomize）

## 目录结构

```
deploy/k8s/
├── base/                          # 共享基础清单
│   ├── kustomization.yaml
│   ├── namespace.yaml             # 实例默认 namespace
│   ├── server-deployment.yaml     # 管理后端 Deployment + Service + ConfigMap
│   └── web-deployment.yaml        # 前端 Deployment + Service + Ingress
└── overlays/
    ├── ack-test/                  # 阿里云 ACK 测试环境
    │   └── kustomization.yaml
    ├── staging/                   # 公司预发环境（骨架，待细化）
    │   └── kustomization.yaml
    └── prod/                      # 公司生产环境（骨架，待细化）
        └── kustomization.yaml
```

## 部署步骤

### 1. 创建 Secret（敏感信息，手动，不进 git）

每个环境需创建一个 `opencode-server-secret`，包含 DB 密码、JWT 密钥、镜像拉取密码：

```bash
# 在目标 namespace 下创建
kubectl create secret generic opencode-server-secret \
  --from-literal=MYSQL_HOST=<db-host> \
  --from-literal=MYSQL_PORT=<db-port> \
  --from-literal=MYSQL_USER=<db-user> \
  --from-literal=MYSQL_PASSWORD=<db-password> \
  --from-literal=MYSQL_DATABASE=<db-name> \
  --from-literal=JWT_SECRET=<random-long-string> \
  --from-literal=IMAGE_PULL_PASSWORD=<registry-password> \
  -n <namespace>
```

### 2. 创建 imagePullSecret（拉私有镜像）

```bash
kubectl create secret docker-registry acr-auth \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<password> \
  -n <namespace>

# 挂到 ServiceAccount
kubectl patch sa default -n <namespace> \
  -p '{"imagePullSecrets":[{"name":"acr-auth"}]}'
```

### 3. 部署

```bash
# 测试环境
kubectl apply -k deploy/k8s/overlays/ack-test

# 预发环境（待公司集群就绪）
kubectl apply -k deploy/k8s/overlays/staging

# 生产环境
kubectl apply -k deploy/k8s/overlays/prod
```

### 4. 验证

```bash
kubectl get pods -n <namespace>
kubectl get ingress -n <namespace>
```

## 各环境配置矩阵

| 维度 | ack-test | staging | prod |
|------|----------|---------|------|
| namespace | opencode-platform-test | opencode-platform-staging | opencode-platform-prod |
| 实例 namespace | opencode-instances-test | opencode-instances-staging | opencode-instances-prod |
| MYSQL_DATABASE | agenthub_test | agenthub_staging | agenthub_prod |
| 镜像 registry | 阿里云 ACR | 公司 registry（从 ACR 同步）| 公司 registry |
| 副本数(server/web) | 1/1 | 1/1 | 2/2 |
| Ingress host | opencode-test.internal | opencode-staging.company.com | opencode.company.com |

## 更新镜像

```bash
# 修改 overlay 的 images.newTag，或直接用 kustomize edit
cd deploy/k8s/overlays/ack-test
kustomize edit set image opencode-server=registry.cn-hangzhou.aliyuncs.com/citics_lwj/opencode-server:v1.2.3

# 重新 apply
kubectl apply -k deploy/k8s/overlays/ack-test
```
