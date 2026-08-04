# 监控服务 sidecar 镜像
# 构建上下文为 monorepo 根目录：
#   docker build -f apps/sidecar/Dockerfile -t opencode-sidecar:latest .
# 之后手动 docker push 到内网 registry，K8s 通过 SIDECAR_IMAGE 覆盖镜像名。
#
# 说明：sidecar 对 @opencode/shared 仅做 `import type`（编译期，运行时被擦除），
# 因此运行时只需 sidecar 自己的 dist + 其 npm 依赖，无需 shared 源码。

# ===== Stage 1: 构建 =====
# 用 node:22-alpine：pnpm 11 / lockfile v9 需要 Node >= 22
FROM node:22-alpine AS builder
WORKDIR /app
# 国内镜像源加速（Alpine apk + npm/pnpm）
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories && \
    npm config set registry https://registry.npmmirror.com
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/sidecar/package.json apps/sidecar/
# --ignore-scripts: sidecar 编译用 tsc（不依赖 esbuild 二进制）；pnpm 11 默认拦截构建脚本
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/sidecar apps/sidecar
# 编译。tsconfig 的 paths 指向 workspace 外的 @opencode/shared，TS 把 rootDir 推断到
# monorepo 根，导致 dist 嵌套为 dist/apps/sidecar/src/...。编译后把 sidecar 部分提到 dist 根，
# 让 CMD 可用 dist/index.js（同时修正本地 pnpm start 的既存问题）。
RUN pnpm --filter @opencode/sidecar run build && \
    rm -rf apps/sidecar/dist/packages && \
    mv apps/sidecar/dist/apps/sidecar/src/* apps/sidecar/dist/ && \
    rm -rf apps/sidecar/dist/apps

# ===== Stage 2: 运行时 =====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    LANG=C.UTF-8 \
    TZ=Asia/Shanghai
# 国内镜像源加速
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories && \
    npm config set registry https://registry.npmmirror.com
RUN corepack enable

# 先装 prod 依赖（仅 sidecar 的 npm 依赖，--filter 让 pnpm 只解析该包及其依赖链）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/sidecar/package.json apps/sidecar/
RUN pnpm install --frozen-lockfile --prod --filter @opencode/sidecar... --ignore-scripts

# 拷贝编译产物（已平铺：dist/index.js）
COPY --from=builder /app/apps/sidecar/dist ./apps/sidecar/dist

EXPOSE 8080

# 共享 PVC 由 K8s 挂载到 OPENCODE_DIR / SKILLS_DIR（与 opencode 容器同一卷）
CMD ["node", "apps/sidecar/dist/index.js"]
