import { Hono } from 'hono'
import { errorResponse } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'
import { findOwnedInstance, sidecarServiceUrl } from '../services/opencode-proxy.js'

const proxy = new Hono<AppBindings>()

// sidecar 地址解析（Service 名 = group_id，跨版本稳定）
function sidecarBase(inst: { groupId: string; namespace: string }): string {
  return sidecarServiceUrl(inst)
}

// 通用 sidecar 转发
async function forwardToSidecar(
  inst: { groupId: string; namespace: string },
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  try {
    const base = sidecarBase(inst)
    const headers = new Headers(init.headers)
    if (init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    return await fetch(`${base}${path}`, { ...init, headers })
  } catch {
    return null
  }
}

// ===== 健康检查（走 sidecar /monitor/health）=====
proxy.get('/:id/health', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/health')
    if (!r) return c.json({ healthy: false, version: 'unknown' })
    return c.json(await r.json())
  } catch {
    return c.json({ healthy: false, version: 'unknown' })
  }
})

// ===== 会话列表（走 sidecar /monitor/sessions）=====
proxy.get('/:id/sessions', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/sessions')
    if (!r) return c.json([])
    return c.json(await r.json())
  } catch {
    return c.json([])
  }
})

// ===== 创建会话（走 sidecar /monitor/sessions）=====
proxy.post('/:id/sessions', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const body = await c.req.json().catch(() => ({}))
  const r = await forwardToSidecar(inst, '/monitor/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r) return c.json({ error: 'Failed' }, 502)
  return c.json(await r.json(), r.status as any)
})

// ===== 会话消息历史（走 sidecar /monitor/sessions/:sid/messages）=====
proxy.get('/:id/sessions/:sid/messages', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const sid = c.req.param('sid')
  try {
    const r = await forwardToSidecar(inst, `/monitor/sessions/${sid}/messages`)
    if (!r) return c.json([])
    return c.json(await r.json())
  } catch {
    return c.json([])
  }
})

// ===== 发送消息（走 sidecar A2A /message:send，同步模式）=====
proxy.post('/:id/sessions/:sid/message', async (c) => {
  const user = c.get('user') as JwtPayload
  const inst = await findOwnedInstance(user.sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const sid = c.req.param('sid')
  const body = await c.req.json().catch(() => ({}))
  const text = Array.isArray(body?.parts)
    ? body.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n')
    : ''
  // 走 A2A 同步模式
  const r = await forwardToSidecar(inst, '/message:send', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        role: 'user',
        messageId: `msg-${Date.now()}`,
        contextId: sid,
        parts: [{ type: 'text', text }],
      },
    }),
  })
  if (!r) return c.json({ error: 'Failed to send message' }, 502)
  return c.json(await r.json(), r.status as any)
})

// ===== A2A 消息发送（统一对话入口，走 sidecar A2A）=====
proxy.post('/:id/a2a/message', async (c) => {
  const user = c.get('user') as JwtPayload
  const inst = await findOwnedInstance(user.sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const body = await c.req.json().catch(() => ({}))
  const r = await forwardToSidecar(inst, '/message:send', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r) return c.json({ error: { code: -32603, message: 'Failed' } }, 502)
  return c.json(await r.json(), r.status as any)
})

// ===== A2A 会话列表 =====
proxy.get('/:id/a2a/sessions', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/sessions')
    if (!r) return c.json([])
    return c.json(await r.json())
  } catch {
    return c.json([])
  }
})

// ===== A2A 审批：获取控制请求（透传 sessionId）=====
proxy.get('/:id/a2a/control-next', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const sessionId = c.req.query('sessionId') ?? ''
  try {
    const r = await forwardToSidecar(inst, `/tasks/control-next?sessionId=${encodeURIComponent(sessionId)}`)
    if (!r) return c.json({ type: 'noop' })
    return c.json(await r.json())
  } catch {
    return c.json({ type: 'noop' })
  }
})

// ===== A2A 审批：回传决定（透传 sessionId/permissionId/response）=====
proxy.post('/:id/a2a/respond', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const body = await c.req.json().catch(() => ({}))
  const r = await forwardToSidecar(inst, '/tasks/respond', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r) return c.json({ ok: false, error: 'sidecar 不可达' }, 502)
  return c.json(await r.json(), r.status as any)
})

// ===== SSE 事件流（走 sidecar /monitor/events）=====
proxy.get('/:id/events', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const { streamSSE } = await import('hono/streaming')
  return streamSSE(c, async (stream) => {
    try {
      const upstream = await forwardToSidecar(inst, '/monitor/events')
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

// ===== MCP / Agent / Provider（走 sidecar /monitor/components）=====
proxy.get('/:id/mcp', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/components')
    if (!r) return c.json({})
    const data = await r.json()
    return c.json(data.mcp ?? {})
  } catch {
    return c.json({})
  }
})

proxy.get('/:id/agent', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/components')
    if (!r) return c.json([])
    const data = await r.json()
    return c.json(data.agent ?? [])
  } catch {
    return c.json([])
  }
})

proxy.get('/:id/provider', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/monitor/components')
    if (!r) return c.json({})
    const data = await r.json()
    return c.json(data.provider ?? {})
  } catch {
    return c.json({})
  }
})

// ===== A2A Agent Card =====
proxy.get('/:id/a2a-card', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/.well-known/agent.json')
    if (!r) return c.json({ registered: false })
    return c.json(await r.json())
  } catch {
    return c.json({ registered: false })
  }
})

// ===== Skills（走 sidecar /skills）=====
proxy.get('/:id/skills', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const r = await forwardToSidecar(inst, '/skills')
    if (!r) return c.json([])
    return c.json(await r.json())
  } catch {
    return c.json([])
  }
})

proxy.post('/:id/skills', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  try {
    const form = await c.req.formData()
    const r = await forwardToSidecar(inst, '/skills', { method: 'POST', body: form })
    if (!r) return errorResponse(c, 'SIDECAR_UNAVAILABLE', '监控服务不可达', 502)
    return c.json(await r.json(), r.status as any)
  } catch (e) {
    return errorResponse(c, 'SIDECAR_UNAVAILABLE', `监控服务不可达: ${(e as Error).message}`, 502)
  }
})

proxy.delete('/:id/skills/:name', async (c) => {
  const inst = await findOwnedInstance((c.get('user') as JwtPayload).sub, Number(c.req.param('id')))
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const name = c.req.param('name')
  try {
    const r = await forwardToSidecar(inst, `/skills/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!r) return c.json({ ok: false })
    return c.json(await r.json(), r.status as any)
  } catch (e) {
    return errorResponse(c, 'SIDECAR_UNAVAILABLE', `监控服务不可达: ${(e as Error).message}`, 502)
  }
})

export default proxy
