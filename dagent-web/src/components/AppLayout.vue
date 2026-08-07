<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Connection, Document, Folder, Monitor, Setting, SwitchButton, Tickets } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const activeMenu = computed(() => {
  if (route.path.startsWith('/requirements')) return '/requirements'
  if (route.path.startsWith('/projects')) return '/projects'
  if (route.path.startsWith('/model-gateway')) return '/model-gateway'
  if (route.path.startsWith('/agents')) return '/agents'
  if (route.path.startsWith('/audit-logs')) return '/audit-logs'
  return '/'
})
const breadcrumb = computed(() => {
  const labels: Record<string, string> = {
    ProjectDetail: '项目详情',
    Projects: '项目空间',
    RequirementDetail: '需求详情',
    Requirements: '需求',
    ModelGateway: '模型网关',
    Agents: 'Agent 管理',
    AuditLogs: '审计日志',
  }
  return labels[String(route.name)]
})

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  if (!authStore.user) authStore.fetchUser()
})
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="216px" class="app-sidebar">
      <div class="brand">Dagent</div>
      <el-menu
        :default-active="activeMenu"
        background-color="#20252b"
        text-color="#b9c0c8"
        active-text-color="#fff"
        router
      >
        <el-menu-item index="/"><el-icon><Monitor /></el-icon><span>工作台</span></el-menu-item>
        <el-menu-item index="/projects"><el-icon><Folder /></el-icon><span>项目空间</span></el-menu-item>
        <el-menu-item index="/requirements"><el-icon><Document /></el-icon><span>需求</span></el-menu-item>
        <el-menu-item index="/model-gateway"><el-icon><Connection /></el-icon><span>模型网关</span></el-menu-item>
        <el-menu-item index="/agents"><el-icon><Setting /></el-icon><span>Agent 管理</span></el-menu-item>
        <el-menu-item v-if="authStore.isAdmin" index="/audit-logs"><el-icon><Tickets /></el-icon><span>审计日志</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="content-shell">
      <el-header class="app-header">
        <el-breadcrumb separator="/"><el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item><el-breadcrumb-item v-if="breadcrumb">{{ breadcrumb }}</el-breadcrumb-item></el-breadcrumb>
        <div class="account-area">
          <el-tag size="small" type="info">{{ authStore.user?.roles.join(', ') || '-' }}</el-tag>
          <span>{{ authStore.user?.username || '用户' }}</span>
          <el-button :icon="SwitchButton" text aria-label="退出登录" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="app-main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell { height: 100vh; min-width: 0; }
.app-sidebar { background: #20252b; }
.brand { height: 62px; padding: 0 20px; display: flex; align-items: center; color: #fff; border-bottom: 1px solid #343a42; font-size: 20px; font-weight: 700; }
.app-sidebar :deep(.el-menu) { border-right: 0; padding: 10px; }
.app-sidebar :deep(.el-menu-item) { height: 45px; margin-bottom: 3px; border-radius: 4px; }
.app-sidebar :deep(.el-menu-item.is-active) { background: #a8080d; }
.content-shell { min-width: 0; }
.app-header { height: 62px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dde2e7; background: #fff; padding: 0 22px; }
.account-area { display: flex; align-items: center; gap: 10px; color: #48525f; font-size: 13px; }
.app-main { min-width: 0; overflow-x: auto; background: #f3f5f7; padding: 22px; }
@media (max-width: 760px) {
  .app-sidebar { width: 72px !important; flex: 0 0 72px !important; }
  .brand { justify-content: center; padding: 0; font-size: 16px; }
  .app-sidebar :deep(.el-menu-item span) { display: none; }
  .app-sidebar :deep(.el-menu) { padding: 10px 8px; }
  .app-sidebar :deep(.el-menu-item) { justify-content: center; padding: 0 !important; }
  .app-sidebar :deep(.el-menu-item .el-icon) { margin: 0; }
  .app-header { padding: 0 12px; }
  .account-area { gap: 4px; }
  .account-area :deep(.el-tag),
  .account-area > span { display: none; }
  .app-main { padding: 12px; }
}
</style>
