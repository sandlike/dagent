import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq, max } from 'drizzle-orm'
import { db, schema } from '../db/client.js'
import { env } from '../env.js'
import { errorResponse, toInstance } from '../lib/http.js'
import { AppBindings } from '../lib/types.js'
import type { JwtPayload } from '../lib/jwt.js'
import {
  deployInstanceVersion,
  deleteInstanceGroup,
  restartInstance,
  rollbackInstance,
} from '../services/k8s.js'
import { getProviderConsumerKey } from './providers.js'
import { randomShortId } from '../lib/ids.js'

const instances = new Hono<AppBindings>()

const deploySchema = z.object({
  displayName: z.string().min(1).max(128),
  configJson: z.string().min(1),
  provider: z.string().default(''),
  modelId: z.string().default(''),
  version: z.string().default('1.15.12'),
  agentType: z.string().default('opencode'),
  providerId: z.number().int().positive().optional(),
})

// 改写 configJson：provider 指向 Higress gateway，apiKey 用 OMA consumer key
// 返回 [改写后的 configJson, 需注入 Secret 的数据]
function rewriteConfigForHigress(
  configJson: string,
  pk: { consumerKey: string; gatewayUrl: string } | null,
): { configJson: string; secretData: Record<string, string> } {
  const secretData: Record<string, string> = {}
  if (pk) {
    try {
      const cfg = JSON.parse(configJson)
      const providerKey = Object.keys(cfg.provider ?? {})[0]
      if (providerKey) {
        cfg.provider[providerKey].options = cfg.provider[providerKey].options ?? {}
        cfg.provider[providerKey].options.baseURL = pk.gatewayUrl
        cfg.provider[providerKey].options.apiKey = '{env:OMA_LLM_KEY}'
      }
      configJson = JSON.stringify(cfg)
    } catch {
      // 解析失败保持原样
    }
    secretData['OMA_LLM_KEY'] = pk.consumerKey
    return { configJson, secretData }
  }
  // 没有 providerId，走旧逻辑（从配置提取明文 key）
  try {
    const cfg = JSON.parse(configJson)
    for (const [, pv] of Object.entries<any>(cfg.provider ?? {})) {
      const opts = pv?.options ?? {}
      for (const [k, v] of Object.entries(opts)) {
        const m = String(v).match(/^\{env:(.+)\}$/)
        if (k.toLowerCase().includes('key') || k.toLowerCase().includes('token')) {
          if (!m) secretData[k] = String(v)
        }
      }
    }
  } catch {}
  return { configJson, secretData }
}

// 部署实例（首次部署 = group v1）
instances.post('/deploy', async (c) => {
  const user = c.get('user') as JwtPayload
  const parsed = deploySchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  const { displayName, provider, modelId, agentType, providerId } = parsed.data
  let { configJson } = parsed.data
  const namespace = env.instanceNamespace

  // Higress 改写
  let pk: { consumerKey: string; gatewayUrl: string; template: string } | null = null
  if (providerId) {
    pk = await getProviderConsumerKey(providerId, user.sub)
    if (!pk) {
      return errorResponse(c, 'NOT_FOUND', '关联的 Provider 不存在或已删除', 404)
    }
  }
  const { configJson: rewritten, secretData } = rewriteConfigForHigress(configJson, pk)
  configJson = rewritten

  // 生成稳定 group_id（短 UUID，K8s 资源名友好）
  const groupId = `ag-${randomShortId()}`
  const versionNum = 1
  const name = `${groupId}-v${versionNum}`

  // 写库
  const [row] = await db.insert(schema.instances).values({
    name,
    displayName,
    groupId,
    versionNum,
    isActive: 1,
    ownerId: user.sub,
    namespace,
    status: 'deploying',
    configJson,
    version: agentType,
    provider,
    modelId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  let id = row.insertId
  if (!id || id === 0) {
    const [fallback] = await db
      .select()
      .from(schema.instances)
      .where(and(eq(schema.instances.name, name), eq(schema.instances.ownerId, user.sub)))
      .orderBy(schema.instances.id)
      .limit(1)
    id = fallback?.id
  }

  // 部署到 K8s
  const result = await deployInstanceVersion({
    groupId,
    displayName,
    versionNum,
    namespace,
    configJson,
    secretData,
    ownerId: user.sub,
    agentType,
  })
  const finalStatus = result.deployed ? 'running' : 'stopped'
  if (id) {
    await db
      .update(schema.instances)
      .set({ status: finalStatus, updatedAt: new Date() })
      .where(eq(schema.instances.id, id))
  }

  const [inst] = id
    ? await db.select().from(schema.instances).where(eq(schema.instances.id, id)).limit(1)
    : await db.select().from(schema.instances)
        .where(and(eq(schema.instances.name, name), eq(schema.instances.ownerId, user.sub)))
        .orderBy(schema.instances.id)
        .limit(1)
  return c.json({ instance: toInstance(inst) }, 201)
})

// 更新配置 = 部署新版本（同 group，version+1）
// 同时解决 #7：权限 allow↔ask 修改随新版本 ConfigMap 生效
instances.put('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const parsed = deploySchema.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return errorResponse(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误')
  }
  // 取当前实例（必须是 owner 的，且当前活跃）
  const [cur] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub), eq(schema.instances.isActive, 1)))
    .limit(1)
  if (!cur) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)

  // 新版本号 = 同 group max + 1
  const [maxRow] = await db
    .select({ mv: max(schema.instances.versionNum) })
    .from(schema.instances)
    .where(eq(schema.instances.groupId, cur.groupId))
  const newVersionNum = (maxRow?.mv ?? 0) + 1
  const groupId = cur.groupId
  const namespace = cur.namespace
  const newName = `${groupId}-v${newVersionNum}`

  // 合并新配置
  const displayName = parsed.data.displayName ?? cur.displayName
  const agentType = parsed.data.agentType ?? cur.version ?? 'opencode'
  const provider = parsed.data.provider ?? cur.provider ?? ''
  const modelId = parsed.data.modelId ?? cur.modelId ?? ''
  let configJson = parsed.data.configJson ?? cur.configJson
  const providerId = parsed.data.providerId

  // Higress 改写（若有 providerId）
  let pk: { consumerKey: string; gatewayUrl: string; template: string } | null = null
  if (providerId) {
    pk = await getProviderConsumerKey(providerId, user.sub)
    if (!pk) return errorResponse(c, 'NOT_FOUND', '关联的 Provider 不存在或已删除', 404)
  } else {
    // 沿用旧版本的 secret（重建同名环境变量）
    pk = null
  }
  const { configJson: rewritten, secretData } = rewriteConfigForHigress(configJson, pk)
  configJson = rewritten

  // 若没改 provider，需要保留旧版本的 OMA_LLM_KEY（从原 configJson 提取 baseURL/apiKey 占位即可，
  // 真实 consumerKey 不在 DB——这种情况下沿用旧 Secret 名的环境变量来源）
  // 简化处理：若没有 providerId 且 secretData 为空，则从旧版本 DB 行无法拿 key，
  // 此时复用旧版本的 Secret 资源（新版本 Deployment envFrom 指向新 secret 名会拿不到）
  // → 改为：新版本 Deployment 复用旧 secret 名（若没 providerId）
  let secretRefName = `${newName}-secret`
  if (!providerId && Object.keys(secretData).length === 0) {
    // 复用旧版本 Secret：新 Deployment 仍引用旧 secret 名
    secretRefName = `${cur.name}-secret`
  }

  // 写库（新版本行，is_active=1）
  const [row] = await db.insert(schema.instances).values({
    name: newName,
    displayName,
    groupId,
    versionNum: newVersionNum,
    isActive: 1,
    ownerId: user.sub,
    namespace,
    status: 'deploying',
    configJson,
    version: agentType,
    provider,
    modelId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  let newId = row.insertId
  if (!newId || newId === 0) {
    const [fallback] = await db
      .select()
      .from(schema.instances)
      .where(and(eq(schema.instances.name, newName), eq(schema.instances.ownerId, user.sub)))
      .orderBy(schema.instances.id)
      .limit(1)
    newId = fallback?.id
  }

  // 旧版本标记 is_active=0（K8s 旧 Deployment 由 deployInstanceVersion 内部 scale down）
  await db
    .update(schema.instances)
    .set({ isActive: 0, updatedAt: new Date() })
    .where(eq(schema.instances.id, id))

  // 部署新版本（复用 PVC，scale down 旧版本，patch Service）
  const result = await deployInstanceVersion({
    groupId,
    displayName,
    versionNum: newVersionNum,
    namespace,
    configJson,
    secretData,
    ownerId: user.sub,
    agentType,
  })
  const finalStatus = result.deployed ? 'running' : 'stopped'
  if (newId) {
    await db
      .update(schema.instances)
      .set({ status: finalStatus, updatedAt: new Date() })
      .where(eq(schema.instances.id, newId))
  }

  const [inst] = await db.select().from(schema.instances).where(eq(schema.instances.id, newId)).limit(1)
  return c.json({ instance: toInstance(inst), message: result.message })
})

// 列表（仅当前用户 + 仅活跃版本）
instances.get('/', async (c) => {
  const user = c.get('user') as JwtPayload
  const rows = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.ownerId, user.sub), eq(schema.instances.isActive, 1)))
    .orderBy(schema.instances.id)
  return c.json(rows.map(toInstance))
})

// 详情（可查任意版本，但必须 owner）
instances.get('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return errorResponse(c, 'NOT_FOUND', '实例不存在', 404)
  const [inst] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)
  return c.json(toInstance(inst))
})

// 版本列表（同 group 所有版本）
instances.get('/:id/versions', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [cur] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub)))
    .limit(1)
  if (!cur) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)
  const rows = await db
    .select()
    .from(schema.instances)
    .where(eq(schema.instances.groupId, cur.groupId))
    .orderBy(schema.instances.versionNum)
  return c.json(rows.map(toInstance))
})

// 回滚到指定版本
instances.post('/:id/rollback', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const targetVersion = Number(body.versionNum)
  if (!Number.isFinite(targetVersion) || targetVersion < 1) {
    return errorResponse(c, 'INVALID_INPUT', 'versionNum 参数错误')
  }
  const [cur] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub)))
    .limit(1)
  if (!cur) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)

  // 确认目标版本存在
  const [target] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.groupId, cur.groupId), eq(schema.instances.versionNum, targetVersion)))
    .limit(1)
  if (!target) return errorResponse(c, 'NOT_FOUND', `版本 v${targetVersion} 不存在`, 404)

  const result = await rollbackInstance(cur.groupId, targetVersion, cur.namespace)
  if (!result.deployed) {
    return errorResponse(c, 'K8S_ERROR', result.message, 502)
  }

  // 更新 DB：目标版本 is_active=1，其他 is_active=0
  await db
    .update(schema.instances)
    .set({ isActive: 0, updatedAt: new Date() })
    .where(eq(schema.instances.groupId, cur.groupId))
  await db
    .update(schema.instances)
    .set({ isActive: 1, status: 'running', updatedAt: new Date() })
    .where(eq(schema.instances.id, target.id))

  return c.json({ ok: true, message: result.message, activeVersionNum: targetVersion })
})

// 删除（删整个 group + PVC）
instances.delete('/:id', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [inst] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)
  await deleteInstanceGroup(inst.groupId, inst.namespace)
  // 删 DB 里同 group 所有版本
  await db.delete(schema.instances).where(eq(schema.instances.groupId, inst.groupId))
  return c.json({ ok: true })
})

// 重启（按当前版本的 Deployment 名）
instances.post('/:id/restart', async (c) => {
  const user = c.get('user') as JwtPayload
  const id = Number(c.req.param('id'))
  const [inst] = await db
    .select()
    .from(schema.instances)
    .where(and(eq(schema.instances.id, id), eq(schema.instances.ownerId, user.sub), eq(schema.instances.isActive, 1)))
    .limit(1)
  if (!inst) return errorResponse(c, 'NOT_FOUND', '实例不存在或无权访问', 404)
  await restartInstance(inst.name, inst.namespace)
  await db
    .update(schema.instances)
    .set({ updatedAt: new Date() })
    .where(eq(schema.instances.id, id))
  return c.json({ ok: true })
})

export default instances
