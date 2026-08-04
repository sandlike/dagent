// Nacos 3.x Agent Registry 注册
// 当前部署关闭了鉴权（NACOS_AUTH_ADMIN_ENABLE=false），直接调 v3 admin API

const NACOS_BASE = process.env.NACOS_SERVER ?? 'http://nacos.nacos-system.svc:8848'

let _registered = false
let _heartbeatTimer: any = null

// v3 admin API 封装
async function nacosApi(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(`${NACOS_BASE}${path}`, init)
  } catch {
    return null
  }
}

// 注册 agent 到 Nacos（作为服务实例）
export async function registerAgent(opts: {
  serviceName: string
  ip: string
  port: number
  metadata?: Record<string, string>
}): Promise<boolean> {
  const { serviceName, ip, port, metadata = {} } = opts
  // Nacos 3.x serviceName 不含特殊字符
  const cleanName = serviceName.replace(/[^a-zA-Z0-9_-]/g, '-')
  const params = new URLSearchParams({
    serviceName: cleanName,
    ip,
    port: String(port),
    weight: '1',
    healthy: 'true',
    enabled: 'true',
    metadata: JSON.stringify({
      type: 'a2a-agent',
      protocol: 'a2a',
      agentCard: `/.well-known/agent.json`,
      ...metadata,
    }),
  })

  try {
    // Nacos 3.x v3 admin API 注册
    const r = await nacosApi(`/nacos/v3/admin/ns/instance?${params}`, { method: 'POST' })
    const text = r ? await r.text() : ''
    if (r && (text.includes('"code":0') || text === 'ok' || r.ok)) {
      console.log(`✅ Agent registered to Nacos: ${cleanName} (${ip}:${port})`)
      _registered = true
      startHeartbeat(cleanName, ip, port)
      return true
    } else {
      console.warn(`⚠️ Nacos registration response: ${text?.slice(0, 100)}`)
      return false
    }
  } catch (e) {
    console.warn(`⚠️ Nacos registration failed: ${(e as Error).message}`)
    return false
  }
}

// 心跳保活（Nacos 3.x 无 beat 端点，改用定时重新注册保活）
function startHeartbeat(serviceName: string, ip: string, port: number) {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer)
  _heartbeatTimer = setInterval(async () => {
    try {
      // 重新注册（幂等），相当于心跳
      const params = new URLSearchParams({
        serviceName, ip, port: String(port),
        weight: '1', healthy: 'true', enabled: 'true',
      })
      await nacosApi(`/nacos/v3/admin/ns/instance?${params}`, { method: 'POST' })
    } catch {
      // 静默
    }
  }, 30000)
}

// 注销 agent
export async function deregisterAgent(serviceName: string, ip: string, port: number): Promise<void> {
  const cleanName = serviceName.replace(/[^a-zA-Z0-9_-]/g, '-')
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer)
    _heartbeatTimer = null
  }
  try {
    const params = new URLSearchParams({ serviceName: cleanName, ip, port: String(port) })
    await nacosApi(`/nacos/v3/admin/ns/instance?${params}`, { method: 'DELETE' })
    console.log(`Agent deregistered from Nacos: ${cleanName}`)
  } catch {
    // 静默
  }
}

export function isRegistered(): boolean {
  return _registered
}
