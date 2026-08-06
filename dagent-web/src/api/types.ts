export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type RoleCode = 'admin' | 'pm' | 'developer' | 'qa'
export type PriorityCode = 'P0' | 'P1' | 'P2' | 'P3'
export type RunStatus = 'idle' | 'running' | 'waiting_human' | 'paused' | 'failed' | 'cancelled'
export type StageCode =
  | 'requirement_draft'
  | 'requirement_clarification'
  | 'development_document_generation'
  | 'development_document_review'
  | 'development'
  | 'development_report_review'
  | 'test_plan_generation'
  | 'test_plan_review'
  | 'final_acceptance'
  | 'completed'

export type ReviewGate =
  | 'development_document'
  | 'development_report'
  | 'test_plan'
  | 'final_acceptance'

export interface User {
  id: number
  username: string
  email: string
  role: RoleCode
  roles: RoleCode[]
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_at: string
  user: User
}

export interface DashboardSummary {
  project_count: number
  requirement_count: number
  waiting_human_count: number
  running_task_count: number
  waiting_merge_count: number
}

export interface Project {
  id: number
  name: string
  description: string
  owner_id: number
  status: 'active' | 'archived'
  version: number
  repository_count: number
  requirement_count: number
  created_at: string
  updated_at: string
}

export interface Repository {
  id: number
  name: string
  provider: string
  url: string
  default_branch: string
  status: 'unverified' | 'verified' | string
  credential_configured: boolean
  last_verified_at: string | null
  created_at: string
}

export type RepositoryVerificationResult =
  | 'read_success'
  | 'read_write_success'
  | 'token_invalid'
  | 'no_write_permission'
  | 'read_failed'

export interface RepositoryVerification {
  repository: Repository
  result: RepositoryVerificationResult
  read_verified: boolean
  write_verified: boolean
  credential_configured: boolean
  message: string
}

export interface Requirement {
  id: number
  project_id: number
  title: string
  description: string
  priority: PriorityCode
  stage: StageCode
  run_status: RunStatus
  version: number
  created_by: number
  assignee_id: number | null
  requirement_agent_version_id: number | null
  development_agent_version_id: number | null
  repository_ids: number[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface StageHistory {
  id: number
  from_stage: StageCode
  to_stage: StageCode
  trigger: string
  operator_type: string
  operator_id: number | null
  reason: string
  artifact_versions: Record<string, number>
  created_at: string
}

export interface PipelineDetail {
  requirement_id: number
  current_stage: StageCode
  run_status: RunStatus
  resource_version: number
  history: StageHistory[]
}

export interface ClarificationOption {
  id: string
  label: string
  description?: string
}

export interface ClarificationAnswer {
  user_id: number
  answer: unknown
  created_at: string
}

export interface ClarificationQuestion {
  id: number
  question: string
  type: 'single' | 'multiple' | 'text' | 'file'
  required: boolean
  options: ClarificationOption[]
  ai_recommendation: string
  answers: ClarificationAnswer[]
}

export interface ClarificationRound {
  id: number
  round_no: number
  status: 'pending_answers' | 'answered' | 'confirmed'
  questions: ClarificationQuestion[]
  created_at: string
}

export interface ArtifactSummary {
  id: number
  type: string
  current_version: number
  created_at: string
  updated_at: string
}

export interface ArtifactVersion {
  version: number
  content: unknown
  source: string
  source_ref: string | null
  checksum: string
  created_by: number | null
  created_at: string
}

export interface ReviewRecord {
  id: number
  gate: ReviewGate
  action: 'approve' | 'reject' | 'transfer'
  artifact_version: number
  reviewer_id: number
  assignee_id: number | null
  comment: string
  from_stage: StageCode
  to_stage: StageCode
  resource_version: number
  created_at: string
}

export interface AgentTask {
  id: number
  requirement_id: number
  parent_task_id: number | null
  stage: StageCode
  task_type: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  agent_version_id: number | null
  idempotency_key: string
  checkpoint: Record<string, unknown>
  input_summary: string
  output_summary: string
  error_message: string
  retry_count: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface TaskLog {
  id: number
  level: string
  message: string
  created_at: string
}

export interface AgentVersion {
  id: number
  version: number
  style: string
  prompt_ref: string
  skill_policy: string[]
  mcp_policy: Record<string, unknown>
  tool_policy: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

export interface AgentDefinition {
  id: number
  role_type: 'requirement_clarification' | 'development'
  name: string
  status: string
  default_flag: boolean
  versions: AgentVersion[]
  created_at: string
  updated_at: string
}

export interface RequirementWorkspace {
  id: number
  requirement_id: number
  repository_id: number
  path: string
  base_branch: string
  branch_name: string
  baseline_commit: string
  head_commit: string
  status: string
  changed_files: string[]
  pull_request_url: string | null
  last_error: string
  version: number
  created_at: string
  updated_at: string
}

export interface MergeCheckResult {
  workspace_id: number
  can_merge: boolean
  target_branch: string
  conflict_files: string[]
  message: string
}

export interface MergeQueueEntry {
  id: number
  requirement_id: number
  workspace_id: number
  target_branch: string
  status: string
  conflict_files: string[]
  error_message: string
  idempotency_key: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  actor_id: number | null
  actor_type: string
  action: string
  resource_type: string
  resource_id: string
  result: string
  details: Record<string, unknown>
  trace_id: string
  created_at: string
}

export type ModelRouteStatus = 'active' | 'disabled'
export type ModelHealthStatus = 'unknown' | 'healthy' | 'unhealthy'
export type ModelApiProtocol = 'auto' | 'chat_completions' | 'responses'
export type DetectedModelApiProtocol = 'chat_completions' | 'responses'
export type ModelFallbackError = 'quota_exhausted' | 'rate_limited' | 'timeout' | 'server_error' | 'authentication_error'

export interface ModelRoute {
  id: number
  name: string
  provider: string
  model: string
  base_url: string
  api_protocol: ModelApiProtocol
  detected_api_protocol: DetectedModelApiProtocol | null
  priority: number
  quota_limit: number
  quota_reserved: number
  quota_used: number
  quota_remaining: number
  reset_policy: 'manual'
  timeout_ms: number
  max_retries: number
  fallback_on: ModelFallbackError[]
  agent_types: string[]
  project_ids: number[]
  environments: string[]
  credential_ref: string | null
  credential_configured: boolean
  gateway_provider_ref: string | null
  gateway_route_ref: string | null
  status: ModelRouteStatus
  health_status: ModelHealthStatus
  last_checked_at: string | null
  last_called_at: string | null
  call_count?: number
  version: number
  created_at: string
  updated_at: string
}

export interface ModelUsage {
  route_id: number
  route_name: string
  provider: string
  model: string
  quota_limit: number
  reserved_tokens: number
  input_tokens: number
  output_tokens: number
  released_tokens: number
  used_tokens: number
  remaining_tokens: number
  call_count: number
}

export interface ModelCallLog {
  id: number
  route_id: number
  task_id: number | null
  project_id: number | null
  requirement_id: number | null
  request_id: string
  trace_id: string
  attempt_no: number
  status: string
  error_type: string | null
  error_code: string | null
  latency_ms: number
  input_tokens: number
  output_tokens: number
  estimated_input_tokens: number
  output_token_budget: number
  reserved_tokens: number
  released_tokens: number
  usage_estimated: boolean
  fallback_from_route_id: number | null
  fallback_reason: string | null
  created_at: string
}

export interface ProjectModelRoute {
  project_id: number
  route_id: number | null
  route_name: string | null
  resource_version: number
}

export type AgentModelType = 'requirement_clarification' | 'development'

export interface UserModelQuota {
  quota_limit: number
  quota_reserved: number
  quota_used: number
  quota_remaining: number | null
  reset_at: string | null
  hard_limit_enabled: boolean
  auto_fallback: boolean
  resource_version: number
}

export interface AgentModelRoute {
  id: number
  name: string
  provider: string
  model: string
  base_url?: string
  api_protocol: ModelApiProtocol
  detected_api_protocol: DetectedModelApiProtocol | null
  priority: number
  agent_types: string[]
  quota_limit: number
  quota_reserved: number
  quota_used: number
  quota_remaining: number
  call_count: number
  status: ModelRouteStatus
  health_status: ModelHealthStatus
  fallback_on: ModelFallbackError[]
  credential_configured: boolean
  last_checked_at: string | null
  last_called_at: string | null
  resource_version: number
}

export interface UserAgentModelBinding {
  agent_type: AgentModelType
  route_ids: number[]
  resource_version: number
}

export interface UserModelGateway {
  quota: UserModelQuota
  routes: AgentModelRoute[]
  bindings: UserAgentModelBinding[]
}

export interface UserModelCallLog {
  id: number
  user_id: number
  agent_type: string
  route_id: number
  route_name: string
  model: string
  task_id: number | null
  project_id: number | null
  requirement_id: number | null
  request_id: string
  trace_id: string
  attempt_no: number
  status: string
  error_type: string | null
  error_code: string | null
  latency_ms: number
  input_tokens: number
  output_tokens: number
  estimated_input_tokens: number
  output_token_budget: number
  reserved_tokens: number
  released_tokens: number
  usage_estimated: boolean
  fallback_from_route_id: number | null
  fallback_reason: string | null
  created_at: string
}
