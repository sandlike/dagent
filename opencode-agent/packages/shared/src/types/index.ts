// ===== 基础实体类型 =====

export interface User {
  id: number
  username: string
  createdAt: string
}

export type InstanceStatus = 'running' | 'deploying' | 'error' | 'stopped'

export interface Instance {
  id: number
  name: string // 版本化 K8s 名：${groupId}-v${n}
  displayName: string // 用户填的展示名
  groupId: string // 稳定逻辑标识（短 UUID）
  versionNum: number // v1, v2, ...
  isActive: boolean // 当前活跃版本
  ownerId: number
  namespace: string
  status: InstanceStatus
  configJson: string // 完整 opencode.json（向导生成）
  version: string | null // 兼容字段（现为 agentType）
  agentType: string | null // Agent 类型标识（opencode / claude-code / ...）
  modelId: string | null // 冗余展示字段
  provider: string | null // 冗余展示字段
  sessionCount: number // 冗余：会话数（列表卡片用）
  createdAt: string
  updatedAt: string
}

// ===== 认证 DTO =====

export interface AuthResponse {
  token: string
  user: User
}

export interface RegisterRequest {
  username: string
  password: string
}

export type LoginRequest = RegisterRequest

// ===== 统一错误格式 =====

export interface ApiError {
  error: { code: string; message: string }
}

// ===== 会话（代理 opencode /session） =====

export type SessionStatus = 'running' | 'idle' | 'error'

export interface OpencodeSession {
  id: string
  title?: string
  createdAt?: string
  updatedAt?: string
}

// ===== Skill =====

export interface Skill {
  name: string
  description: string
  version?: string
  size?: number // bytes
  status: 'running' | 'updating' | 'stopped'
  updatedAt?: string
}

// ===== 监控 =====

export interface HealthInfo {
  healthy: boolean
  version: string
}

// ===== 向导配置模型（向导表单 ↔ opencode.json 双向转换的数据源） =====

export type ProviderTemplate =
  | 'deepseek'
  | 'anthropic'
  | 'openai'
  | 'bedrock'
  | 'azure'
  | 'custom'

export type PermissionAction = 'allow' | 'ask' | 'deny'

export type PermissionTool =
  | 'read'
  | 'edit'
  | 'bash'
  | 'grep'
  | 'glob'
  | 'list'
  | 'webfetch'
  | 'websearch'
  | 'skill'
  | 'task'

export type PermissionMode = 'readonly' | 'ask' | 'full' | 'custom'

export interface BashRule {
  pattern: string
  action: PermissionAction
}

export interface ProviderConfig {
  template: ProviderTemplate
  apiKey: string // 明文，部署时进 Secret；生成 JSON 时转为 {env:VAR}
  apiKeyEnvName: string // 环境变量名，如 DEEPSEEK_API_KEY
  baseUrl?: string
  timeout?: number
  npmName?: string // 自定义 provider 的 npm 包
  models: string[] // 可选模型列表
}

export interface McpServerLocal {
  type: 'local'
  command: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface McpServerRemote {
  type: 'remote'
  url: string
  headers?: Record<string, string>
  oauth?: {
    clientId: string
    clientSecret: string
    scope?: string
  }
}

export type McpServer = McpServerLocal | McpServerRemote

export interface SkillRef {
  type: 'path' | 'url' | 'upload'
  value: string // 路径/URL/上传文件名
}

// 向导完整表单模型
export interface WizardForm {
  // Agent 类型（决定镜像 + 配置模板），对应 AGENT_TEMPLATES 的 id
  agentType: string
  // Step 1 基本信息
  name: string
  description: string
  defaultAgent: 'build' | 'plan'
  namespace: string
  // Step 2 模型
  provider: ProviderConfig
  providerId?: number // 关联 providers 表（走 Higress 代理时用）
  model: string
  smallModel: string
  // Step 3 权限
  permissionMode: PermissionMode
  toolPermissions: Record<PermissionTool, PermissionAction> // 自定义模式下生效
  bashRules: BashRule[]
  // Step 4 MCP + Skills
  mcpServers: Record<string, McpServer>
  skillPaths: string[]
  skillUrls: string[]
  skillPermissionRules: { pattern: string; action: PermissionAction }[]
  presetSkills: SkillRef[] // 部署时写入 PVC
}
