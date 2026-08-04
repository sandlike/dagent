import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  projectApi,
  type ProjectCreate,
  type RepositoryBind,
  type RepositoryCredential,
} from '@/api/projects'
import type { Project, Repository } from '@/api/types'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const repositories = ref<Repository[]>([])
  const loading = ref(false)

  async function fetchList() {
    loading.value = true
    try {
      const response = await projectApi.list({ page: 1, page_size: 100 })
      projects.value = response.data.items
      return projects.value
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    const response = await projectApi.detail(id)
    currentProject.value = response.data
    const index = projects.value.findIndex((item) => item.id === id)
    if (index >= 0) projects.value[index] = response.data
    else projects.value.push(response.data)
    return response.data
  }

  async function createProject(data: ProjectCreate) {
    const response = await projectApi.create(data)
    projects.value.unshift(response.data)
    return response.data
  }

  async function fetchRepositories(projectId: number) {
    const response = await projectApi.repositories(projectId)
    repositories.value = response.data
    return repositories.value
  }

  async function bindRepository(projectId: number, data: RepositoryBind) {
    const response = await projectApi.bindRepository(projectId, data)
    repositories.value.unshift(response.data)
    await fetchDetail(projectId)
    return response.data
  }

  async function deleteRepository(projectId: number, repositoryId: number) {
    const response = await projectApi.deleteRepository(projectId, repositoryId)
    repositories.value = repositories.value.filter((item) => item.id !== repositoryId)
    await fetchDetail(projectId)
    return response.data
  }

  async function verifyRepository(repositoryId: number) {
    const response = await projectApi.verifyRepository(repositoryId)
    const index = repositories.value.findIndex((item) => item.id === repositoryId)
    if (index >= 0) repositories.value[index] = response.data.repository
    return response.data
  }

  async function setRepositoryCredential(repositoryId: number, data: RepositoryCredential) {
    const response = await projectApi.setRepositoryCredential(repositoryId, data)
    const index = repositories.value.findIndex((item) => item.id === repositoryId)
    if (index >= 0) repositories.value[index] = response.data
    return response.data
  }

  async function deleteRepositoryCredential(repositoryId: number) {
    const response = await projectApi.deleteRepositoryCredential(repositoryId)
    const index = repositories.value.findIndex((item) => item.id === repositoryId)
    if (index >= 0) repositories.value[index] = response.data
    return response.data
  }

  function getById(id: number) {
    return projects.value.find((item) => item.id === id)
  }

  return {
    projects,
    currentProject,
    repositories,
    loading,
    fetchList,
    fetchDetail,
    createProject,
    fetchRepositories,
    bindRepository,
    deleteRepository,
    verifyRepository,
    setRepositoryCredential,
    deleteRepositoryCredential,
    getById,
  }
})
