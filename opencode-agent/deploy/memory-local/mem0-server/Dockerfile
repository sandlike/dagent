# Mem0 OSS REST API server（从源码构建，支持 amd64/arm64）
#
# 官方 mem0/mem0-api-server Docker Hub 镜像已 2025-09 停更且仅 arm64，
# ACK 节点是 amd64 必须源码构建。
#
# 本镜像在官方 Dockerfile 基础上：
# 1. clone mem0 v2.0.11 的 server/ 目录（官方 Dockerfile 假设源码已 COPY 进来）
# 2. patch main.py 的 DEFAULT_CONFIG，注入 DeepSeek（LLM）+ 通义（embedder）的 base_url
#    （官方默认走 OpenAI，国内环境不可用）
#
# 构建上下文：本目录（deploy/memory-local/mem0-server/）

# ── builder：clone 源码 + 装依赖 + patch 配置 ──
FROM niddmerfwaxuyqg5mh.xuanyuan.run/library/python:3.12-slim AS builder

# 国内源加速
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update -qq && apt-get install -y --no-install-recommends git build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# clone mem0 源码（固定版本 v2.0.11）
ARG MEM0_VERSION=v2.0.11
RUN git clone --depth 1 --branch ${MEM0_VERSION} https://github.com/mem0ai/mem0.git /app/mem0-repo

WORKDIR /app/mem0-repo/server

# 装依赖（官方 requirements.txt 含 mem0ai、fastapi、psycopg、alembic 等）
# 注意：requirements.txt 用纯 psycopg（需要 libpq 系统库），slim 镜像没有，
# 装 psycopg-binary 提供 C 实现（自带 libpq，无需系统依赖）
RUN pip install --no-cache-dir -r requirements.txt psycopg-binary

# ── 关键：patch DEFAULT_CONFIG，注入 DeepSeek + 通义 base_url ──
# 官方 DEFAULT_CONFIG 的 llm/embedder config 只有 {api_key, temperature, model}
# 我们补 openai_base_url，让 openai provider 走 DeepSeek/通义的 OpenAI 兼容 endpoint
# 用 python 脚本做精确替换（比 sed 更可靠，处理多行 JSON）
COPY patch_config.py /tmp/patch_config.py
RUN python /tmp/patch_config.py main.py

# 验证 patch 生效
RUN grep -q "deepseek.com" main.py && grep -q "dashscope" main.py \
    && echo "[patch] DEFAULT_CONFIG 注入成功"

# ── runner：精简运行镜像 ──
FROM niddmerfwaxuyqg5mh.xuanyuan.run/library/python:3.12-slim AS runner

RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 从 builder 拷已装依赖 + patch 过的源码
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/mem0-repo/server /app

WORKDIR /app

# mem0 SDK 默认用 sqlite 存 history（/app/history/history.db），建目录
RUN mkdir -p /app/history

# 启动顺序：alembic migrate（建 mem0_app 表）→ uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]

EXPOSE 8000
