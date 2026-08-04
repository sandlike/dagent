<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'StructuredDataViewer' })

const props = withDefaults(defineProps<{ value: unknown; level?: number }>(), { level: 0 })

const fieldLabels: Record<string, string> = {
  schema_version: '数据版本',
  summary: '摘要',
  title: '标题',
  description: '描述',
  priority: '优先级',
  repository_ids: '代码仓库',
  clarification_summary: '澄清结论',
  confirmed_answers: '确认问答',
  acceptance_criteria: '验收标准',
  goals: '目标',
  non_goals: '非目标',
  impacted_modules: '影响模块',
  frontend_changes: '前端改动',
  backend_changes: '后端改动',
  agent_changes: 'Agent 改动',
  data_changes: '数据改动',
  api_changes: '接口改动',
  implementation_steps: '实施步骤',
  risks: '风险',
  rollback_plan: '回滚方案',
  test_strategy: '测试策略',
  acceptance_checklist: '验收清单',
  changed_files: '修改文件',
  requirement_mapping: '需求对应关系',
  checks: '检查结果',
  tests: '测试结果',
  incomplete_items: '未完成事项',
  residual_risks: '遗留风险',
  manual_actions: '人工操作',
  git_commits: '代码提交',
  implementation_checklist: '实现检查清单',
  cases: '测试用例',
  totals: '统计结果',
  executions: '执行明细',
  commands: '执行命令',
  failures: '失败信息',
  log_summary: '日志摘要',
  artifact_versions: '产物版本',
  reviewer_id: '审批人',
  comment: '意见',
  accepted: '验收结果',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNested(value: unknown) {
  return Array.isArray(value) || isRecord(value)
}

function labelFor(key: string) {
  return fieldLabels[key] || key.replaceAll('_', ' ')
}

function scalarText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

const entries = computed(() => (isRecord(props.value) ? Object.entries(props.value) : []))
</script>

<template>
  <div v-if="Array.isArray(value)" class="structured-array">
    <div v-for="(item, index) in value" :key="index" class="structured-array-item">
      <StructuredDataViewer v-if="isNested(item)" :value="item" :level="level + 1" />
      <span v-else>{{ scalarText(item) }}</span>
    </div>
    <span v-if="!value.length" class="empty-value">暂无内容</span>
  </div>
  <dl v-else-if="isRecord(value)" class="structured-object">
    <template v-for="([key, item]) in entries" :key="key">
      <dt>{{ labelFor(key) }}</dt>
      <dd>
        <StructuredDataViewer v-if="isNested(item)" :value="item" :level="level + 1" />
        <span v-else>{{ scalarText(item) }}</span>
      </dd>
    </template>
  </dl>
  <span v-else>{{ scalarText(value) }}</span>
</template>

<style scoped>
.structured-object { display: grid; grid-template-columns: minmax(110px, 160px) minmax(0, 1fr); margin: 0; border-top: 1px solid #ebeef2; }
.structured-object dt, .structured-object dd { margin: 0; padding: 9px 11px; border-bottom: 1px solid #ebeef2; line-height: 1.6; }
.structured-object dt { color: #66707d; background: #f7f8fa; font-size: 12px; font-weight: 600; }
.structured-object dd { min-width: 0; color: #303844; overflow-wrap: anywhere; }
.structured-array { display: grid; gap: 7px; }
.structured-array-item { padding: 8px 10px; background: #f7f8fa; border-left: 2px solid #d20a10; }
.structured-array-item :deep(.structured-object) { background: #fff; }
.empty-value { color: #929aa5; }
@media (max-width: 640px) { .structured-object { grid-template-columns: 1fr; } .structured-object dt { border-bottom: 0; } }
</style>
