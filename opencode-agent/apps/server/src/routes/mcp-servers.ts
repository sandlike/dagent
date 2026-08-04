import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { env } from '../env.js'
import { errorResponse } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'
import { higressFetch, genKey } from '../services/higress.js'

const mcpServers = new Hono<AppBindings>()

const createSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, '名称需小写字母/数字/中划线'),
  type: z.enum(['remote', 'local']).default('remote'),
  url: z.string().url().optional(),
  command: z.string().optional(),
  // MCP 鉴权（Bearer token，存到 Higress）
  authToken: z.string().optional(),
  headers: z.record(z.string()).optional(),
})

// 创建 MCP Server 配置（remote 类型注册到 Higress）
mcpServers.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  const { name, type, url, command, authToken, headers } = parsed.data

  let higressRouteName: string | null = null
  let higressConsumerKey: string | null = null

  if (type === 'remote' && url) {
    // 注册到 Higress：创建普通 HTTP 路由代理 MCP server
    const uniqueName = `${name}-${user.sub}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    higressRouteName = `mcp-route-${uniqueName}`
    higressConsumerKey = genKey('oma-mcp')

    try {
      // 1. 创建 upstream service（指向原始 MCP server URL）
      // 解析 URL 提取 host 和 path
      const u = new URL(url)
      const upstreamName = `mcp-upstream-${uniqueName}`

      // 创建 Service（Higress 的 domain + upstream）
      await higressFetch('/v1/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: upstreamName,
          endpoints: [{ address: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80) }],
        }),
      })

      // 2. 创建消费者（签发 OMA key）
      await higressFetch('/v1/consumers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `mcp-consumer-${uniqueName}`,
          credentials: [
            { type: 'key-auth', source: 'BEARER', values: [higressConsumerKey] },
          ],
        }),
      })

      // 3. 创建路由（MCP server 代理）
      await higressFetch('/v1/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: higressRouteName,
          path: { matchType: 'PRE', matchValue: `/mcp/${name}` },
          upstreams: [{ service: upstreamName, weight: 100 }],
          authConfig: {
            enabled: true,
            allowedCredentialTypes: ['key-auth'],
            allowedConsumers: [`mcp-consumer-${uniqueName}`],
          },
        }),
      })
    } catch (e) {
      console.warn(`Higress MCP registration failed: ${(e as Error).message}`)
    }
  }

  // 写 DB
  const [row] = await db.insert(schema.mcpServers).values({
    name,
    ownerId: user.sub,
    type,
    url: url ?? null,
    command: command ?? null,
    higressRouteName,
    higressConsumerKey,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  let id = row.insertId
  if (!id || id === 0) {
    const [fb] = await db.select().from(schema.mcpServers)
      .where(and(eq(schema.mcpServers.name, name), eq(schema.mcpServers.ownerId, user.sub)))
      .orderBy(schema.mcpServers.id).limit(1)
    id = fb?.id
  }
  const [inst] = id
    ? await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, id)).limit(1)
    : []
  return c.json({ mcpServer: inst ? toMcpServer(inst) : { name } }, 201)
})

// 列表
mcpServers.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const rows = await db.select().from(schema.mcpServers)
    .where(and(eq(schema.mcpServers.ownerId, user.sub), eq(schema.mcpServers.status, 'active')))
    .orderBy(schema.mcpServers.id)
  return c.json(rows.map((r) => toMcpServer(r)))
})

// 删除
mcpServers.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  await db.update(schema.mcpServers)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(and(eq(schema.mcpServers.id, id), eq(schema.mcpServers.ownerId, user.sub)))
  return c.json({ ok: true })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMcpServer(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url,
    command: row.command,
    status: row.status,
    // higressConsumerKey 不在列表返回
    gatewayUrl: row.higressRouteName
      ? `${env.higress.gatewayUrl.replace(/\/v1$/, '')}/mcp/${row.name}`
      : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

export default mcpServers
