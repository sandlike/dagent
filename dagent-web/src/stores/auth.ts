import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, type LoginRequest } from '@/api/auth'
import type { User } from '@/api/types'
import { isDemoMode } from '@/utils/env'
import { mockUsers } from '@/mock/data'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<User | null>(null)
  const users = ref<User[]>([])
  const isLoggedIn = computed(() => Boolean(token.value))
  const canManageProjects = computed(() => user.value?.roles.some((role) => ['admin', 'pm'].includes(role)))
  const isAdmin = computed(() => user.value?.roles.includes('admin') ?? false)
  const canDevelop = computed(() =>
    user.value?.roles.some((role) => ['admin', 'developer'].includes(role)) ?? false,
  )

  async function login(credentials: LoginRequest) {
    if (isDemoMode) {
      token.value = `demo-token-${Date.now()}`
      localStorage.setItem('token', token.value)
      const matched = mockUsers.find((item) => item.username === credentials.username) || mockUsers[0]
      user.value = { ...matched, roles: [matched.role] }
      return
    }
    const response = await authApi.login(credentials)
    token.value = response.data.access_token
    user.value = response.data.user
    localStorage.setItem('token', response.data.access_token)
  }

  async function quickLogin(username: string) {
    if (isDemoMode) {
      token.value = `demo-token-${Date.now()}`
      localStorage.setItem('token', token.value)
      const matched = mockUsers.find((item) => item.username === username) || mockUsers[0]
      user.value = { ...matched, roles: [matched.role] }
      return
    }
    const response = await authApi.quickLogin({ username })
    token.value = response.data.access_token
    user.value = response.data.user
    localStorage.setItem('token', response.data.access_token)
  }

  async function fetchUser() {
    if (!token.value) return
    if (isDemoMode) {
      const fallback = mockUsers[0]
      user.value = user.value || { ...fallback, roles: [fallback.role] }
      return
    }
    const response = await authApi.me()
    user.value = response.data
  }

  async function fetchUsers() {
    if (isDemoMode) {
      users.value = mockUsers.map((item) => ({ ...item, roles: [item.role] }))
      return users.value
    }
    const response = await authApi.users()
    users.value = response.data
    return users.value
  }

  async function logout() {
    try {
      if (!isDemoMode && token.value) await authApi.logout()
    } finally {
      token.value = null
      user.value = null
      users.value = []
      localStorage.removeItem('token')
    }
  }

  return {
    token,
    user,
    users,
    isLoggedIn,
    canManageProjects,
    isAdmin,
    canDevelop,
    login,
    quickLogin,
    fetchUser,
    fetchUsers,
    logout,
  }
})
