import { Hono } from 'hono'
import { readAudit } from '../lib/audit-log.js'

const audit = new Hono()

// 查询审计日志（?limit=N，最近 N 条）
audit.get('/', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 1000)
  return c.json(readAudit(limit))
})

export default audit
