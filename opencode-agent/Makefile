# OpenCode 容器管理平台 - 镜像构建脚本
# 用法：
#   make build              # 构建全部 4 个镜像（amd64）
#   make push               # 推送全部镜像到 REGISTRY
#   make build-opencode     # 单独构建 opencode 实例镜像
#   make deploy-ack-test    # 部署到阿里云 ACK 测试环境
#
# 变量覆盖：
#   make build REGISTRY=registry.cn-hangzhou.aliyuncs.com/citics_lwj TAG=v1.0.0

REGISTRY ?= registry.cn-hangzhou.aliyuncs.com/citics_lwj
TAG ?= latest
PLATFORM ?= linux/amd64

# opencode 版本（npm opencode-ai 版本号，对应 versions/index.ts）
OPENCODE_VERSION ?= $(TAG)

.PHONY: build push build-opencode build-sidecar build-server build-web deploy-ack-test

# ===== 构建 =====
build: build-opencode build-sidecar build-server build-web

build-opencode:
	docker buildx build --platform $(PLATFORM) \
		-f apps/opencode/Dockerfile \
		--build-arg OPENCODE_VERSION=$(OPENCODE_VERSION) \
		-t $(REGISTRY)/opencode:$(TAG) \
		--load .

build-sidecar:
	docker buildx build --platform $(PLATFORM) \
		-f apps/sidecar/Dockerfile \
		-t $(REGISTRY)/opencode-sidecar:$(TAG) \
		--load .

build-server:
	docker buildx build --platform $(PLATFORM) \
		-f apps/server/Dockerfile \
		-t $(REGISTRY)/opencode-server:$(TAG) \
		--load .

build-web:
	docker buildx build --platform $(PLATFORM) \
		-f apps/web/Dockerfile \
		-t $(REGISTRY)/opencode-web:$(TAG) \
		--load .

# ===== 推送 =====
push:
	docker push $(REGISTRY)/opencode:$(TAG)
	docker push $(REGISTRY)/opencode-sidecar:$(TAG)
	docker push $(REGISTRY)/opencode-server:$(TAG)
	docker push $(REGISTRY)/opencode-web:$(TAG)

# ===== 部署（需先 kubectl config use-context 到目标集群）=====
deploy-ack-test:
	kubectl apply -k deploy/k8s/overlays/ack-test

deploy-staging:
	kubectl apply -k deploy/k8s/overlays/staging

deploy-prod:
	kubectl apply -k deploy/k8s/overlays/prod

# ===== 本地开发 =====
dev:
	pnpm install
	pnpm dev

# 数据库初始化
db-init:
	pnpm --filter @opencode/server exec tsx src/db/init.ts
