import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/client.js'

// 查找实例并校验归属
// 默认只返回活跃版本（isActive=1），供 proxy 路由定位当前 Pod
// includeInactive=true 时可查任意版本（版本管理页面用）
export async function findOwnedInstance(
  userId: number,
  instanceId: number,
  includeInactive = false,
) {
  const conds = includeInactive
    ? [eq(schema.instances.id, instanceId), eq(schema.instances.ownerId, userId)]
    : [
        eq(schema.instances.id, instanceId),
        eq(schema.instances.ownerId, userId),
        eq(schema.instances.isActive, 1),
      ]
  const [inst] = await db.select().from(schema.instances).where(and(...conds)).limit(1)
  return inst ?? null
}

// sidecar / opencode 服务地址解析
// Service 名 = group_id（稳定，切版本时改 selector，不重建）
// Pod 内 opencode 在 4096，监控 sidecar 在 8080
export function sidecarServiceUrl(inst: { groupId: string; namespace: string }): string {
  return process.env.SIDECAR_BASE ??
    process.env.OPENCODE_PROXY_BASE?.replace(':4096', ':8080') ??
    `http://${inst.groupId}.${inst.namespace}.svc:8080`
}

export function instanceBaseUrl(inst: { groupId: string; namespace: string }): string {
  return process.env.OPENCODE_PROXY_BASE ?? `http://${inst.groupId}.${inst.namespace}.svc:4096`
}
