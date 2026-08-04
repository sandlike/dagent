# opencode 实例镜像
# 公司服务器拉不到 ghcr，故走 npm 包 opencode-ai 在 node:alpine 上自建。
# 构建上下文为 monorepo 根目录：
#   docker build -f apps/opencode/Dockerfile -t opencode:1.15.12 .
#   # 指定版本（对应 npm opencode-ai 的版本号）：
#   docker build -f apps/opencode/Dockerfile --build-arg OPENCODE_VERSION=1.17.13 -t opencode:1.17.13 .
# 之后手动 docker push 到内网 registry，K8s 通过 IMAGE_REGISTRY 指向该 registry。

# 基础镜像
FROM node:20-alpine

# 构建参数：opencode 版本（对应 npm 包 opencode-ai 的版本号，同时也是镜像 tag）
ARG OPENCODE_VERSION=latest

# 环境变量
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Asia/Shanghai \
    NODE_ENV=production

# 国内镜像源加速（Alpine apk + npm）
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.tuna.tsinghua.edu.cn#g' /etc/apk/repositories

# 安装必要依赖、配置 npm 国内源、安装 opencode
RUN apk add --no-cache git ca-certificates curl bash procps && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g opencode-ai@${OPENCODE_VERSION} && \
    npm cache clean --force

# 创建固定 uid/gid 的非 root 用户（避开 node:alpine 自带 node 用户的 uid 1000，
# 便于 K8s securityContext.fsGroup 确定性匹配，让 PVC 可被该用户写入）
RUN addgroup -g 1500 opencode && \
    adduser -D -u 1500 -G opencode -s /bin/sh opencode && \
    # opencode 实际读写目录（XDG）：
    #   配置/skills: ~/.config/opencode/        ← PVC 持久化 + ConfigMap 挂 opencode.json
    #   数据(db等): ~/.local/share/opencode/
    mkdir -p /home/opencode/.config/opencode/skills \
             /home/opencode/.local/share/opencode \
             /workspace && \
    chown -R opencode:opencode /home/opencode /workspace

WORKDIR /workspace

EXPOSE 4096

USER opencode

# 默认启动命令：opencode serve（K8s 部署会显式覆盖 command）
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
