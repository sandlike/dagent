import client from './client'
import type { ApiResponse, DashboardSummary, Requirement } from './types'

export const dashboardApi = {
  summary: () => client.get<never, ApiResponse<DashboardSummary>>('/dashboard/summary'),
  todos: () => client.get<never, ApiResponse<Requirement[]>>('/dashboard/todos'),
  recentRequirements: () =>
    client.get<never, ApiResponse<Requirement[]>>('/dashboard/recent-requirements'),
}
