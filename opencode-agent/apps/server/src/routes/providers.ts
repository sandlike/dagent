import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { errorResponse } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'
import { setupLLMProvider, removeLLMProvider } from '../services/higress.js'

const providers = new Hono<AppBindings>()

// Provider 类型 → Higress 的 type 映射 + 默认配置
const PROVIDER_TYPE_MAP: Record<string, { higressType: string; defaultUrl: string; protocol: string; modelPrefix?: string }> = {
  deepseek: { higressType: 'deepseek', defaultUrl: 'https://api.deepseek.com/v1', protocol: 'openai/v1', modelPrefix: 'deepseek' },
  openai: { higressType: 'openai', defaultUrl: 'https://api.openai.com/v1', protocol: 'openai/v1', modelPrefix: 'gpt' },
  moonshot: { higressType: 'moonshot', defaultUrl: 'https://api.moonshot.cn/v1', protocol: 'openai/v1', modelPrefix: 'moonshot' },
  qwen: { higressType: 'qwen', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai/v1', modelPrefix: 'qwen' },
  custom: { higressType: 'openai', defaultUrl: '', protocol: 'openai/v1' },
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  template: z.string().min(1),
  apiKey: z.string().min(1), // 真实 upstream key（存到 Higress，不进 DB）
  baseUrl: z.string().url().optional(), // 可选，覆盖默认 upstream 地址
  models: z.array(z.string()).optional(),
})

// 创建 LLM Provider（注册到 Higress）
providers.post('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  const { name, template, apiKey, baseUrl, models } = parsed.data

  const typeConfig = PROVIDER_TYPE_MAP[template]
  if (!typeConfig) {
    return errorResponse(c, 'INVALID_INPUT', `不支持的 provider 类型：${template}`)
  }

  // 唯一名（同用户下唯一，全小写避免 K8s Ingress 名限制）
  const uniqueName = `${name}-${user.sub}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  try {
    // 注册到 Higress
    const result = await setupLLMProvider({
      name: uniqueName,
      type: typeConfig.higressType,
      apiKey,
      apiUrl: baseUrl ?? typeConfig.defaultUrl,
      protocol: typeConfig.protocol,
      modelPrefix: typeConfig.modelPrefix,
    })

    // 写 DB（不存真实 key，只存 Higress 路由信息 + OMA key）
    const [row] = await db.insert(schema.providers).values({
      name,
      ownerId: user.sub,
      template,
      higressProviderName: result.providerName,
      higressRouteName: result.routeName,
      higressConsumerKey: result.consumerKey,
      baseUrl: baseUrl ?? typeConfig.defaultUrl,
      models: models ? JSON.stringify(models) : null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    let id = row.insertId
    if (!id || id === 0) {
      // 回退查询
      const [fallback] = await db
        .select()
        .from(schema.providers)
        .where(and(eq(schema.providers.name, name), eq(schema.providers.ownerId, user.sub)))
        .orderBy(schema.providers.id)
        .limit(1)
      id = fallback?.id
    }
    const [inst] = id
      ? await db.select().from(schema.providers).where(eq(schema.providers.id, id)).limit(1)
      : await db.select().from(schema.providers)
          .where(and(eq(schema.providers.name, name), eq(schema.providers.ownerId, user.sub)))
          .orderBy(schema.providers.id).limit(1)
    return c.json({ provider: toProvider(inst) }, 201)
  } catch (e) {
    return errorResponse(c, 'HIGRESS_ERROR', `Higress 注册失败：${(e as Error).message}`, 502)
  }
})

// 列表（仅当前用户）
providers.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const rows = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.ownerId, user.sub), eq(schema.providers.status, 'active')))
    .orderBy(schema.providers.id)
  return c.json(rows.map(toProvider))
})

// 详情
providers.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [inst] = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, id), eq(schema.providers.ownerId, user.sub)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', 'Provider 不存在', 404)
  return c.json(toProvider(inst))
})

// 更新 Provider（当前仅支持改 models 列表，Higress 资源不动）
providers.put('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const models = Array.isArray(body.models) ? body.models.filter((m: unknown) => typeof m === 'string' && m.trim()) : null
  if (!models) {
    return errorResponse(c, 'INVALID_INPUT', 'models 必须是字符串数组')
  }
  const [inst] = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, id), eq(schema.providers.ownerId, user.sub)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', 'Provider 不存在', 404)
  await db
    .update(schema.providers)
    .set({ models: JSON.stringify(models), updatedAt: new Date() })
    .where(eq(schema.providers.id, id))
  return c.json({ ok: true, models })
})

// 测试连通性：用 OMA consumer key 调 Higress gateway 的 /v1/models
providers.post('/:id/test', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [inst] = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, id), eq(schema.providers.ownerId, user.sub), eq(schema.providers.status, 'active')))
    .limit(1)
  if (!inst || !inst.higressConsumerKey) {
    return errorResponse(c, 'NOT_FOUND', 'Provider 不存在或未配置完成', 404)
  }
  const gatewayUrl = process.env.HIGRESS_GATEWAY_URL ?? 'http://higress-gateway.higress-system.svc:80'
  const start = Date.now()
  try {
    // 先试 /v1/models（轻量），失败再降级到最小 chat completions
    let r = await fetch(`${gatewayUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${inst.higressConsumerKey}` },
      signal: AbortSignal.timeout(10000),
    })
    let sampleModels: string[] | undefined
    if (r.ok) {
      const mj = await r.json().catch(() => ({}))
      const data = mj?.data ?? mj?.models ?? []
      if (Array.isArray(data)) {
        sampleModels = data.slice(0, 8).map((m: any) => m.id ?? m.name ?? String(m)).filter(Boolean)
      }
    } else {
      // 降级：用第一个 model 发最小 chat 请求
      const models = inst.models ? JSON.parse(inst.models) : []
      const probeModel = models[0]
      if (!probeModel) {
        return c.json({ ok: false, latencyMs: Date.now() - start, error: `网关返回 ${r.status} 且无模型可探测` })
      }
      r = await fetch(`${gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${inst.higressConsumerKey}` },
        body: JSON.stringify({ model: probeModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        return c.json({ ok: false, latencyMs: Date.now() - start, error: `网关返回 ${r.status}: ${errText.slice(0, 200)}` })
      }
    }
    return c.json({ ok: true, latencyMs: Date.now() - start, sampleModels })
  } catch (e) {
    return c.json({ ok: false, latencyMs: Date.now() - start, error: (e as Error).message })
  }
})

// 删除（级联删 Higress 资源）
providers.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [inst] = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, id), eq(schema.providers.ownerId, user.sub)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', 'Provider 不存在', 404)

  // 删 Higress 资源
  if (inst.higressProviderName) {
    const uniqueName = `${inst.name}-${user.sub}`
    await removeLLMProvider(uniqueName).catch(() => undefined)
  }

  // 软删除
  await db
    .update(schema.providers)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(schema.providers.id, id))
  return c.json({ ok: true })
})

// Provider 行 → API 返回（不暴露 consumer key 给列表，详情才给）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProvider(row: any) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    template: row.template,
    baseUrl: row.baseUrl,
    models: row.models ? JSON.parse(row.models) : [],
    status: row.status,
    // consumerKey 不在列表返回，创建实例时后端自取
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

// 内部用：查 provider 的 consumer key（给 deployInstance 用，不暴露给前端）
export async function getProviderConsumerKey(providerId: number, userId: number): Promise<{
  consumerKey: string
  gatewayUrl: string
  template: string
} | null> {
  const [row] = await db
    .select()
    .from(schema.providers)
    .where(and(eq(schema.providers.id, providerId), eq(schema.providers.ownerId, userId), eq(schema.providers.status, 'active')))
    .limit(1)
  if (!row || !row.higressConsumerKey) return null
  return {
    consumerKey: row.higressConsumerKey,
    gatewayUrl: `${process.env.HIGRESS_GATEWAY_URL ?? 'http://higress-gateway.higress-system.svc:80'}/v1`,
    template: row.template,
  }
}

export default providers
