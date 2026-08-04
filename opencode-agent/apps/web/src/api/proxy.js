import { API } from '@opencode/shared';
import { request, subscribeSSE } from './client';
// 代理到 opencode 实例的接口（经后端鉴权后转发）
export function getHealth(id) {
    return request(API.proxy.health(id).path);
}
// opencode session 列表（结构由 opencode 返回，此处用 any 容纳）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSessions(id) {
    return request(API.proxy.sessions(id).path);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSession(id, body = {}) {
    return request(API.proxy.createSession(id).path, { method: 'POST', body });
}
// 发送消息（走 A2A 协议：sidecar /message:send → opencode）
// 同步模式：等待完整回复（A2A Task 带 artifacts）
// 这是「最开始能用」的方式：后端等 opencode /message 完整回复，前端直接拿 artifacts 显示
// 不依赖 SSE（浏览器 EventSource 链路不可靠）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendMessage(id, sessionId, body) {
    // 把 opencode 格式（{parts:[{type:text,text}]}）转为 A2A 格式
    const text = Array.isArray(body?.parts)
        ? body.parts.filter((p) => p.text).map((p) => p.text).join('\n')
        : '';
    return request(`/api/instances/${id}/a2a/message`, {
        method: 'POST',
        body: {
            message: {
                role: 'user',
                messageId: `msg-${Date.now()}`,
                ...(sessionId ? { contextId: sessionId } : {}),
                parts: [{ type: 'text', text }],
            },
            // 同步模式（不设 returnImmediately，A2A 层等完整回复）
        },
    });
}
// A2A 审批：获取该 session 的下一个 permission 请求
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function controlNext(id, sessionId) {
    return request(`/api/instances/${id}/a2a/control-next?sessionId=${encodeURIComponent(sessionId)}`);
}
// A2A 审批：回传用户决定（新 body 格式：sessionId/permissionId/response）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function controlResponse(id, body) {
    return request(`/api/instances/${id}/a2a/respond`, {
        method: 'POST',
        body,
    });
}
// ===== Provider 管理（LLM 配置 → Higress）=====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listProviders() {
    return request('/api/providers');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProvider(body) {
    return request('/api/providers', { method: 'POST', body });
}
export function deleteProvider(id) {
    return request(`/api/providers/${id}`, { method: 'DELETE' });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateProvider(id, body) {
    return request(`/api/providers/${id}`, { method: 'PUT', body });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testProvider(id) {
    return request(`/api/providers/${id}/test`, { method: 'POST' });
}
// ===== Skill 模板管理 =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listSkillTemplates() {
    return request('/api/skills');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSkillTemplate(body) {
    return request('/api/skills', { method: 'POST', body });
}
export function deleteSkillTemplate(id) {
    return request(`/api/skills/${id}`, { method: 'DELETE' });
}
// ===== MCP Server 管理 =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listMcpServers() {
    return request('/api/mcp-servers');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMcpServer(body) {
    return request('/api/mcp-servers', { method: 'POST', body });
}
export function deleteMcpServer(id) {
    return request(`/api/mcp-servers/${id}`, { method: 'DELETE' });
}
export function listSkills(id) {
    return request(API.proxy.skills(id).path);
}
export function uploadSkill(id, name, zip) {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('file', zip);
    return request(API.proxy.skills(id).path, {
        method: 'POST',
        body: fd,
    });
}
export function deleteSkill(id, name) {
    return request(`${API.proxy.skills(id).path}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
    });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMcp(id) {
    return request(API.proxy.mcp(id).path);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAgent(id) {
    return request(API.proxy.agent(id).path);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProvider(id) {
    return request(API.proxy.provider(id).path);
}
export function subscribeEvents(id, onEvent, onError) {
    return subscribeSSE(API.proxy.events(id), onEvent, onError);
}
