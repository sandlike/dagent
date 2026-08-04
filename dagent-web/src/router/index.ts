import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/project/ProjectList.vue'),
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/project/ProjectDetail.vue'),
      },
      {
        path: 'requirements',
        name: 'Requirements',
        component: () => import('@/views/requirement/RequirementList.vue'),
      },
      {
        path: 'requirements/:id',
        name: 'RequirementDetail',
        component: () => import('@/views/requirement/RequirementDetail.vue'),
      },
      {
        path: 'model-gateway',
        name: 'ModelGateway',
        component: () => import('@/views/model/ModelGateway.vue'),
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/agent/AgentManagement.vue'),
      },
      {
        path: 'audit-logs',
        name: 'AuditLogs',
        component: () => import('@/views/audit/AuditLog.vue'),
      },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
