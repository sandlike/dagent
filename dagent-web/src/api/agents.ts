import client from './client'
import type { AgentDefinition, AgentVersion, ApiResponse } from './types'

export interface AgentDefinitionCreate {
  role_type: 'requirement_clarification' | 'development'
  name: string
  default_flag: boolean
}

export interface AgentVersionCreate {
  style: string
  prompt_ref: string
  skill_policy: string[]
  mcp_policy: Record<string, unknown>
  tool_policy: Record<string, unknown>
}

export const agentApi = {
  list: () => client.get<never, ApiResponse<AgentDefinition[]>>('/agent-definitions'),
  create: (data: AgentDefinitionCreate) =>
    client.post<never, ApiResponse<AgentDefinition>>('/agent-definitions', data),
  update: (id: number, data: Partial<Pick<AgentDefinitionCreate, 'name' | 'default_flag'>>) =>
    client.patch<never, ApiResponse<AgentDefinition>>(`/agent-definitions/${id}`, data),
  createVersion: (id: number, data: AgentVersionCreate) =>
    client.post<never, ApiResponse<AgentVersion>>(`/agent-definitions/${id}/versions`, data),
  publish: (id: number, versionId: number) =>
    client.post<never, ApiResponse<AgentDefinition>>(`/agent-definitions/${id}/publish`, {
      version_id: versionId,
    }),
  disable: (id: number) =>
    client.post<never, ApiResponse<AgentDefinition>>(`/agent-definitions/${id}/disable`),
  skills: () => client.get<never, ApiResponse<{ name: string; status: string }[]>>('/skills'),
  mcpServers: () =>
    client.get<never, ApiResponse<{ name: string; status: unknown }[]>>('/mcp-servers'),
}
