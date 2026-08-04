import type {
  AuthResponse,
  HealthInfo,
  Instance,
  LoginRequest,
  OpencodeSession,
  RegisterRequest,
  Skill,
  User,
} from '../types/index.js'

// 统一 API 路径与请求/响应类型契约
export const API = {
  auth: {
    register: { method: 'POST', path: '/api/auth/register' } as const,
    login: { method: 'POST', path: '/api/auth/login' } as const,
    me: { method: 'GET', path: '/api/auth/me' } as const,
  },
  instances: {
    list: { method: 'GET', path: '/api/instances' } as const,
    get: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}` } as const),
    deploy: { method: 'POST', path: '/api/instances/deploy' } as const,
    update: (id: number | string) =>
      ({ method: 'PUT', path: `/api/instances/${id}` } as const),
    versions: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/versions` } as const),
    rollback: (id: number | string) =>
      ({ method: 'POST', path: `/api/instances/${id}/rollback` } as const),
    remove: (id: number | string) =>
      ({ method: 'DELETE', path: `/api/instances/${id}` } as const),
    restart: (id: number | string) =>
      ({ method: 'POST', path: `/api/instances/${id}/restart` } as const),
  },
  // 实例代理（→ opencode）
  proxy: {
    health: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/health` } as const),
    sessions: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/sessions` } as const),
    createSession: (id: number | string) =>
      ({ method: 'POST', path: `/api/instances/${id}/sessions` } as const),
    events: (id: number | string) => `/api/instances/${id}/events`, // SSE
    mcp: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/mcp` } as const),
    agent: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/agent` } as const),
    provider: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/provider` } as const),
    skills: (id: number | string) =>
      ({ method: 'GET', path: `/api/instances/${id}/skills` } as const),
  },
} as const

// 请求/响应类型导出（便于前后端引用）
export type {
  AuthResponse,
  HealthInfo,
  Instance,
  LoginRequest,
  OpencodeSession,
  RegisterRequest,
  Skill,
  User,
}

export interface DeployRequest {
  displayName: string // 展示名（用户填，必填）
  name?: string // 兼容旧字段（已废弃，后端忽略）
  namespace?: string
  configJson: string
  provider: string
  modelId: string
  agentType?: string // Agent 模板 id（opencode / claude-code / ...）
  version?: string // 兼容旧字段
  providerId?: number // 关联 providers 表（走 Higress 代理时用）
}

export interface DeployResponse {
  instance: Instance
  message?: string
}
