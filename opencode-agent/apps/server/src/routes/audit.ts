import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { errorResponse } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'

const audit = new Hono<AppBindings>()

const createSchema = z.object({
  instanceName: z.string().min(1),
  action: z.string().min(1),
  detail: z.string().optional(),
  level: z.enum(['info', 'warn', 'error']).default('info'),
})

// 写入审计日志（sidecar 调用）
audit.post('/', async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  const { instanceName, action, detail, level } = parsed.data
  await db.insert(schema.auditLogs).values({
    instanceName,
    action,
    detail,
    level,
    createdAt: new Date(),
  })
  return c.json({ ok: true }, 201)
})

// 查询审计日志（用户查看）
audit.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const level = c.req.query('level')
  const instanceName = c.req.query('instance')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (level && ['info', 'warn', 'error'].includes(level)) {
    conditions.push(eq(schema.auditLogs.level, level as 'info' | 'warn' | 'error'))
  }
  if (instanceName) {
    conditions.push(eq(schema.auditLogs.instanceName, instanceName))
  }

  const query = conditions.length > 0
    ? db.select().from(schema.auditLogs).where(and(...conditions)).orderBy(desc(schema.auditLogs.id)).limit(limit)
    : db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(limit)

  const rows = await query
  return c.json(rows.map((r) => ({
    id: r.id,
    instanceName: r.instanceName,
    action: r.action,
    detail: r.detail,
    level: r.level,
    createdAt: String(r.createdAt),
  })))
})

export default audit
