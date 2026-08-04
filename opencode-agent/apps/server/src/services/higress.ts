// Higress 网关服务封装：对接 Higress Console admin API
// 功能：
// 1. 注册 LLM provider（存真实 upstream key）
// 2. 创建 AI 代理路由（把 LLM 暴露给 agent）
// 3. 创建消费者（签发 OMA key）
// 4. 登录获取 session cookie

import { env } from '../env.js'

// Session cookie 缓存（Higress Console 登录后返回的 cookie）
let _sessionCookie: string | null = null
let _sessionExpiry = 0

async function login(): Promise<string> {
  if (_sessionCookie && Date.now() < _sessionExpiry) return _sessionCookie
  const r = await fetch(`${env.higress.consoleUrl}/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.higress.consoleUser, password: env.higress.consolePassword }),
  })
  // 从 Set-Cookie 提取 session（Higress Console 用 _hi_sess cookie）
  const cookie = r.headers.get('set-cookie')
  if (cookie) {
    // 提取第一个 cookie 的 name=value 部分（兼容各种 cookie 名）
    const m = cookie.match(/([\w_]+=[^;]+)/)
    _sessionCookie = m ? m[1] : ''
  } else {
    _sessionCookie = ''
  }
  _sessionExpiry = Date.now() + 30 * 60 * 1000 // 30 分钟过期
  return _sessionCookie
}

export async function higressFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await login()
  const headers = new Headers(init.headers)
  headers.set('Cookie', cookie)
  let r = await fetch(`${env.higress.consoleUrl}${path}`, { ...init, headers })
  // session 过期 → 重新登录重试
  if (r.status === 401 || r.status === 403) {
    _sessionCookie = null
    const newCookie = await login()
    headers.set('Cookie', newCookie)
    r = await fetch(`${env.higress.consoleUrl}${path}`, { ...init, headers })
  }
  return r
}

// 生成随机 key（OMA 签发给 agent 用）
export function genKey(prefix = 'oma'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return `${prefix}-${ts}${rand}`
}

export interface ProviderSetupResult {
  providerName: string // Higress 里的 LLM provider 名
  routeName: string // Higress 里的 AI 路由名
  consumerName: string // Higress 里的消费者名
  consumerKey: string // OMA 签发的消费者 key（agent 用这个调 Higress）
  gatewayUrl: string // agent 调用的地址（Higress gateway）
}

// 完整注册一个 LLM provider：
// 1. 创建 LLM provider（存真实 key）
// 2. 创建消费者（签发 OMA key）
// 3. 创建 AI 路由（关联 provider + 消费者认证）
export async function setupLLMProvider(opts: {
  name: string // 唯一名（如 "deepseek-user1"）
  type: string // provider 类型（deepseek/openai/moonshot/qwen/openai-compatible 等）
  apiKey: string // 真实 upstream key
  apiUrl: string // upstream 地址（如 https://api.deepseek.com/v1）
  protocol?: string // 协议（默认 openai/v1）
  modelPrefix?: string // 模型前缀匹配（如 "deepseek"）
}): Promise<ProviderSetupResult> {
  const { name, type, apiKey, apiUrl, protocol = 'openai/v1', modelPrefix } = opts
  // 名称全小写（K8s Ingress name 限制：小写字母/数字/中划线）
  const lowerName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const providerName = `llm-${lowerName}`
  const routeName = `route-${lowerName}`
  const consumerName = `consumer-${lowerName}`
  const consumerKey = genKey('oma-llm')

  // 1. 创建 LLM provider
  await higressFetch('/v1/ai/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: providerName,
      type,
      tokens: [apiKey],
      protocol,
      rawConfigs: { apiUrl },
    }),
  })

  // 2. 创建消费者（签发 OMA key）
  await higressFetch('/v1/consumers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: consumerName,
      credentials: [
        { type: 'key-auth', source: 'BEARER', values: [consumerKey] },
      ],
    }),
  })

  // 3. 创建 AI 路由（不设 domain，默认匹配所有 host）
  await higressFetch('/v1/ai/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: routeName,
      pathPredicate: { matchType: 'PRE', matchValue: '/' },
      upstreams: [{ provider: providerName, weight: 100 }],
      authConfig: {
        enabled: true,
        allowedCredentialTypes: ['key-auth'],
        allowedConsumers: [consumerName],
      },
    }),
  })

  return {
    providerName,
    routeName,
    consumerName,
    consumerKey,
    gatewayUrl: `${env.higress.gatewayUrl}/v1`,
  }
}

// 删除 LLM provider（级联删路由 + 消费者）
export async function removeLLMProvider(name: string): Promise<void> {
  const lowerName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const providerName = `llm-${lowerName}`
  const routeName = `route-${lowerName}`
  const consumerName = `consumer-${lowerName}`
  // 删路由
  await higressFetch(`/v1/ai/routes/${routeName}`, { method: 'DELETE' }).catch(() => undefined)
  // 删消费者
  await higressFetch(`/v1/consumers/${consumerName}`, { method: 'DELETE' }).catch(() => undefined)
  // 删 provider
  await higressFetch(`/v1/ai/providers/${providerName}`, { method: 'DELETE' }).catch(() => undefined)
}

// 测试 Higress 连通性
export async function higressAvailable(): Promise<boolean> {
  try {
    await login()
    return true
  } catch {
    return false
  }
}
