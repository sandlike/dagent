import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body.code !== 0) return Promise.reject(new Error(body.message || '请求失败'))
    return body
  },
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || '网络错误'
    if (status === 401 && router.currentRoute.value.path !== '/login') {
      localStorage.removeItem('token')
      router.push('/login')
    }
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export function idempotencyHeaders(): Record<string, string> {
  return { 'Idempotency-Key': crypto.randomUUID() }
}

export default client
