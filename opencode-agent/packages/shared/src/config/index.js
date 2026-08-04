import { DEFAULT_NAMESPACE, PERMISSION_PRESETS, defaultProviderConfig, } from '../constants/index.js';
import { DEFAULT_TEMPLATE } from '../versions/index.js';
// ===== 默认向导表单 =====
export function emptyWizardForm() {
    return {
        agentType: DEFAULT_TEMPLATE.id,
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
    };
}
function buildPermissionBlock(mode, tools, bashRules) {
    // 自定义模式用 tools 表，否则用预设
    const effective = mode === 'custom'
        ? tools
        : PERMISSION_PRESETS[mode] ?? tools;
    const block = {};
    for (const [tool, action] of Object.entries(effective)) {
        block[tool] = action;
    }
    // bash 额外的 glob 规则合并成一个对象
    if (bashRules.length > 0) {
        const bashMap = {};
        for (const r of bashRules)
            bashMap[r.pattern] = r.action;
        // 若工具表里 bash 是 allow/ask，glob 规则作为细粒度补充
        block.bash =
            typeof block.bash === 'string'
                ? { ...bashMap } // 细粒度规则覆盖
                : { ...block.bash, ...bashMap };
    }
    return block;
}
function buildProviderBlock(p) {
    const providerKey = p.template === 'custom' ? 'custom' : p.template;
    const options = {};
    if (p.apiKey) {
        options.apiKey = `{env:${p.apiKeyEnvName}}`;
    }
    if (p.baseUrl)
        options.baseURL = p.baseUrl;
    if (p.timeout)
        options.timeout = p.timeout;
    const entry = { options };
    if (p.npmName && p.template === 'custom')
        entry.npm = p.npmName;
    return { providerKey, entry };
}
function buildMcpBlock(servers) {
    const block = {};
    for (const [name, s] of Object.entries(servers)) {
        if (s.type === 'local') {
            const entry = {
                type: 'local',
                command: s.command,
            };
            if (s.cwd)
                entry.cwd = s.cwd;
            if (s.env)
                entry.environment = s.env;
            block[name] = entry;
        }
        else {
            const entry = { type: 'remote', url: s.url };
            if (s.headers)
                entry.headers = s.headers;
            if (s.oauth)
                entry.oauth = s.oauth;
            block[name] = entry;
        }
    }
    return block;
}
// ===== 生成 opencode.json 对象 =====
export function generateConfig(form) {
    const { providerKey, entry } = buildProviderBlock(form.provider);
    const config = {
        $schema: 'https://opencode.ai/config.json',
        provider: { [providerKey]: entry },
        model: form.model,
        small_model: form.smallModel,
        permission: buildPermissionBlock(form.permissionMode, form.toolPermissions, form.bashRules),
    };
    if (Object.keys(form.mcpServers).length > 0) {
        config.mcp = buildMcpBlock(form.mcpServers);
    }
    const skills = {};
    if (form.skillPaths.length > 0)
        skills.paths = form.skillPaths;
    if (form.skillUrls.length > 0)
        skills.urls = form.skillUrls;
    if (Object.keys(skills).length > 0)
        config.skills = skills;
    return config;
}
// ===== 导入：opencode.json → WizardForm（反向解析）=====
export function parseConfig(raw, base) {
    const form = { ...emptyWizardForm(), ...(base ?? {}) };
    // provider
    const providers = raw.provider ?? {};
    const [providerKey, providerEntry = {}] = Object.entries(providers)[0] ?? [];
    const template = providerKey ?? 'deepseek';
    const opts = providerEntry.options ?? {};
    const pc = defaultProviderConfig(template);
    pc.baseUrl = opts.baseURL ?? opts.baseUrl; // 兼容大小写
    pc.timeout = opts.timeout;
    // 从 {env:VAR} 反解环境变量名
    const apiKeyRaw = opts.apiKey;
    if (typeof apiKeyRaw === 'string') {
        const m = apiKeyRaw.match(/^\{env:(.+)\}$/);
        if (m) {
            pc.apiKeyEnvName = m[1];
            pc.apiKey = ''; // 明文不保留，部署时重新填
        }
        else {
            pc.apiKey = apiKeyRaw;
        }
    }
    if (providerEntry.npm)
        pc.npmName = providerEntry.npm;
    form.provider = pc;
    if (typeof raw.model === 'string')
        form.model = raw.model;
    if (typeof raw.smallModel === 'string')
        form.smallModel = raw.smallModel;
    // permission
    const perm = raw.permission ?? {};
    const tools = { ...form.toolPermissions };
    const bashRules = [];
    for (const [k, v] of Object.entries(perm)) {
        if (typeof v === 'string') {
            if (k in tools)
                tools[k] = v;
        }
        else if (k === 'bash' && typeof v === 'object') {
            for (const [pattern, action] of Object.entries(v)) {
                bashRules.push({ pattern, action: action });
            }
        }
    }
    form.toolPermissions = tools;
    form.bashRules = bashRules;
    // 推断模式：若完全匹配某预设则为该预设，否则 custom
    form.permissionMode = detectMode(tools);
    // mcp
    const mcp = raw.mcp ?? {};
    const servers = {};
    for (const [name, s] of Object.entries(mcp)) {
        const sv = s;
        if (sv.type === 'local') {
            servers[name] = {
                type: 'local',
                command: sv.command ?? [],
                cwd: sv.cwd,
                env: sv.environment,
            };
        }
        else {
            servers[name] = {
                type: 'remote',
                url: sv.url ?? '',
                headers: sv.headers,
                oauth: sv.oauth,
            };
        }
    }
    form.mcpServers = servers;
    // skills
    const skills = raw.skills ?? {};
    form.skillPaths = skills.paths ?? [];
    form.skillUrls = skills.urls ?? [];
    return form;
}
function detectMode(tools) {
    for (const m of ['readonly', 'ask', 'full']) {
        const preset = PERMISSION_PRESETS[m];
        if (Object.keys(preset).every((k) => preset[k] === tools[k])) {
            return m;
        }
    }
    return 'custom';
}
