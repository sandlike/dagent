// A2A（Agent-to-Agent）协议适配层
// 把 opencode 的 HTTP API 封装为标准 A2A 协议端点
// 参考：https://github.com/a2aproject/A2A/blob/main/specification/a2a.proto
//
// === Human-in-the-Loop 审批（2026-07-04 重做）===
// opencode headless serve 模式下，permission 裁决端点为：
//   POST /session/:id/permissions/:permissionID  body: { response: 'allow'|'deny', remember? }
// permission 请求通过 /event SSE 流派发，由 permission-watcher 解析缓存。
// 前端通过 GET /tasks/control-next?sessionId=xxx 取请求，POST /tasks/respond 回传决定。

import { Hono } from 'hono'
import { env } from '../env.js'
import { opencodeFetch } from '../services/opencode-client.js'
import {
  startPermissionWatcher,
  dequeuePermission,
  type PermissionRequest,
} from '../services/permission-watcher.js'

const a2a = new Hono()

// 启动后台 permission 监听（幂等）
startPermissionWatcher()

// ===== Agent Card（/.well-known/agent.json）=====
a2a.get('/.well-known/agent.json', async (c) => {
  let agents: any[] = []
  try {
    const r = await opencodeFetch('/agent')
    if (r) agents = await r.json()
  } catch {}

  const skills = agents.map((a: any) => ({
    id: a.name || 'build',
    name: a.name || 'build',
    description: a.description || 'Default agent',
    tags: ['coding', 'development'],
  }))

  return c.json({
    name: 'OpenCode Agent',
    description: 'AI coding agent powered by OpenCode',
    version: '1.0.0',
    protocolVersion: '0.3',
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills,
    url: `http://0.0.0.0:${env.port}/a2a`,
    provider: {
      organization: 'OhMyAgent',
      url: 'https://oma.internal',
    },
  })
})

// ===== SendMessage（POST /message:send）=====
// 默认同步模式：等待 opencode /message 完整回复，直接返回 artifacts。
// 这是「对话」的标准行为——前端发消息→等回复，简单可靠，不依赖 SSE。
//
// bash=ask 时同步请求会阻塞等裁决——这正是我们要的：
//   前端发消息后立即轮询 control-next，阻塞期间拿到 permission 请求→弹审批卡片→
//   用户裁决→opencode 继续→同步 HTTP 自动解除阻塞返回回复。
//
// 异步模式（returnImmediately=true）仅在显式要求时启用（未来流式输出场景）。
a2a.post('/message:send', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const msg = body.message ?? body
  const parts = msg.parts ?? []
  const text = parts
    .filter((p: any) => p.type === 'text' || p.text)
    .map((p: any) => p.text || '')
    .join('\n')

  // 默认同步；显式 returnImmediately=true 才异步
  const returnImmediately = body.configuration?.returnImmediately === true

  if (!text) {
    return c.json({ error: { code: -32602, message: 'No text content in message parts' } }, 400)
  }

  try {
    // 1. 创建或复用 opencode 会话
    let sessionId = msg.contextId || msg.context_id
    if (!sessionId) {
      const sr = await opencodeFetch('/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!sr) return c.json({ error: { code: -32603, message: 'Failed to create session' } }, 502)
      const sj = await sr.json()
      sessionId = sj.id
    }

    // 2. 异步模式：prompt_async（不等待，回复/permission 通过 /event 流派发）
    if (returnImmediately) {
      await opencodeFetch(`/session/${sessionId}/prompt_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [{ type: 'text', text }],
        }),
      })
      const taskId = `task-${sessionId}-${Date.now()}`
      return c.json({
        id: taskId,
        contextId: sessionId,
        status: {
          state: 'WORKING',
          timestamp: new Date().toISOString(),
        },
      })
    }

    // 2b. 同步模式：等待完整回复
    const mr = await opencodeFetch(`/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text }],
      }),
    })
    if (!mr) return c.json({ error: { code: -32603, message: 'Failed to send message' } }, 502)
    const mj = await mr.json()

    // 同步响应 mj.parts 只含最终 text（不含 tool 调用过程）。
    // 再查一次消息历史，把本次回复里的 tool 调用提取出来。
    // 「本次回复」= 最后一个 user 消息之后的所有 assistant 消息（可能多条：
    //   第 1 条含 tool 调用，第 2 条含最终 text）。
    // 注意：GET 历史用独立 try/catch + 超时，失败不影响主回复流程。
    let toolParts: any[] = []
    let replyText = ''
    try {
      const hr = await opencodeFetch(`/session/${sessionId}/message`)
      if (hr) {
        const history: any[] = await Promise.race([
          hr.json(),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('history timeout')), 5000)),
        ])
        // 找到最后一个 user 消息的索引
        let lastUserIdx = -1
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].info?.role === 'user') { lastUserIdx = i; break }
        }
        // 收集 lastUserIdx 之后的所有 assistant 消息的 tool + text
        for (let i = lastUserIdx + 1; i < history.length; i++) {
          const m = history[i]
          if (m.info?.role !== 'assistant') continue
          const parts = m.parts ?? []
          for (const p of parts) {
            if (p.type === 'tool' && p.tool) {
              toolParts.push({
                type: 'tool',
                tool: p.tool,
                status: p.state?.status ?? 'completed',
                input: p.state?.input ?? {},
                output: p.state?.metadata?.output ?? '',
              })
            }
          }
          // text 累加（最终回复可能在最后一条 assistant）
          const t = parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join('')
          if (t) replyText = (replyText + (replyText ? '\n' : '') + t).trim()
        }
      }
    } catch {
      // 历史查询失败（超时/解析错），静默降级——只用 mj.parts 的回复
    }
    // 兜底：历史没拿到就用 mj.parts
    if (!replyText) {
      replyText = Array.isArray(mj.parts)
        ? mj.parts.map((p: any) => p.text || p.content || '').join('')
        : ''
    }

    // 构造 artifacts：先 tool 调用过程，再最终 text 回复
    const artifactParts: any[] = [
      ...toolParts,
      { type: 'text', text: replyText || '(no response)' },
    ]
    return c.json({
      id: `task-${Date.now()}`,
      contextId: sessionId,
      status: { state: 'COMPLETED', timestamp: new Date().toISOString() },
      artifacts: [
        { artifactId: `artifact-${Date.now()}`, parts: artifactParts },
      ],
    })
  } catch (e) {
    return c.json({ error: { code: -32603, message: (e as Error).message } }, 500)
  }
})

// ===== Human-in-the-Loop 审批（A2A 标准化）=====
// 把 opencode 的 permission 机制（/event + /session/:id/permissions/:id）桥接为 A2A 端点
// ⚠️ 路由顺序：/tasks/control-next 必须在 /tasks/:id 之前注册，否则会被 :id 参数捕获

// 获取下一个控制请求（必须带 sessionId）
// 返回 A2A 标准格式：{ type, permissionId, sessionId, tool, input, description }
a2a.get('/tasks/control-next', async (c) => {
  const sessionId = c.req.query('sessionId')
  if (!sessionId) {
    return c.json({ type: 'noop', error: 'missing sessionId' })
  }
  const req: PermissionRequest | null = dequeuePermission(sessionId)
  if (!req) return c.json({ type: 'noop' })
  return c.json({
    type: 'permission',
    permissionId: req.permissionId,
    sessionId: req.sessionId,
    tool: req.tool,
    input: req.input,
    description: req.description,
    raw: req.raw,
  })
})

// 回传用户审批决定
// 前端 body: { sessionId, permissionId, response: 'allow'|'deny', remember?: boolean }
// 转换为 opencode 1.15.x 的裁决格式：
//   POST /session/:sessionId/permissions/:permissionID
//   body: { response: 'once' | 'always' | 'reject' }   ← 实测确认的枚举
//   - allow + remember=false → 'once'
//   - allow + remember=true  → 'always'
//   - deny                   → 'reject'
a2a.post('/tasks/respond', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { sessionId, permissionId, response, remember } = body
  if (!sessionId || !permissionId) {
    return c.json({ error: 'sessionId 和 permissionId 必填' }, 400)
  }
  // 转换为 opencode 枚举
  let ocResponse: string
  if (response === 'deny' || response === 'reject') {
    ocResponse = 'reject'
  } else if (remember === true) {
    ocResponse = 'always'
  } else {
    ocResponse = 'once'
  }
  try {
    const r = await opencodeFetch(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: ocResponse }),
    })
    if (!r) return c.json({ ok: false, error: 'opencode 未就绪' }, 502)
    const data = await r.json().catch(() => ({ ok: true }))
    return c.json({ ok: r.ok, data })
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500)
  }
})

// ===== GetTask（GET /a2a/tasks/:id）=====
// 注意：此路由在 /tasks/control-next 之后，避免捕获 control-next
a2a.get('/tasks/:id', async (c) => {
  const taskId = c.req.param('id')
  // 防御：control-next 不应走到这里
  if (taskId === 'control-next') {
    return c.json({ type: 'noop' })
  }
  const sessionId = taskId.replace(/^task-/, '')
  try {
    const r = await opencodeFetch(`/session/${sessionId}/message`)
    if (!r) return c.json({ error: { code: -32602, message: 'Task not found' } }, 404)
    const messages = await r.json()
    return c.json({
      id: taskId,
      contextId: sessionId,
      status: { state: 'COMPLETED', timestamp: new Date().toISOString() },
      history: messages,
    })
  } catch {
    return c.json({ error: { code: -32602, message: 'Task not found' } }, 404)
  }
})

export default a2a
