import client from './client'
import type { ApiResponse, AuditLog } from './types'

export const auditApi = {
  list: (params: {
    action?: string
    resource_type?: string
    trace_id?: string
    limit?: number
  } = {}) => client.get<never, ApiResponse<AuditLog[]>>('/audit-logs', { params }),
}
