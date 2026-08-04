<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { isDemoMode } from '@/utils/env'
import { mockUsers } from '@/mock/data'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login(form)
    ElMessage.success('登录成功')
    await router.push('/')
  } catch {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false
  }
}

function selectDemoUser(username: string) {
  form.username = username
  form.password = 'demo123'
}
</script>

<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <template #header>
        <div class="login-brand">Dagent</div>
        <el-tag v-if="isDemoMode" type="warning" style="display: block; margin-top: 8px; text-align: center" effect="plain">
          演示模式 — 点击角色快速登录
        </el-tag>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            style="width: 100%"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 演示模式：角色快速选择 -->
      <div v-if="isDemoMode" style="margin-top: 8px">
        <div style="font-size: 12px; color: #909399; text-align: center; margin-bottom: 8px">快速选择角色：</div>
        <el-row :gutter="8">
          <el-col :span="6" v-for="user in mockUsers" :key="user.id">
            <el-button size="small" text @click="selectDemoUser(user.username)" style="width: 100%">
              {{ user.username }}<br/>
              <el-tag size="small" type="info">{{ user.role }}</el-tag>
            </el-button>
          </el-col>
        </el-row>
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
</style>
