import { API } from '@opencode/shared'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@opencode/shared'
import { request } from './client'

export function register(body: RegisterRequest) {
  return request<AuthResponse>(API.auth.register.path, { method: 'POST', body })
}

export function login(body: LoginRequest) {
  return request<AuthResponse>(API.auth.login.path, { method: 'POST', body })
}

export function getMe() {
  return request<{ user: User }>(API.auth.me.path)
}
