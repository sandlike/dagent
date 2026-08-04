// 统一 API 路径与请求/响应类型契约
export const API = {
    auth: {
        register: { method: 'POST', path: '/api/auth/register' },
        login: { method: 'POST', path: '/api/auth/login' },
        me: { method: 'GET', path: '/api/auth/me' },
    },
    instances: {
        list: { method: 'GET', path: '/api/instances' },
        get: (id) => ({ method: 'GET', path: `/api/instances/${id}` }),
        deploy: { method: 'POST', path: '/api/instances/deploy' },
        update: (id) => ({ method: 'PUT', path: `/api/instances/${id}` }),
        versions: (id) => ({ method: 'GET', path: `/api/instances/${id}/versions` }),
        rollback: (id) => ({ method: 'POST', path: `/api/instances/${id}/rollback` }),
        remove: (id) => ({ method: 'DELETE', path: `/api/instances/${id}` }),
        restart: (id) => ({ method: 'POST', path: `/api/instances/${id}/restart` }),
    },
    // 实例代理（→ opencode）
    proxy: {
        health: (id) => ({ method: 'GET', path: `/api/instances/${id}/health` }),
        sessions: (id) => ({ method: 'GET', path: `/api/instances/${id}/sessions` }),
        createSession: (id) => ({ method: 'POST', path: `/api/instances/${id}/sessions` }),
        events: (id) => `/api/instances/${id}/events`, // SSE
        mcp: (id) => ({ method: 'GET', path: `/api/instances/${id}/mcp` }),
        agent: (id) => ({ method: 'GET', path: `/api/instances/${id}/agent` }),
        provider: (id) => ({ method: 'GET', path: `/api/instances/${id}/provider` }),
        skills: (id) => ({ method: 'GET', path: `/api/instances/${id}/skills` }),
    },
};
