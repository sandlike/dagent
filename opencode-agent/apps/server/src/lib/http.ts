import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

// 统一错误响应辅助
export function errorResponse(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
) {
  return c.json({ error: { code, message } }, status)
}

// 把数据库行映射为 API Instance
export function toInstance(row: {
  id: number
  name: string
  displayName: string
  groupId: string
  versionNum: number
  isActive: number | boolean
  ownerId: number
  namespace: string
  status: string
  configJson: string
  version: string | null
  modelId: string | null
  provider: string | null
  createdAt: string | Date
  updatedAt: string | Date
}) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    groupId: row.groupId,
    versionNum: row.versionNum,
    isActive: row.isActive ? true : false,
    ownerId: row.ownerId,
    namespace: row.namespace,
    status: row.status,
    configJson: row.configJson,
    version: row.version,
    modelId: row.modelId,
    provider: row.provider,
    sessionCount: 0,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}
