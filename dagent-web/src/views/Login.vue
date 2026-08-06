<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { Checked, Management, Monitor, UserFilled } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const loadingUser = ref('')
const accounts = [
  { username: 'admin', label: '管理员', icon: UserFilled },
  { username: 'pm', label: '产品经理', icon: Management },
  { username: 'developer', label: '开发人员', icon: Monitor },
  { username: 'qa', label: '测试人员', icon: Checked },
]

async function handleQuickLogin(username: string) {
  loadingUser.value = username
  try {
    await authStore.quickLogin(username)
    ElMessage.success('登录成功')
    await router.push('/')
  } catch {
    // 错误已在拦截器中处理
  } finally {
    loadingUser.value = ''
  }
}
</script>

<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <template #header>
        <div class="login-brand">Dagent</div>
      </template>
      <div class="account-list">
        <el-button
          v-for="account in accounts"
          :key="account.username"
          class="account-button"
          size="large"
          :icon="account.icon"
          :loading="loadingUser === account.username"
          :disabled="Boolean(loadingUser)"
          @click="handleQuickLogin(account.username)"
        >
          <span>{{ account.label }}</span>
          <span class="account-name">{{ account.username }}</span>
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.login-card {
  width: 400px;
  border: 1px solid #d20a10;
  box-shadow: 0 8px 24px rgb(210 10 16 / 8%);
}

.login-brand {
  color: #20252b;
  font-size: 28px;
  font-weight: 700;
  text-align: center;
}

.account-list {
  display: grid;
  gap: 12px;
}

.account-button {
  width: 100%;
  height: 52px;
  margin: 0;
  justify-content: flex-start;
}

.account-button :deep(.el-icon) {
  margin-right: 10px;
}

.account-name {
  margin-left: auto;
  color: #8a9199;
  font-size: 13px;
}
</style>
