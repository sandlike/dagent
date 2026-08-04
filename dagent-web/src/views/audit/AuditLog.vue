<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { auditApi } from '@/api/audit'
import type { AuditLog } from '@/api/types'

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const filters = reactive({ action: '', resource_type: '', trace_id: '' })

async function load() {
  loading.value = true
  try {
    const response = await auditApi.list({
      action: filters.action || undefined,
      resource_type: filters.resource_type || undefined,
      trace_id: filters.trace_id || undefined,
      limit: 300,
    })
    logs.value = response.data
  } finally {
    loading.value = false
  }
}

function reset() {
  Object.assign(filters, { action: '', resource_type: '', trace_id: '' })
  load()
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onMounted(load)
</script>

<template>
  <div class="audit-page">
    <header class="page-heading"><div><h1>审计日志</h1><p>关键配置、审批、任务和 Git 操作的不可变记录</p></div><el-button :icon="Refresh" @click="load">刷新</el-button></header>
    <section class="filter-band">
      <el-input v-model="filters.action" placeholder="操作，例如 git.push" clearable />
      <el-input v-model="filters.resource_type" placeholder="资源类型" clearable />
      <el-input v-model="filters.trace_id" placeholder="Trace ID" clearable />
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </section>
    <section class="data-section" v-loading="loading">
      <el-table :data="logs" empty-text="暂无审计记录">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="action" label="操作" min-width="190" />
        <el-table-column label="资源" min-width="190"><template #default="{ row }">{{ row.resource_type }} #{{ row.resource_id }}</template></el-table-column>
        <el-table-column label="操作者" width="130"><template #default="{ row }">{{ row.actor_type }} #{{ row.actor_id || '-' }}</template></el-table-column>
        <el-table-column label="结果" width="100"><template #default="{ row }"><el-tag :type="row.result === 'success' ? 'success' : 'danger'">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column prop="trace_id" label="Trace ID" min-width="220" show-overflow-tooltip />
        <el-table-column label="详情" min-width="240" show-overflow-tooltip><template #default="{ row }">{{ JSON.stringify(row.details) }}</template></el-table-column>
        <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.audit-page { max-width: 1600px; margin: 0 auto; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 7px 0 0; color: #707a87; font-size: 13px; }
.filter-band { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(160px, 1fr) minmax(220px, 1.3fr) auto auto; gap: 10px; padding: 14px; background: #fff; border: 1px solid #dfe3e8; border-bottom: 0; }
.data-section { background: #fff; border: 1px solid #dfe3e8; }
@media (max-width: 900px) { .filter-band { grid-template-columns: 1fr; } }
</style>
