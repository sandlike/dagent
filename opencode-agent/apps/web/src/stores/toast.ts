import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  variant: 'success' | 'error' | 'info'
}

let _id = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function show(message: string, variant: ToastItem['variant'] = 'info', timeout = 3000) {
    const id = ++_id
    items.value.push({ id, message, variant })
    if (timeout > 0) setTimeout(() => dismiss(id), timeout)
    return id
  }
  const success = (m: string) => show(m, 'success')
  const error = (m: string) => show(m, 'error')
  const info = (m: string) => show(m, 'info')

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, show, success, error, info, dismiss }
})
