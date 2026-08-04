import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/api/client';
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: () => import('@/views/LoginView.vue'),
            meta: { public: true },
        },
        // 主框架（左侧导航 + 内容区）
        {
            path: '/',
            component: () => import('@/views/InstancesView.vue'),
            children: [
                // Agent 管理（实例列表）— 默认首页，InstancesView 内部渲染
                {
                    path: '',
                    name: 'instances',
                    component: { template: '<div />' }, // 占位，实际由 InstancesView 内部判断渲染
                },
                // LLM 管理
                {
                    path: 'providers',
                    name: 'providers',
                    component: () => import('@/views/ProvidersView.vue'),
                },
                // MCP 管理
                {
                    path: 'mcp',
                    name: 'mcp',
                    component: () => import('@/views/McpView.vue'),
                },
            ],
        },
        {
            path: '/instances/new',
            name: 'wizard',
            component: () => import('@/views/wizard/WizardView.vue'),
        },
        {
            path: '/instances/:id',
            component: () => import('@/views/instance/InstanceLayout.vue'),
            children: [
                { path: '', redirect: { name: 'chat' } },
                {
                    path: 'chat',
                    name: 'chat',
                    component: () => import('@/views/instance/ChatView.vue'),
                },
                {
                    path: 'skills',
                    name: 'skills',
                    component: () => import('@/views/instance/SkillsView.vue'),
                },
                {
                    path: 'monitor',
                    name: 'monitor',
                    component: () => import('@/views/instance/MonitorView.vue'),
                },
                {
                    path: 'settings',
                    name: 'settings',
                    component: () => import('@/views/instance/SettingsView.vue'),
                },
            ],
        },
    ],
});
router.beforeEach((to) => {
    if (!to.meta.public && !getToken()) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }
});
export default router;
