import type {
  InstanceStatus,
  PermissionAction,
  PermissionMode,
  PermissionTool,
  ProviderConfig,
  ProviderTemplate,
  SessionStatus,
} from '../types/index.js'

// ===== 实例状态展示映射 =====
export interface StatusMeta {
  label: string
  color: string // CSS 变量名
}

export const INSTANCE_STATUS_META: Record<InstanceStatus, StatusMeta> = {
  running: { label: '运行中', color: 'var(--status-running)' },
  deploying: { label: '部署中', color: 'var(--status-deploying)' },
  error: { label: '异常', color: 'var(--status-error)' },
  stopped: { label: '已停止', color: 'var(--status-stopped)' },
}

export const SESSION_STATUS_META: Record<SessionStatus, StatusMeta> = {
  running: { label: '运行中', color: 'var(--status-running)' },
  idle: { label: '空闲', color: 'var(--muted-foreground)' },
  error: { label: '异常', color: 'var(--status-error)' },
}

// ===== Provider 模板 =====
export interface ProviderTemplateMeta {
  id: ProviderTemplate
  label: string
  npmName?: string
  defaultBaseUrl?: string
  defaultApiKeyEnvName: string
  models: string[]
}

export const PROVIDER_TEMPLATES: ProviderTemplateMeta[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    npmName: '@ai-sdk/openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultApiKeyEnvName: 'DEEPSEEK_API_KEY',
    models: [
      'deepseek/deepseek-chat',
      'deepseek/deepseek-reasoner',
      'deepseek/deepseek-v4-flash',
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    npmName: '@ai-sdk/anthropic',
    defaultApiKeyEnvName: 'ANTHROPIC_API_KEY',
    models: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3.5-haiku',
      'anthropic/claude-3-opus',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    npmName: '@ai-sdk/openai',
    defaultApiKeyEnvName: 'OPENAI_API_KEY',
    models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo'],
  },
  {
    id: 'bedrock',
    label: 'Bedrock',
    npmName: '@ai-sdk/bedrock',
    defaultApiKeyEnvName: 'AWS_BEDROCK_API_KEY',
    models: ['bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0'],
  },
  {
    id: 'azure',
    label: 'Azure',
    npmName: '@ai-sdk/azure',
    defaultApiKeyEnvName: 'AZURE_API_KEY',
    models: ['azure/gpt-4o'],
  },
  {
    id: 'custom',
    label: '自定义 (OpenAI 兼容)',
    npmName: '@ai-sdk/openai-compatible',
    defaultApiKeyEnvName: 'CUSTOM_API_KEY',
    models: [],
  },
]

// 根据 template id 获取默认 provider 配置
export function defaultProviderConfig(
  template: ProviderTemplate,
): ProviderConfig {
  const meta =
    PROVIDER_TEMPLATES.find((t) => t.id === template) ?? PROVIDER_TEMPLATES[0]
  return {
    template,
    apiKey: '',
    apiKeyEnvName: meta.defaultApiKeyEnvName,
    baseUrl: meta.defaultBaseUrl,
    timeout: 300000,
    npmName: meta.npmName,
    models: meta.models,
  }
}

// ===== 权限工具列表 =====
export const PERMISSION_TOOLS: { tool: PermissionTool; label: string }[] = [
  { tool: 'read', label: 'read (读文件)' },
  { tool: 'edit', label: 'edit (写文件)' },
  { tool: 'bash', label: 'bash (shell)' },
  { tool: 'grep', label: 'grep (搜内容)' },
  { tool: 'glob', label: 'glob (搜文件)' },
  { tool: 'list', label: 'list (列目录)' },
  { tool: 'webfetch', label: 'webfetch' },
  { tool: 'websearch', label: 'websearch' },
  { tool: 'skill', label: 'skill' },
  { tool: 'task', label: 'task (子agent)' },
]

export const PERMISSION_ACTIONS: PermissionAction[] = ['allow', 'ask', 'deny']

// 预设模式 → 各工具动作
export const PERMISSION_PRESETS: Record<
  Exclude<PermissionMode, 'custom'>,
  Record<PermissionTool, PermissionAction>
> = {
  readonly: {
    read: 'allow',
    edit: 'deny',
    bash: 'deny',
    grep: 'allow',
    glob: 'allow',
    list: 'allow',
    webfetch: 'deny',
    websearch: 'deny',
    skill: 'allow',
    task: 'deny',
  },
  ask: {
    read: 'ask',
    edit: 'ask',
    bash: 'ask',
    grep: 'ask',
    glob: 'ask',
    list: 'ask',
    webfetch: 'ask',
    websearch: 'ask',
    skill: 'ask',
    task: 'ask',
  },
  full: {
    read: 'allow',
    edit: 'allow',
    bash: 'allow',
    grep: 'allow',
    glob: 'allow',
    list: 'allow',
    webfetch: 'allow',
    websearch: 'allow',
    skill: 'allow',
    task: 'allow',
  },
}

// ===== 命名空间 =====
// namespace 由部署环境决定（后端 INSTANCE_NAMESPACE 环境变量），前端不需要配置。
// 这里仅作为 WizardForm 的占位空值，实际值由后端 deploy 时注入。
export const DEFAULT_NAMESPACE = ''
