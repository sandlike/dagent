import type { Context, Next } from 'hono'
import { verifyToken, type JwtPayload } from '../lib/jwt.js'

// 把当前用户挂到 context 变量上
export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '缺少认证信息' } }, 401)
  }
  const payload = await verifyToken(m[1])
  if (!payload) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '认证已失效' } }, 401)
  }
  c.set('user', payload as JwtPayload)
  await next()
}

// SSE 专用：token 从 query 读取（EventSource 不支持自定义 header）
export async function authQueryMiddleware(c: Context, next: Next) {
  const token = c.req.query('token')
  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '缺少 token' } }, 401)
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '认证已失效' } }, 401)
  }
  c.set('user', payload as JwtPayload)
  await next()
}
