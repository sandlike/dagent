import { ref } from 'vue'
import { defineStore } from 'pinia'
import { requirementApi, type RequirementCreate } from '@/api/requirements'
import type { Requirement } from '@/api/types'

export const useRequirementStore = defineStore('requirement', () => {
  const requirements = ref<Requirement[]>([])
  const currentRequirement = ref<Requirement | null>(null)
  const total = ref(0)
  const loading = ref(false)

  async function fetchList(
    params: {
      page?: number
      page_size?: number
      stage?: string
      priority?: string
      project_id?: number
    } = {},
  ) {
    loading.value = true
    try {
      const response = await requirementApi.list(params)
      requirements.value = response.data.items
      total.value = response.data.total
      return requirements.value
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    const response = await requirementApi.detail(id)
    currentRequirement.value = response.data
    const index = requirements.value.findIndex((item) => item.id === id)
    if (index >= 0) requirements.value[index] = response.data
    return response.data
  }

  async function createRequirement(data: RequirementCreate) {
    const response = await requirementApi.create(data)
    requirements.value.unshift(response.data)
    total.value += 1
    return response.data
  }

  function updateCurrent(requirement: Requirement) {
    currentRequirement.value = requirement
    const index = requirements.value.findIndex((item) => item.id === requirement.id)
    if (index >= 0) requirements.value[index] = requirement
  }

  return {
    requirements,
    currentRequirement,
    total,
    loading,
    fetchList,
    fetchDetail,
    createRequirement,
    updateCurrent,
  }
})
