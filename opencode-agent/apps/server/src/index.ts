import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { env } from './env.js'
import { authMiddleware } from './middleware/auth.js'
import { AppBindings } from './lib/types.js'
import healthRoute from './routes/health.js'
import authRoute from './routes/auth.js'
import instancesRoute from './routes/instances.js'
import providersRoute from './routes/providers.js'
import skillsRoute from './routes/skills.js'
import mcpServersRoute from './routes/mcp-servers.js'
import auditRoute from './routes/audit.js'
import proxyRoute from './routes/proxy.js'
import { inc, observe, renderMetrics } from './services/metrics.js'

const app = new Hono<AppBindings>()

app.use('*', logger())
// CORS：从 CORS_ORIGIN 环境变量读取（逗号分隔多域名），默认允许本地开发前端
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use('*', cors({ origin: corsOrigins, credentials: true }))

// 请求埋点中间件（Prometheus metrics）
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  const path = c.req.path
  const method = c.req.method
  const status = String(c.res.status)
  inc('http_requests_total', { method, path, status }, 'Total HTTP requests')
  observe('http_request_duration', ms, { method, path, status, _metric: 'http_request_duration_ms' })
})

// 公开：健康检查
app.get('/api/health', (c) => {
  inc('health_checks_total', {}, 'Health check count')
  return c.json({ ok: true })
})

// 公开：Prometheus metrics（不需要鉴权，Prometheus 直接抓取）
app.get('/metrics', (c) => {
  return c.text(renderMetrics(), 200, { 'Content-Type': 'text/plain; version=0.0.4' })
})

// 公开：注册 / 登录（auth route 内部只有 register/login）
app.route('/api/auth', authRoute)

// 受保护：/me（单独挂 auth 中间件）
app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({
    user: { id: user.sub, username: user.username, createdAt: new Date().toISOString() },
  })
})

// 受保护：实例 CRUD + 部署
app.use('/api/instances/*', authMiddleware)
app.route('/api/instances', instancesRoute)
// 受保护：实例代理（对话/监控/SSE）
app.route('/api/instances', proxyRoute)

// 受保护：Provider 管理（LLM 配置 → Higress）
app.use('/api/providers/*', authMiddleware)
app.route('/api/providers', providersRoute)

// 受保护：Skill 模板管理
app.use('/api/skills/*', authMiddleware)
app.route('/api/skills', skillsRoute)

// 受保护：MCP Server 管理（Higress MCP 代理）
app.use('/api/mcp-servers/*', authMiddleware)
app.route('/api/mcp-servers', mcpServersRoute)

// 审计日志（GET 查询需鉴权，POST 写入由 sidecar 内部调用）
app.get('/api/audit', authMiddleware, async (c) => {
  return auditRoute.fetch(c.req.raw, c.env, c.executionCtx)
})
app.post('/api/audit', async (c) => {
  return auditRoute.fetch(c.req.raw, c.env, c.executionCtx)
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '路由不存在' } }, 404))

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`🚀 opencode-server running at http://localhost:${info.port}`)
})

export default app
