import { API } from '@opencode/shared'
import type { DeployRequest, DeployResponse, Instance } from '@opencode/shared'
import { request } from './client'

export function listInstances() {
  return request<Instance[]>(API.instances.list.path)
}

export function getInstance(id: number | string) {
  return request<Instance>(API.instances.get(id).path)
}

export function deployInstance(body: DeployRequest) {
  return request<DeployResponse>(API.instances.deploy.path, { method: 'POST', body })
}

// 更新配置 = 部署新版本（同 group，version+1）
export function updateInstance(id: number | string, body: DeployRequest) {
  return request<DeployResponse>(API.instances.update(id).path, { method: 'PUT', body })
}

// 列出同 group 所有版本
export function listVersions(id: number | string) {
  return request<Instance[]>(API.instances.versions(id).path)
}

// 回滚到指定版本
export function rollbackInstance(id: number | string, versionNum: number) {
  return request<{ ok: boolean; message?: string; activeVersionNum?: number }>(
    API.instances.rollback(id).path,
    { method: 'POST', body: { versionNum } },
  )
}

export function deleteInstance(id: number | string) {
  return request<{ ok: boolean }>(API.instances.remove(id).path, { method: 'DELETE' })
}

export function restartInstance(id: number | string) {
  return request<{ ok: boolean }>(API.instances.restart(id).path, { method: 'POST' })
}
