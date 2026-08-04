// @ts-nocheck -- Legacy demo store retained for the explicit demo build.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Proposal } from '@/api/types'
import { mockProposals } from '@/mock/data'

export const useProposalStore = defineStore('proposal', () => {
  const proposals = ref<Proposal[]>([...mockProposals])

  function getByRequirementId(requirementId: number): Proposal | undefined {
    return proposals.value.find(p => p.requirement_id === requirementId)
  }

  return { proposals, getByRequirementId }
})
