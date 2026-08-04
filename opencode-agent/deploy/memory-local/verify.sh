#!/bin/bash
# Mem0 本地验证脚本
# 验证目标：
#   1. 服务健康
#   2. 写入记忆（按 user_id + agent_id）
#   3. 检索记忆（按 user_id + agent_id 精确隔离）
#   4. 跨 user_id 隔离（A 的记忆 B 看不到）
#   5. 跨 agent_id 隔离（同一用户在不同 agent 记忆隔离）
#
# 用法：./verify.sh
# 前提：docker compose up -d 已起，且 .env 已配真实 DEEPSEEK_API_KEY + TONGYI_API_KEY

set -e

MEM0_URL="http://localhost:8888"
CURL="/usr/bin/curl"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
check() { if [ "$1" = "0" ]; then green "  ✓ $2"; PASS=$((PASS+1)); else red "  ✗ $2"; FAIL=$((FAIL+1)); fi; }

echo "════════════════════════════════════════════"
echo "  Mem0 本地验证"
echo "════════════════════════════════════════════"
echo ""

# ── 1. 健康检查（mem0 server 用 /docs 探活，无 /health 端点）──
echo "[1/5] 健康检查"
HEALTH=$($CURL -s -o /dev/null -w "%{http_code}" "$MEM0_URL/docs" || echo "000")
[ "$HEALTH" = "200" ]; check $? "GET /docs 返回 200（实际: $HEALTH）"
echo ""

# ── 2. 写入记忆 ──
echo "[2/5] 写入记忆（user=u1, agent=ag-001）"
RESP=$($CURL -s -X POST "$MEM0_URL/memories" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "我是张三，我是后端工程师，主要用 Python 和 Go"},
      {"role": "assistant", "content": "了解了，张三你好"}
    ],
    "user_id": "u1",
    "agent_id": "ag-001"
  }')
echo "  Mem0 抽取结果: $(echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP")"
echo "$RESP" | grep -qi '"results"'; check $? "POST /memories 成功（results 字段存在）"
echo ""

# 给 Mem0 时间处理（事实抽取调 DeepSeek，向量化调通义，都是远程调用）
echo "  等待 5 秒让 Mem0 完成事实抽取 + 向量化..."
sleep 5
echo ""

# ── 3. 检索：同 user 同 agent ──
echo "[3/5] 检索记忆（user=u1, agent=ag-001，应该能查到张三的技能）"
SEARCH=$($CURL -s -X POST "$MEM0_URL/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "张三是做什么的", "user_id": "u1", "agent_id": "ag-001"}')
echo "  检索结果: $(echo "$SEARCH" | python3 -m json.tool 2>/dev/null || echo "$SEARCH")"
# 期望能命中 Python/Go/后端 相关记忆
echo "$SEARCH" | grep -qiE "python|go|后端|工程师"; check $? "检索到张三的技能记忆"
echo ""

# ── 4. 跨 user 隔离 ──
echo "[4/5] 跨 user 隔离（user=u2 查 ag-001，应该查不到张三的记忆）"
SEARCH_U2=$($CURL -s -X POST "$MEM0_URL/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "张三", "user_id": "u2", "agent_id": "ag-001"}')
echo "  u2 的检索结果: $(echo "$SEARCH_U2" | python3 -m json.tool 2>/dev/null || echo "$SEARCH_U2")"
# 期望 results 是空数组
echo "$SEARCH_U2" | grep -q '\[\]'; check $? "u2 查不到 u1 的记忆（隔离生效）"
echo ""

# ── 5. 跨 agent 隔离 ──
echo "[5/5] 跨 agent 隔离（user=u1 查 ag-002，应该查不到 ag-001 的记忆）"
SEARCH_AG2=$($CURL -s -X POST "$MEM0_URL/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "张三", "user_id": "u1", "agent_id": "ag-002"}')
echo "  u1 在 ag-002 的检索结果: $(echo "$SEARCH_AG2" | python3 -m json.tool 2>/dev/null || echo "$SEARCH_AG2")"
echo "$SEARCH_AG2" | grep -q '\[\]'; check $? "u1 在 ag-002 查不到 ag-001 的记忆（agent 隔离生效）"
echo ""

echo "════════════════════════════════════════════"
green "  通过: $PASS    失败: $FAIL"
echo "════════════════════════════════════════════"

[ "$FAIL" = "0" ]
