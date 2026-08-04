import client, { idempotencyHeaders } from './client'
import type {
  AgentDefinition,
  AgentTask,
  ApiResponse,
  ArtifactSummary,
  ArtifactVersion,
  ClarificationRound,
  Page,
  PipelineDetail,
  PriorityCode,
  Requirement,
  RequirementWorkspace,
  ReviewGate,
  ReviewRecord,
  TaskLog,
  MergeCheckResult,
  MergeQueueEntry,
} from './types'

export interface RequirementCreate {
  project_id: number
  title: string
  description: string
  priority: PriorityCode
  repository_ids: number[]
  requirement_agent_version_id?: number
  development_agent_version_id?: number
}

export interface ReviewPayload {
  action: 'approve' | 'reject' | 'transfer'
  comment: string
  artifact_version: number
  assignee_id?: number
  resource_version: number
  final_confirmation?: boolean
}

export const requirementApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    client.get<never, ApiResponse<Page<Requirement>>>('/requirements', { params }),
  detail: (id: number) => client.get<never, ApiResponse<Requirement>>(`/requirements/${id}`),
  create: (data: RequirementCreate) =>
    client.post<never, ApiResponse<Requirement>>('/requirements', data, {
      headers: idempotencyHeaders(),
    }),
  update: (id: number, data: Partial<RequirementCreate> & { resource_version: number }) =>
    client.patch<never, ApiResponse<Requirement>>(`/requirements/${id}`, data),
  submit: (id: number, resourceVersion: number) =>
    client.post<never, ApiResponse<Requirement>>(`/requirements/${id}/submit`, {
      resource_version: resourceVersion,
    }),
  pause: (id: number, resourceVersion: number) =>
    client.post<never, ApiResponse<Requirement>>(`/requirements/${id}/pause`, {
      resource_version: resourceVersion,
    }),
  resume: (id: number, resourceVersion: number) =>
    client.post<never, ApiResponse<Requirement>>(`/requirements/${id}/resume`, {
      resource_version: resourceVersion,
    }),
  cancel: (id: number, resourceVersion: number, reason: string) =>
    client.post<never, ApiResponse<Requirement>>(`/requirements/${id}/cancel`, {
      resource_version: resourceVersion,
      reason,
      confirmed: true,
    }),
  pipeline: (id: number) =>
    client.get<never, ApiResponse<PipelineDetail>>(`/requirements/${id}/pipeline`),
  actions: (id: number) => client.get<never, ApiResponse<string[]>>(`/requirements/${id}/actions`),
  clarificationRounds: (id: number) =>
    client.get<never, ApiResponse<ClarificationRound[]>>(
      `/requirements/${id}/clarification/rounds`,
    ),
  generateClarification: (id: number) =>
    client.post<never, ApiResponse<AgentTask>>(
      `/requirements/${id}/clarification/generate`,
      undefined,
      { headers: idempotencyHeaders() },
    ),
  submitAnswers: (
    id: number,
    data: { resource_version: number; answers: { question_id: number; answer: unknown }[] },
  ) =>
    client.post<never, ApiResponse<{ round_id: number; status: string; resource_version: number }>>(
      `/requirements/${id}/clarification/answers`,
      data,
    ),
  confirmClarification: (id: number, resourceVersion: number, requirementDocument: unknown) =>
    client.post<never, ApiResponse<Requirement>>(`/requirements/${id}/clarification/confirm`, {
      resource_version: resourceVersion,
      requirement_document: requirementDocument,
    }),
  artifacts: (id: number) =>
    client.get<never, ApiResponse<ArtifactSummary[]>>(`/requirements/${id}/artifacts`),
  artifactVersions: (id: number, type: string) =>
    client.get<never, ApiResponse<ArtifactVersion[]>>(
      `/requirements/${id}/artifacts/${type}/versions`,
    ),
  reviseArtifact: (id: number, type: string, resourceVersion: number, content: unknown, comment: string) =>
    client.post<never, ApiResponse<{ version: number; resource_version: number }>>(
      `/requirements/${id}/artifacts/${type}/revise`,
      { resource_version: resourceVersion, content, comment },
    ),
  reviews: (id: number) =>
    client.get<never, ApiResponse<ReviewRecord[]>>(`/requirements/${id}/reviews`),
  review: (id: number, gate: ReviewGate, data: ReviewPayload) =>
    client.post<never, ApiResponse<{ review_id: number; stage: string; resource_version: number }>>(
      `/requirements/${id}/reviews/${gate}`,
      data,
      { headers: idempotencyHeaders() },
    ),
  tasks: (id: number) =>
    client.get<never, ApiResponse<AgentTask[]>>(`/requirements/${id}/tasks`),
  startTask: (id: number, inputSummary: string) =>
    client.post<never, ApiResponse<AgentTask>>(
      `/requirements/${id}/tasks`,
      { input_summary: inputSummary },
      { headers: idempotencyHeaders() },
    ),
  retryTask: (taskId: number) =>
    client.post<never, ApiResponse<AgentTask>>(`/agent-tasks/${taskId}/retry`, undefined, {
      headers: idempotencyHeaders(),
    }),
  cancelTask: (taskId: number) =>
    client.post<never, ApiResponse<AgentTask>>(`/agent-tasks/${taskId}/cancel`),
  taskLogs: (taskId: number) =>
    client.get<never, ApiResponse<Page<TaskLog>>>(`/agent-tasks/${taskId}/logs`, {
      params: { page: 1, page_size: 500 },
    }),
  agentDefinitions: () =>
    client.get<never, ApiResponse<AgentDefinition[]>>('/agent-definitions'),
  workspaces: (id: number) =>
    client.get<never, ApiResponse<RequirementWorkspace[]>>(`/requirements/${id}/workspace`),
  pushWorkspace: (id: number, workspaceId: number) =>
    client.post<never, ApiResponse<RequirementWorkspace>>(
      `/requirements/${id}/workspace/${workspaceId}/push`,
    ),
  mergeCheck: (id: number, workspaceId: number, targetBranch?: string) =>
    client.post<never, ApiResponse<MergeCheckResult>>(`/requirements/${id}/merge-check`, {
      workspace_id: workspaceId,
      target_branch: targetBranch,
    }),
  mergeQueue: (id: number) =>
    client.get<never, ApiResponse<MergeQueueEntry[]>>(`/requirements/${id}/merge-queue`),
  merge: (id: number, workspaceId: number, targetBranch?: string) =>
    client.post<never, ApiResponse<MergeQueueEntry>>(
      `/requirements/${id}/merge-queue`,
      { workspace_id: workspaceId, target_branch: targetBranch },
      { headers: idempotencyHeaders() },
    ),
  streamEvents: async (id: number, onUpdate: () => void, signal: AbortSignal) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/v1/requirements/${id}/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
    if (!response.ok || !response.body) throw new Error('实时事件连接失败')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() || ''
      for (const frame of frames) {
        if (frame.includes('event: requirement.updated')) onUpdate()
      }
    }
  },
}
