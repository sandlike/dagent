import type { WizardForm } from '../types/index.js'
import { DEFAULT_NAMESPACE, PERMISSION_PRESETS, defaultProviderConfig } from '../constants/index.js'

// ===== Agent 模板目录 =====
// 每个模板对应一种智能体类型（opencode / claude-code / codex / ...），
// 每个模板绑定一个镜像 tag，选定后注入推荐配置模板。
// 新增模板只需在 AGENT_TEMPLATES 数组里追加一项。

export interface AgentTemplate {
  /** 模板唯一标识，如 "opencode" */
  id: string
  /** 显示名 */
  label: string
  /** 简短描述 */
  description: string
  /** 镜像 tag（拼到 IMAGE_REGISTRY/opencode:<tag> 或自定义镜像名） */
  imageTag: string
  /** 镜像名（默认 opencode，其他 agent 可自定义如 claude-code） */
  imageName?: string
  /** 是否已上线可选 */
  available: boolean
  /** 推荐配置模板（选模板后注入向导表单） */
  configTemplate: Partial<WizardForm>
}

// 内联基线（避免与 config/index.ts 的循环依赖）
function baseTemplate(overrides: Partial<WizardForm>): Partial<WizardForm> {
  return {
    agentType: 'opencode',
    name: '',
    description: '',
    defaultAgent: 'build',
    namespace: DEFAULT_NAMESPACE,
    provider: defaultProviderConfig('deepseek'),
    model: 'deepseek/deepseek-chat',
    smallModel: 'deepseek/deepseek-chat',
    permissionMode: 'ask',
    toolPermissions: { ...PERMISSION_PRESETS.ask },
    bashRules: [{ pattern: 'rm -rf *', action: 'deny' }],
    mcpServers: {},
    skillPaths: [],
    skillUrls: [],
    skillPermissionRules: [],
    presetSkills: [],
    ...overrides,
  }
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'opencode',
    label: 'OpenCode',
    description: '开源 AI 编码助手',
    imageTag: '1.15.12',
    imageName: 'opencode',
    available: true,
    configTemplate: baseTemplate({
      agentType: 'opencode',
      provider: defaultProviderConfig('deepseek'),
      model: 'deepseek/deepseek-chat',
      smallModel: 'deepseek/deepseek-chat',
      permissionMode: 'ask',
    }),
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic Claude 编码助手',
    imageTag: 'latest',
    imageName: 'claude-code',
    available: false, // 敬请期待
    configTemplate: baseTemplate({
      agentType: 'claude-code',
      provider: defaultProviderConfig('anthropic'),
      model: 'anthropic/claude-sonnet-4-20250514',
      smallModel: 'anthropic/claude-haiku-4-20250514',
    }),
  },
  {
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI Codex 编码助手',
    imageTag: 'latest',
    imageName: 'codex',
    available: false, // 敬请期待
    configTemplate: baseTemplate({
      agentType: 'codex',
      provider: defaultProviderConfig('openai'),
      model: 'openai/o3',
      smallModel: 'openai/gpt-4o-mini',
    }),
  },
]

export const DEFAULT_TEMPLATE = AGENT_TEMPLATES.find((t) => t.available) ?? AGENT_TEMPLATES[0]

export function findTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id)
}

// 镜像全名：仓库地址 + 镜像名 + tag。仓库地址由调用方传入（后端从 env 读取）
export function imageRef(template: AgentTemplate, registry?: string): string {
  const r = (registry ?? '').replace(/\/$/, '')
  const name = template.imageName ?? 'opencode'
  const fullName = r ? `${r}/${name}` : name
  return `${fullName}:${template.imageTag}`
}
