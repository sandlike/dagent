# 前端镜像（Vite 构建 + nginx 托管）
# 构建上下文为 monorepo 根目录：
#   docker build -f apps/web/Dockerfile -t opencode-web:latest .
#
# 部署后，前端容器内 nginx 负责：
#   1. 托管静态文件（SPA fallback）
#   2. /api 反向代理到同 namespace 的 opencode-server:3000

# ===== Stage 1: 构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories && \
    npm config set registry https://registry.npmmirror.com
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
# vue-tsc / vite / tailwind 需要构建脚本；--ignore-scripts 避免 esbuild native build
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# 先编译 shared（package.json exports 指向 dist，部分工具链会读 exports）
RUN pnpm --filter @opencode/shared run build
# 允许 esbuild/tailwind 运行 postinstall（vite build 需要）
RUN pnpm rebuild
RUN pnpm --filter @opencode/web run build

# ===== Stage 2: 运行时（nginx 托管静态文件）=====
FROM nginx:alpine AS runner
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories
# 替换默认配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# 拷贝构建产物
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
