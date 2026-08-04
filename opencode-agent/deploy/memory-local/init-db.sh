#!/bin/bash
# Postgres 初始化：创建 Mem0 需要的两个数据库
# - mem0_app：应用元数据（用户、API key、审计日志，由 alembic 管理）
# - mem0：向量数据（memories 表，由 mem0 SDK 自动创建）
set -e

echo "[init-db] creating databases: mem0_app, mem0"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE mem0_app;
    CREATE DATABASE mem0;
    \c mem0
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL
echo "[init-db] done"
