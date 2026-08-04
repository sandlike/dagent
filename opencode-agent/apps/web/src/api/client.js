// 轻量 fetch client，带 JWT 注入与统一错误处理
const TOKEN_KEY = 'opencode_token';
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
    if (token)
        localStorage.setItem(TOKEN_KEY, token);
    else
        localStorage.removeItem(TOKEN_KEY);
}
export class ApiRequestError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
export async function request(path, opts = {}) {
    const headers = {
        ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined && !(opts.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const token = getToken();
    if (token)
        headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body instanceof FormData
            ? opts.body
            : opts.body !== undefined
                ? JSON.stringify(opts.body)
                : undefined,
        signal: opts.signal,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
    }
    if (!res.ok) {
        const errObj = data;
        const code = errObj?.error?.code ?? `HTTP_${res.status}`;
        const message = errObj?.error?.message ?? (typeof data === 'string' ? data : res.statusText);
        throw new ApiRequestError(code, message);
    }
    return data;
}
// SSE 流式订阅（用于对话回复、监控实时事件）
export function subscribeSSE(path, onEvent, onError) {
    // EventSource 不支持自定义 header，token 通过 query 传递
    const token = getToken();
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    const es = new EventSource(url);
    es.onmessage = (e) => onEvent(e.data);
    if (onError)
        es.onerror = onError;
    return es;
}
