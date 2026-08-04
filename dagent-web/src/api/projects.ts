import client, { idempotencyHeaders } from './client'
import type { ApiResponse, Page, Project, Repository, RepositoryVerification } from './types'

export interface ProjectCreate {
  name: string
  description: string
  member_ids: number[]
}

export interface RepositoryBind {
  name: string
  provider: string
  url: string
  default_branch: string
}

export interface RepositoryCredential {
  username: string
  token: string
}

export interface RepositoryDeleteResult {
  deleted: boolean
  repository_deleted: boolean
}

const REPOSITORY_VERIFICATION_TIMEOUT_MS = 180_000

export const projectApi = {
  list: (params: { page?: number; page_size?: number } = {}) =>
    client.get<never, ApiResponse<Page<Project>>>('/projects', { params }),
  detail: (id: number) => client.get<never, ApiResponse<Project>>(`/projects/${id}`),
  create: (data: ProjectCreate) =>
    client.post<never, ApiResponse<Project>>('/projects', data, { headers: idempotencyHeaders() }),
  update: (id: number, data: Partial<ProjectCreate> & { resource_version: number }) =>
    client.patch<never, ApiResponse<Project>>(`/projects/${id}`, data),
  archive: (id: number, resourceVersion: number) =>
    client.post<never, ApiResponse<Project>>(`/projects/${id}/archive`, {
      resource_version: resourceVersion,
    }),
  repositories: (projectId: number) =>
    client.get<never, ApiResponse<Repository[]>>(`/projects/${projectId}/repositories`),
  bindRepository: (projectId: number, data: RepositoryBind) =>
    client.post<never, ApiResponse<Repository>>(`/projects/${projectId}/repositories`, data, {
      headers: idempotencyHeaders(),
    }),
  deleteRepository: (projectId: number, repositoryId: number) =>
    client.delete<never, ApiResponse<RepositoryDeleteResult>>(
      `/projects/${projectId}/repositories/${repositoryId}`,
    ),
  setRepositoryCredential: (repositoryId: number, data: RepositoryCredential) =>
    client.put<never, ApiResponse<Repository>>(`/repositories/${repositoryId}/credential`, data),
  deleteRepositoryCredential: (repositoryId: number) =>
    client.delete<never, ApiResponse<Repository>>(`/repositories/${repositoryId}/credential`),
  verifyRepository: (repositoryId: number) =>
    client.post<never, ApiResponse<RepositoryVerification>>(
      `/repositories/${repositoryId}/verify`,
      undefined,
      { timeout: REPOSITORY_VERIFICATION_TIMEOUT_MS },
    ),
}
