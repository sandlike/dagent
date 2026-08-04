# 管理后端镜像
# 构建上下文为 monorepo 根目录：
#   docker build -f apps/server/Dockerfile -t opencode-server:latest .
# 之后手动 docker push 到内网 registry。
#
# 说明：server 对 @opencode/shared 有运行时依赖（k8s.ts 的 imageRef 等），
# 但 shared 是纯 TS 源码包（无 build 脚本），tsc 编译时会把用到的部分一起输出到 dist。

# ===== Stage 1: 构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories && \
    npm config set registry https://registry.npmmirror.com
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# drizzle-kit 是 devDep，migration 文件需要它；--ignore-scripts 避免 esbuild 构建脚本
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
# 先编译 shared（生成 dist/index.js + .d.ts），package.json exports 指向 dist
RUN pnpm --filter @opencode/shared run build
# 编译 server（tsconfig paths 在编译期解析到 shared 源码，运行时 Node 走 package.json exports → dist）
RUN pnpm --filter @opencode/server run build && \
    rm -rf apps/server/dist/packages && \
    mv apps/server/dist/apps/server/src/* apps/server/dist/ && \
    rm -rf apps/server/dist/apps

# ===== Stage 2: 运行时 =====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    LANG=C.UTF-8 \
    TZ=Asia/Shanghai
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories && \
    npm config set registry https://registry.npmmirror.com
RUN corepack enable

# prod 依赖（@kubernetes/client-node 是 optionalDependencies，按需安装）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod --filter @opencode/server... --ignore-scripts

# 编译产物（平铺：dist/index.js）
COPY --from=builder /app/apps/server/dist ./apps/server/dist
# shared 编译产物：pnpm install --prod 只 symlink 了 package.json，需手动拷 dist
# （@opencode/shared 是 workspace 包，运行时 Node 通过 package.json exports 找 dist/index.js）
COPY --from=builder /app/packages/shared/dist ./apps/server/node_modules/@opencode/shared/dist
# drizzle migration 文件（db 初始化用）
COPY --from=builder /app/apps/server/drizzle.config.ts ./apps/server/
COPY --from=builder /app/apps/server/src/db/migrations ./apps/server/src/db/migrations

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
