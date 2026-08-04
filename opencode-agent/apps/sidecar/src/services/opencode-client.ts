import { env } from '../env.js'

// 调用同 Pod 的 opencode 服务（:4096）
export async function opencodeFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const pwd = process.env.OPENCODE_SERVER_PASSWORD
    const headers = new Headers(init.headers)
    if (pwd && !headers.has('Authorization')) {
      headers.set(
        'Authorization',
        `Basic ${Buffer.from(`opencode:${pwd}`).toString('base64')}`,
      )
    }
    return await fetch(`${env.opencodeBase}${path}`, { ...init, headers })
  } catch {
    return null // opencode 未就绪时返回 null
  }
}

export async function getHealth(): Promise<{ healthy: boolean; version: string } | null> {
  const r = await opencodeFetch('/global/health')
  if (!r || !r.ok) return null
  return r.json()
}

export async function getSessions(): Promise<unknown[]> {
  const r = await opencodeFetch('/session')
  if (!r || !r.ok) return []
  return r.json()
}

export async function getSessionStatus(): Promise<Record<string, string>> {
  const r = await opencodeFetch('/session/status')
  if (!r || !r.ok) return {}
  return r.json()
}

export async function getMcp(): Promise<Record<string, unknown>> {
  const r = await opencodeFetch('/mcp')
  if (!r || !r.ok) return {}
  return r.json()
}

export async function getAgent(): Promise<unknown[]> {
  const r = await opencodeFetch('/agent')
  if (!r || !r.ok) return []
  return r.json()
}

export async function getProvider(): Promise<Record<string, unknown>> {
  const r = await opencodeFetch('/provider')
  if (!r || !r.ok) return {}
  return r.json()
}
