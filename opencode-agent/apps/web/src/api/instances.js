import { API } from '@opencode/shared';
import { request } from './client';
export function listInstances() {
    return request(API.instances.list.path);
}
export function getInstance(id) {
    return request(API.instances.get(id).path);
}
export function deployInstance(body) {
    return request(API.instances.deploy.path, { method: 'POST', body });
}
// 更新配置 = 部署新版本（同 group，version+1）
export function updateInstance(id, body) {
    return request(API.instances.update(id).path, { method: 'PUT', body });
}
// 列出同 group 所有版本
export function listVersions(id) {
    return request(API.instances.versions(id).path);
}
// 回滚到指定版本
export function rollbackInstance(id, versionNum) {
    return request(API.instances.rollback(id).path, { method: 'POST', body: { versionNum } });
}
export function deleteInstance(id) {
    return request(API.instances.remove(id).path, { method: 'DELETE' });
}
export function restartInstance(id) {
    return request(API.instances.restart(id).path, { method: 'POST' });
}
