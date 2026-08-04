<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import Btn from '@/components/ui/Btn.vue'
import Input from '@/components/ui/Input.vue'
import { ApiRequestError } from '@/api/client'

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirm = ref('')

async function submit() {
  if (!username.value || !password.value) {
    toast.error('请输入用户名和密码')
    return
  }
  if (mode.value === 'register' && password.value !== confirm.value) {
    toast.error('两次输入的密码不一致')
    return
  }
  try {
    if (mode.value === 'login') {
      await auth.login(username.value, password.value)
    } else {
      await auth.register(username.value, password.value)
    }
    toast.success(mode.value === 'login' ? '登录成功' : '注册成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    const msg = e instanceof ApiRequestError ? e.message : '操作失败，请重试'
    toast.error(msg)
  }
}
</script>

<template>
  <main class="flex items-center justify-center min-h-screen px-4">
    <div
      class="w-full max-w-[420px] rounded-[20px] p-8 sm:p-10"
      :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
    >
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-8">
        <span
          class="flex items-center justify-center w-10 h-10 rounded-[10px] text-white font-bold"
          :style="{ background: 'var(--primary)' }"
          >&lt;/&gt;</span
        >
        <span class="text-xl font-bold tracking-tight" :style="{ color: 'var(--foreground)' }"
          >OhMyAgent</span
        >
      </div>

      <!-- Tab -->
      <div
        class="flex gap-1 mb-8 p-1 rounded-full"
        :style="{ background: 'var(--muted)' }"
      >
        <button
          class="flex-1 h-9 rounded-full text-sm font-semibold transition-colors duration-150 cursor-pointer"
          :style="
            mode === 'login'
              ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
              : { background: 'transparent', color: 'var(--muted-foreground)' }
          "
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          class="flex-1 h-9 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer"
          :style="
            mode === 'register'
              ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
              : { background: 'transparent', color: 'var(--muted-foreground)' }
          "
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>

      <!-- Form -->
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">用户名</label>
          <Input v-model="username" placeholder="请输入用户名" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">密码</label>
          <div class="relative">
            <Input v-model="password" type="password" placeholder="请输入密码" />
            <Lock
              :size="16"
              class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              :style="{ color: 'var(--muted-foreground)' }"
            />
          </div>
        </div>

        <div v-if="mode === 'register'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }"
            >确认密码</label
          >
          <div class="relative">
            <Input v-model="confirm" type="password" placeholder="请再次输入密码" />
            <Lock
              :size="16"
              class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              :style="{ color: 'var(--muted-foreground)' }"
            />
          </div>
        </div>

        <Btn type="submit" rounded="full" class="mt-2 w-full">{{ mode === 'login' ? '登录' : '注册' }}</Btn>
      </form>

      <p
        class="mt-6 text-center text-sm"
        :style="{ color: 'var(--muted-foreground)' }"
      >
        忘记密码？请联系管理员重置
      </p>
    </div>
  </main>
</template>
