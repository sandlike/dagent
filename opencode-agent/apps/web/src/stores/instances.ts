import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Instance } from '@opencode/shared'
import type { DeployRequest } from '@opencode/shared'
import * as instancesApi from '@/api/instances'

export const useInstancesStore = defineStore('instances', () => {
  const list = ref<Instance[]>([])
  const loading = ref(false)
  const current = ref<Instance | null>(null)
  const versions = ref<Instance[]>([])

  async function fetchList() {
    loading.value = true
    try {
      list.value = await instancesApi.listInstances()
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: number | string) {
    current.value = await instancesApi.getInstance(id)
    return current.value
  }

  async function fetchVersions(id: number | string) {
    versions.value = await instancesApi.listVersions(id)
    return versions.value
  }

  async function update(id: number | string, body: DeployRequest) {
    const res = await instancesApi.updateInstance(id, body)
    current.value = res.instance
    return res
  }

  async function rollback(id: number | string, versionNum: number) {
    const res = await instancesApi.rollbackInstance(id, versionNum)
    await fetchOne(id)
    await fetchVersions(id)
    return res
  }

  async function remove(id: number | string) {
    await instancesApi.deleteInstance(id)
    await fetchList()
  }

  async function restart(id: number | string) {
    await instancesApi.restartInstance(id)
  }

  function setCurrent(inst: Instance | null) {
    current.value = inst
  }

  return {
    list, loading, current, versions,
    fetchList, fetchOne, fetchVersions, update, rollback, remove, restart, setCurrent,
  }
})
