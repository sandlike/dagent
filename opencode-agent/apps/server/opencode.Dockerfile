# opencode 版本镜像构建说明（非自动构建文件，作为参考与模板）
#
# 构建目标：linux/amd64（x86_64），tag = 版本号
# 本机 opencode 版本：1.15.12
#
# 构建命令（在 monorepo 根目录执行）：
#   docker buildx build --platform linux/amd64 \
#     -f apps/server/opencode.Dockerfile \
#     --build-arg OPENCODE_VERSION=1.15.12 \
#     -t <registry>/opencode:1.15.12 \
#     --push .
#
# 若仅本地测试（不推送），把 --push 换成 --load。
# 仓库地址确定后，把 <registry> 替换为真实地址，并在平台后端设置 IMAGE_REGISTRY=<registry>。

FROM node:22-alpine

ARG OPENCODE_VERSION=1.15.12

# 安装 opencode 指定版本（全局）
RUN npm install -g opencode@${OPENCODE_VERSION}

# opencode 工作目录（运行时由 PVC 挂载覆盖）
WORKDIR /root

EXPOSE 4096

# serve 模式：无界面 HTTP 服务器
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
