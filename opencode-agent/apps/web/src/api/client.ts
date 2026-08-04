// 轻量 fetch client，带 JWT 注入与统一错误处理
const TOKEN_KEY = 'opencode_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiRequestError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers?: Record<string, any>
  signal?: AbortSignal
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers ?? {}),
  }
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers,
    body:
      opts.body instanceof FormData
        ? opts.body
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
    signal: opts.signal,
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const errObj = data as { error?: { code?: string; message?: string } } | null
    const code = errObj?.error?.code ?? `HTTP_${res.status}`
    const message =
      errObj?.error?.message ?? (typeof data === 'string' ? data : res.statusText)
    throw new ApiRequestError(code, message)
  }
  return data as T
}

// SSE 流式订阅（用于对话回复、监控实时事件）
export function subscribeSSE(
  path: string,
  onEvent: (data: string) => void,
  onError?: (e: Event) => void,
): EventSource {
  // EventSource 不支持自定义 header，token 通过 query 传递
  const token = getToken()
  const url = token ? `${path}?token=${encodeURIComponent(token)}` : path
  const es = new EventSource(url)
  es.onmessage = (e) => onEvent(e.data)
  if (onError) es.onerror = onError
  return es
}
