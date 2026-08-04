import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@opencode/shared'
import * as authApi from '@/api/auth'
import { setToken, getToken } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(getToken())
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  async function login(username: string, password: string) {
    loading.value = true
    try {
      const res = await authApi.login({ username, password })
      token.value = res.token
      user.value = res.user
      setToken(res.token)
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, password: string) {
    loading.value = true
    try {
      const res = await authApi.register({ username, password })
      token.value = res.token
      user.value = res.user
      setToken(res.token)
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const res = await authApi.getMe()
      user.value = res.user
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    setToken(null)
  }

  return { user, token, loading, isAuthenticated, login, register, fetchMe, logout }
})
