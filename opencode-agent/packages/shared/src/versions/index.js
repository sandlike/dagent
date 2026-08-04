import { DEFAULT_NAMESPACE, PERMISSION_PRESETS, defaultProviderConfig } from '../constants/index.js';
// 内联基线（避免与 config/index.ts 的循环依赖）
function baseTemplate(overrides) {
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
    };
}
export const AGENT_TEMPLATES = [
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
];
export const DEFAULT_TEMPLATE = AGENT_TEMPLATES.find((t) => t.available) ?? AGENT_TEMPLATES[0];
export function findTemplate(id) {
    return AGENT_TEMPLATES.find((t) => t.id === id);
}
// 镜像全名：仓库地址 + 镜像名 + tag。仓库地址由调用方传入（后端从 env 读取）
export function imageRef(template, registry) {
    const r = (registry ?? '').replace(/\/$/, '');
    const name = template.imageName ?? 'opencode';
    const fullName = r ? `${r}/${name}` : name;
    return `${fullName}:${template.imageTag}`;
}
