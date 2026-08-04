import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { signToken } from '../lib/jwt.js'
import { errorResponse } from '../lib/http.js'

const auth = new Hono()

const credentialsSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
})

// 注册
auth.post('/register', async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json().catch(() => ({}))
  )
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', '用户名需 3-64 字符，密码至少 6 位')
  }
  const { username, password } = parsed.data
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  if (existing.length > 0) {
    return errorResponse(c, 'USERNAME_TAKEN', '用户名已被占用', 409)
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(schema.users).values({
    username,
    passwordHash,
    createdAt: new Date(),
  })
  const token = await signToken({ sub: user.insertId, username })
  return c.json(
    {
      token,
      user: { id: user.insertId, username, createdAt: new Date().toISOString() },
    },
    201,
  )
})

// 登录
auth.post('/login', async (c) => {
  const parsed = credentialsSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', '用户名或密码错误')
  }
  const { username, password } = parsed.data
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return errorResponse(c, 'INVALID_CREDENTIALS', '用户名或密码错误', 401)
  }
  const token = await signToken({ sub: user.id, username })
  return c.json({
    token,
    user: { id: user.id, username, createdAt: String(user.createdAt) },
  })
})

export default auth
