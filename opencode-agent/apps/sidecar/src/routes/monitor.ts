import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  getHealth,
  getSessions,
  getSessionStatus,
  getMcp,
  getAgent,
  getProvider,
  opencodeFetch,
} from '../services/opencode-client.js'

const monitor = new Hono()

// 健康检查
monitor.get('/health', async (c) => {
  const h = await getHealth()
  return c.json(h ?? { healthy: false, version: 'unknown' })
})

// 会话列表（合并 status）
monitor.get('/sessions', async (c) => {
  const [sessions, status] = await Promise.all([getSessions(), getSessionStatus()])
  const merged = (sessions as any[]).map((s) => ({
    ...s,
    status: status[s.id] ?? 'idle',
  }))
  return c.json(merged)
})

// 会话消息历史（opencode /session/:id/message）
monitor.get('/sessions/:sid/messages', async (c) => {
  const sid = c.req.param('sid')
  const r = await opencodeFetch(`/session/${sid}/message`)
  if (!r) return c.json([])
  return c.json(await r.json())
})

// 创建会话
monitor.post('/sessions', async (c) => {
  const r = await opencodeFetch('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await c.req.json().catch(() => ({}))),
  })
  if (!r) return c.json({ error: 'Failed' }, 502)
  return c.json(await r.json(), r.status as any)
})

// SSE 事件流透传（opencode /event）
monitor.get('/events', async (c) => {
  return streamSSE(c, async (stream) => {
    try {
      const upstream = await opencodeFetch('/event')
      if (!upstream?.body) return
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (line.startsWith('data:')) {
            await stream.writeSSE({ data: line.slice(5).trim() })
          }
        }
      }
    } catch {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error' }) })
    }
  })
})

// 组件状态聚合（MCP + Agent + Provider 并发）
monitor.get('/components', async (c) => {
  const [mcp, agent, provider] = await Promise.all([
    getMcp(),
    getAgent(),
    getProvider(),
  ])
  return c.json({ mcp, agent, provider })
})

export default monitor
