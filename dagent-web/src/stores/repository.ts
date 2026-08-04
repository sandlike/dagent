// @ts-nocheck -- Legacy demo store retained for the explicit demo build.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Repository, Branch } from '@/api/types'
import { mockRepositories, mockBranches } from '@/mock/data'

export const useRepositoryStore = defineStore('repository', () => {
  const repositories = ref<Repository[]>([...mockRepositories])
  const loading = ref(false)

  function getBranches(repoId: number): Branch[] {
    return mockBranches.filter(b => b.repository_id === repoId)
  }

  return { repositories, loading, getBranches }
})
