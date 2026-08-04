// @ts-nocheck -- Legacy demo store retained for the explicit demo build.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Pipeline, PipelineStage, AgentTask } from '@/api/types'
import { isDemoMode } from '@/utils/env'
import { mockPipelines, mockPipelineStages, mockAgentTasks } from '@/mock/data'

export const usePipelineStore = defineStore('pipeline', () => {
  const pipelines = ref<Pipeline[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchList(params: { page?: number; page_size?: number; status?: string } = {}) {
    loading.value = true
    try {
      if (isDemoMode) {
        let filtered = [...mockPipelines]
        if (params.status) filtered = filtered.filter(p => p.status === params.status)
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const page = params.page || 1
        const pageSize = params.page_size || 20
        const start = (page - 1) * pageSize
        pipelines.value = filtered.slice(start, start + pageSize)
        total.value = filtered.length
      }
    } finally {
      loading.value = false
    }
  }

  function getByRequirementId(reqId: number): Pipeline | undefined {
    return mockPipelines.find(p => p.requirement_id === reqId)
  }

  function getStages(pipelineId: number): PipelineStage[] {
    return mockPipelineStages.filter(s => s.pipeline_id === pipelineId).sort((a, b) => a.stage_order - b.stage_order)
  }

  function getAgentTasks(stageId: number): AgentTask[] {
    return mockAgentTasks.filter(t => t.pipeline_stage_id === stageId)
  }

  return { pipelines, total, loading, fetchList, getByRequirementId, getStages, getAgentTasks }
})
