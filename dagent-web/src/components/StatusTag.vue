<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: 'requirement' | 'pipeline' | 'branch' | 'proposal'
  status: string
}>()

const requirementStatus: Record<string, { label: string; tagType: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  draft: { label: '草稿', tagType: 'info' },
  analyzing: { label: '分析中', tagType: 'warning' },
  clarifying: { label: '澄清中', tagType: 'warning' },
  clarified: { label: '已澄清', tagType: '' },
  proposing: { label: '方案生成中', tagType: 'warning' },
  reviewing: { label: '方案审批中', tagType: 'warning' },
  ready: { label: '就绪', tagType: 'success' },
  coding: { label: '编码中', tagType: '' },
  testing: { label: '测试中', tagType: 'warning' },
  delivering: { label: '提测中', tagType: 'warning' },
  delivered: { label: '已交付', tagType: 'success' },
}

const pipelineStatus: Record<string, { label: string; tagType: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  running: { label: '运行中', tagType: '' },
  paused_for_review: { label: '等待审核', tagType: 'warning' },
  completed: { label: '已完成', tagType: 'success' },
  failed: { label: '失败', tagType: 'danger' },
  cancelled: { label: '已取消', tagType: 'info' },
}

const branchStatus: Record<string, { label: string; tagType: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  active: { label: '活跃', tagType: 'success' },
  merged: { label: '已合并', tagType: '' },
  closed: { label: '已关闭', tagType: 'info' },
}

const proposalStatus: Record<string, { label: string; tagType: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  draft: { label: '草稿', tagType: 'info' },
  reviewing: { label: '审核中', tagType: 'warning' },
  approved: { label: '已通过', tagType: 'success' },
  rejected: { label: '已驳回', tagType: 'danger' },
}

const configMap = {
  requirement: requirementStatus,
  pipeline: pipelineStatus,
  branch: branchStatus,
  proposal: proposalStatus,
}

const config = computed(() => {
  const map = configMap[props.type]
  return map[props.status] || { label: props.status, tagType: 'info' as const }
})
</script>

<template>
  <el-tag :type="config.tagType" size="small" effect="plain">
    {{ config.label }}
  </el-tag>
</template>
