// opencode permission 请求监听器
// 订阅 opencode 的 /event SSE 流，识别 permission 请求事件，
// 缓存到内存队列（按 sessionId 索引），供 A2A control-next 长轮询消费。
//
// opencode headless serve 模式下，当工具配置为 ask 时，
// 会通过 /event 流派发 permission 请求事件，客户端需用
// POST /session/:id/permissions/:permissionID 裁决。

import { env } from '../env.js'

export interface PermissionRequest {
  sessionId: string
  permissionId: string
  tool: string // 如 'bash'
  input?: unknown // 工具入参（如命令文本）
  description?: string
  raw: unknown // 原始事件（调试用）
  arrivedAt: number
}

// 内存队列：sessionId → PermissionRequest[]
// 用 Map 而非全局数组，便于按 session 精确查询
const queue = new Map<string, PermissionRequest[]>()

// 标记已被消费（前端已取走）的 permission，避免重复派发
const consumedIds = new Set<string>()

let started = false
let abortCtrl: AbortController | null = null

// 把 permission 请求入队
export function enqueuePermission(req: PermissionRequest): void {
  if (consumedIds.has(req.permissionId)) return
  const list = queue.get(req.sessionId) ?? []
  // 去重（同 permissionId 不重复入队）
  if (list.some((p) => p.permissionId === req.permissionId)) return
  list.push(req)
  queue.set(req.sessionId, list)
}

// 取出该 session 的下一个 permission 请求（FIFO），取出即标记已消费
export function dequeuePermission(sessionId: string): PermissionRequest | null {
  const list = queue.get(sessionId)
  if (!list || list.length === 0) return null
  const req = list.shift()!
  consumedIds.add(req.permissionId)
  // 清理过期的 consumed 记录（避免无限增长，保留最近 1000 条）
  if (consumedIds.size > 1000) {
    const arr = Array.from(consumedIds)
    consumedIds.clear()
    for (const id of arr.slice(-500)) consumedIds.add(id)
  }
  return req
}

// 清理某 session 的队列（会话结束时）
export function clearSession(sessionId: string): void {
  queue.delete(sessionId)
}

// 启动后台 SSE 监听（幂等，重复调用不会启多个）
export function startPermissionWatcher(): void {
  if (started) return
  started = true
  loop()
}

// 停止监听（测试用）
export async function stopPermissionWatcher(): Promise<void> {
  started = false
  abortCtrl?.abort()
  abortCtrl = null
}

// 尝试解析事件 JSON（opencode SSE data 字段可能是 JSON 字符串）
function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// 从事件对象里提取 permission 请求
// === opencode 1.15.x 实测确认的事件结构（2026-07-04 ACK 实测）===
// 事件类型：type = "permission.asked"
// 数据位置：properties（不是 data）
// 真实样本：
//   {
//     "id": "evt_...",
//     "type": "permission.asked",
//     "properties": {
//       "id": "per_f2d2a36bf001...",           ← permissionID（裁决端点用）
//       "sessionID": "ses_0d2d5db12...",        ← 注意大写 ID
//       "permission": "bash",                   ← 工具名
//       "patterns": ["ls -la"],                 ← 要审批的命令/输入
//       "metadata": {},
//       "always": ["ls *"],
//       "tool": { "messageID": "...", "callID": "..." }
//     }
//   }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPermission(evt: any): PermissionRequest | null {
  if (!evt || typeof evt !== 'object') return null
  const type = evt.type ?? evt.event ?? ''
  // 只处理 permission.asked 事件（opencode 1.15.x 的真实类型名）
  if (type !== 'permission.asked' && type !== 'permission.ask') return null

  // 数据在 properties 字段（实测确认）
  const props = evt.properties ?? evt.data ?? evt
  const sessionId = props.sessionID ?? props.sessionId ?? props.session_id
  const permissionId = props.id ?? props.permissionId
  // 工具名：permission 字段（实测）；兼容 tool 字段
  const tool = props.permission ?? props.tool ?? 'unknown'
  // 输入：patterns 数组（实测）；兼容 input
  const patterns = props.patterns
  const input = Array.isArray(patterns) ? patterns.join(' ') : (props.input ?? undefined)
  const description = props.description
  if (!sessionId || !permissionId) return null
  return {
    sessionId: String(sessionId),
    permissionId: String(permissionId),
    tool: String(tool),
    input,
    description: description ? String(description) : undefined,
    raw: evt,
    arrivedAt: Date.now(),
  }
}

// SSE 连接循环（断线自动重连）
async function loop() {
  while (started) {
    abortCtrl = new AbortController()
    try {
      const pwd = process.env.OPENCODE_SERVER_PASSWORD
      const headers: Record<string, string> = { Accept: 'text/event-stream' }
      if (pwd) headers.Authorization = `Basic ${Buffer.from(`opencode:${pwd}`).toString('base64')}`
      const resp = await fetch(`${env.opencodeBase}/event`, {
        headers,
        signal: abortCtrl.signal,
      })
      if (!resp.ok || !resp.body) {
        // opencode 未就绪，等一会重试
        await sleep(2000)
        continue
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (started) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE 事件以空行分隔
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evtBlock of events) {
          // 提取 data: 行内容（可能多行）
          const dataLines = evtBlock
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
          if (dataLines.length === 0) continue
          const dataStr = dataLines.join('\n')
          const parsed = tryParseJson(dataStr)
          if (parsed) {
            const perm = extractPermission(parsed)
            if (perm) enqueuePermission(perm)
          }
        }
      }
    } catch {
      // 网络中断或 abort，等一会重连
    }
    if (started) await sleep(2000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
