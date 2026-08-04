import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { env } from './env.js'
import skillsRoute from './routes/skills.js'
import monitorRoute from './routes/monitor.js'
import auditRoute from './routes/audit.js'
import a2aRoute from './routes/a2a.js'
import { registerAgent, deregisterAgent } from './services/nacos.js'
import { inc, observe, renderMetrics } from './services/metrics.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

// 请求埋点中间件
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  const path = c.req.path
  const method = c.req.method
  const status = String(c.res.status)
  // 统计每个请求的计数和延迟
  inc('http_requests_total', { method, path, status }, 'Total HTTP requests')
  observe('http_request_duration', ms, { method, path, status, _metric: 'http_request_duration_ms' })
})

// 健康检查
app.get('/health', (c) => {
  inc('health_checks_total', {}, 'Health check count')
  return c.json({ ok: true, service: 'opencode-sidecar', skillsDir: env.skillsDir })
})

// Prometheus metrics 端点
app.get('/metrics', (c) => {
  return c.text(renderMetrics(), 200, { 'Content-Type': 'text/plain; version=0.0.4' })
})

app.route('/skills', skillsRoute)
app.route('/monitor', monitorRoute)
app.route('/audit', auditRoute)
// A2A 协议适配层（agent card + message/send + tasks）
app.route('/', a2aRoute)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: '路由不存在' } }, 404))

serve({ fetch: app.fetch, port: env.port }, async (info) => {
  console.log(`🛠️  opencode-sidecar running at http://localhost:${info.port}`)
  console.log(`   skillsDir:  ${env.skillsDir}`)
  console.log(`   opencodeBase: ${env.opencodeBase}`)

  // 自动注册到 Nacos Agent Registry（A2A 发现）
  const agentName = process.env.AGENT_NAME ?? 'opencode-agent'
  try {
    await registerAgent({
      serviceName: `oma-agent::${agentName}`,
      ip: process.env.POD_IP ?? '127.0.0.1',
      port: info.port,
      metadata: { agentName, a2a: 'true' },
    })
  } catch (e) {
    console.warn(`   Nacos registration skipped: ${(e as Error).message}`)
  }
})

// 优雅关闭：注销 Nacos 注册
process.on('SIGTERM', async () => {
  const agentName = process.env.AGENT_NAME ?? 'opencode-agent'
  await deregisterAgent(`oma-agent::${agentName}`, process.env.POD_IP ?? '127.0.0.1', env.port)
  process.exit(0)
})

export default app
