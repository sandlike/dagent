import client from './client'
import type {
  ApiResponse,
  ModelCallLog,
  ModelFallbackError,
  ModelRoute,
  ModelApiProtocol,
  ModelUsage,
  Page,
  ProjectModelRoute,
  AgentModelType,
  UserAgentModelBinding,
  UserModelCallLog,
  UserModelGateway,
  UserModelQuota,
} from './types'

export interface ModelRouteInput {
  name: string
  provider: string
  model: string
  base_url: string
  api_protocol: ModelApiProtocol
  priority: number
  quota_limit: number
  timeout_ms: number
  max_retries: number
  fallback_on: ModelFallbackError[]
  agent_types: string[]
  project_ids: number[]
  environments: string[]
  credential_ref: string | null
  api_token?: string | null
  gateway_provider_ref: string | null
  gateway_route_ref: string | null
}

export interface ModelRouteTestResult {
  ok: boolean
  latency_ms: number
  health_status: ModelRoute['health_status']
  sample_models: string[]
  response_preview: string | null
  detected_api_protocol: 'chat_completions' | 'responses' | null
  message: string
}

export const modelGatewayApi = {
  myGateway: () => client.get<never, ApiResponse<UserModelGateway>>('/me/model-gateway'),
  updateMySettings: (autoFallback: boolean, resourceVersion: number) =>
    client.put<never, ApiResponse<UserModelQuota>>('/me/model-gateway/settings', {
      auto_fallback: autoFallback,
      resource_version: resourceVersion,
    }),
  updateAgentBinding: (
    agentType: AgentModelType,
    routeIds: number[],
    resourceVersion: number,
  ) =>
    client.put<never, ApiResponse<UserAgentModelBinding>>(
      `/me/agent-model-bindings/${agentType}`,
      { route_ids: routeIds, resource_version: resourceVersion },
    ),
  myLogs: (params: { page?: number; page_size?: number; route_id?: number } = {}) =>
    client.get<never, ApiResponse<Page<UserModelCallLog>>>('/me/model-call-logs', { params }),
  routes: (params: { page?: number; page_size?: number } = {}) =>
    client.get<never, ApiResponse<Page<ModelRoute>>>('/model-routes', { params }),
  createRoute: (data: ModelRouteInput) =>
    client.post<never, ApiResponse<ModelRoute>>('/model-routes', data),
  updateRoute: (id: number, data: Partial<ModelRouteInput> & { resource_version: number }) =>
    client.patch<never, ApiResponse<ModelRoute>>(`/model-routes/${id}`, data),
  testRoute: (id: number) =>
    client.post<never, ApiResponse<ModelRouteTestResult>>(`/model-routes/${id}/test`),
  enableRoute: (id: number) =>
    client.post<never, ApiResponse<ModelRoute>>(`/model-routes/${id}/enable`),
  disableRoute: (id: number) =>
    client.post<never, ApiResponse<ModelRoute>>(`/model-routes/${id}/disable`),
  resetQuota: (id: number) =>
    client.post<never, ApiResponse<ModelRoute>>(`/model-routes/${id}/quota/reset`),
  usage: (params: Record<string, number | undefined> = {}) =>
    client.get<never, ApiResponse<ModelUsage[]>>('/model-usage', { params }),
  logs: (params: { page?: number; page_size?: number; route_id?: number } = {}) =>
    client.get<never, ApiResponse<Page<ModelCallLog>>>('/model-call-logs', { params }),
  projectRoute: (projectId: number) =>
    client.get<never, ApiResponse<ProjectModelRoute>>(`/projects/${projectId}/model-route`),
  updateProjectRoute: (projectId: number, routeId: number | null, resourceVersion: number) =>
    client.put<never, ApiResponse<ProjectModelRoute>>(`/projects/${projectId}/model-route`, {
      route_id: routeId,
      resource_version: resourceVersion,
    }),
}
