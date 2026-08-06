import client from './client'
import type { ApiResponse, LoginResponse, User } from './types'

export interface LoginRequest {
  username: string
  password: string
}

export interface QuickLoginRequest {
  username: string
}

export const authApi = {
  login: (data: LoginRequest) => client.post<never, ApiResponse<LoginResponse>>('/auth/login', data),
  quickLogin: (data: QuickLoginRequest) =>
    client.post<never, ApiResponse<LoginResponse>>('/auth/quick-login', data),
  me: () => client.get<never, ApiResponse<User>>('/auth/me'),
  logout: () => client.post<never, ApiResponse<{ logged_out: boolean }>>('/auth/logout'),
  users: () => client.get<never, ApiResponse<User[]>>('/users'),
}
