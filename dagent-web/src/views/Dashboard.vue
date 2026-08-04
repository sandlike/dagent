<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheck, Document, Folder, Loading, Sort } from '@element-plus/icons-vue'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary, PriorityCode, Requirement, RunStatus, StageCode } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { priorityColors, runStatusConfig, stageLabels } from '@/utils/status'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const loading = ref(false)
const summary = ref<DashboardSummary>({
  project_count: 0,
  requirement_count: 0,
  waiting_human_count: 0,
  running_task_count: 0,
  waiting_merge_count: 0,
})
const todos = ref<Requirement[]>([])
const recentRequirements = ref<Requirement[]>([])

const projectNames = computed(() =>
  Object.fromEntries(projectStore.projects.map((project) => [project.id, project.name])),
)

async function loadDashboard() {
  loading.value = true
  try {
    const [summaryResponse, todoResponse, recentResponse] = await Promise.all([
      dashboardApi.summary(),
      dashboardApi.todos(),
      dashboardApi.recentRequirements(),
      projectStore.fetchList(),
    ])
    summary.value = summaryResponse.data
    todos.value = todoResponse.data
    recentRequirements.value = recentResponse.data
  } finally {
    loading.value = false
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function openRequirement(row: Requirement) {
  router.push(`/requirements/${row.id}`)
}

function getProjectName(projectId: number) {
  return projectNames.value[projectId] || `项目 #${projectId}`
}

function getPriorityColor(priority: PriorityCode) {
  return priorityColors[priority]
}

function getStageLabel(stage: StageCode) {
  return stageLabels[stage]
}

function getRunStatus(status: RunStatus) {
  return runStatusConfig[status]
}

onMounted(loadDashboard)
</script>

<template>
  <div v-loading="loading" class="dashboard-page">
    <div class="page-heading">
      <div>
        <h1>工作台</h1>
        <p>{{ authStore.user?.username }}，这里是当前项目和需求的实时状态。</p>
      </div>
    </div>

    <div class="metrics-grid">
      <button class="metric" type="button" @click="router.push('/requirements')">
        <el-icon class="metric-icon requirements"><Document /></el-icon>
        <span class="metric-value">{{ summary.requirement_count }}</span>
        <span class="metric-label">需求总数</span>
      </button>
      <button class="metric" type="button" @click="router.push('/projects')">
        <el-icon class="metric-icon projects"><Folder /></el-icon>
        <span class="metric-value">{{ summary.project_count }}</span>
        <span class="metric-label">项目空间</span>
      </button>
      <button class="metric" type="button" @click="router.push('/requirements')">
        <el-icon class="metric-icon waiting"><CircleCheck /></el-icon>
        <span class="metric-value">{{ summary.waiting_human_count }}</span>
        <span class="metric-label">等待人工处理</span>
      </button>
      <button class="metric" type="button" @click="router.push('/requirements')">
        <el-icon class="metric-icon running"><Loading /></el-icon>
        <span class="metric-value">{{ summary.running_task_count }}</span>
        <span class="metric-label">运行中任务</span>
      </button>
      <button class="metric" type="button" @click="router.push('/requirements')">
        <el-icon class="metric-icon merge"><Sort /></el-icon>
        <span class="metric-value">{{ summary.waiting_merge_count }}</span>
        <span class="metric-label">等待合并</span>
      </button>
    </div>

    <section class="data-section">
      <div class="section-heading">
        <div>
          <h2>我的待办</h2>
          <span>仅显示当前角色可以处理的人工门禁</span>
        </div>
        <el-button text type="primary" @click="router.push('/requirements')">查看全部</el-button>
      </div>
      <el-table :data="todos" empty-text="当前没有待办" @row-click="openRequirement">
        <el-table-column prop="title" label="需求" min-width="260" show-overflow-tooltip />
        <el-table-column label="项目" min-width="150">
          <template #default="{ row }">{{ getProjectName(row.project_id) }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="90" align="center">
          <template #default="{ row }">
            <el-tag :color="getPriorityColor(row.priority)" effect="dark" class="priority-tag">{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前阶段" min-width="160">
          <template #default="{ row }">{{ getStageLabel(row.stage) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag :type="getRunStatus(row.run_status).type">{{ getRunStatus(row.run_status).label }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="data-section">
      <div class="section-heading">
        <div>
          <h2>最近需求</h2>
          <span>按最近更新时间排序</span>
        </div>
      </div>
      <el-table :data="recentRequirements" empty-text="暂无需求" @row-click="openRequirement">
        <el-table-column prop="title" label="需求" min-width="300" show-overflow-tooltip />
        <el-table-column label="阶段" min-width="180">
          <template #default="{ row }">{{ getStageLabel(row.stage) }}</template>
        </el-table-column>
        <el-table-column label="运行状态" width="140">
          <template #default="{ row }">
            <el-tag :type="getRunStatus(row.run_status).type">{{ getRunStatus(row.run_status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="190">
          <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page { max-width: 1440px; margin: 0 auto; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 7px 0 0; color: #6b7280; font-size: 13px; }
.metrics-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; background: #dfe3e8; border: 1px solid #dfe3e8; margin-bottom: 22px; }
.metric { min-height: 116px; border: 0; background: #fff; padding: 20px; display: grid; grid-template-columns: 42px 1fr; grid-template-rows: 1fr 1fr; column-gap: 14px; text-align: left; cursor: pointer; }
.metric:hover { background: #f8fafc; }
.metric-icon { grid-row: 1 / 3; align-self: center; width: 40px; height: 40px; border-radius: 6px; font-size: 20px; }
.metric-icon.requirements { color: #d20a10; background: #fbe7e7; }
.metric-icon.projects { color: #287a4b; background: #e9f5ee; }
.metric-icon.waiting { color: #a45d00; background: #fff3df; }
.metric-icon.running { color: #6f42a5; background: #f2ebf8; }
.metric-icon.merge { color: #8a4b20; background: #f8eee7; }
.metric-value { align-self: end; font-size: 27px; font-weight: 650; color: #1f2937; }
.metric-label { align-self: start; font-size: 13px; color: #6b7280; }
.data-section { background: #fff; border: 1px solid #e1e5ea; margin-bottom: 18px; }
.section-heading { min-height: 66px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e8ebef; }
.section-heading h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.section-heading span { display: block; margin-top: 5px; color: #8a919c; font-size: 12px; }
.priority-tag { border: 0; }
:deep(.el-table__row) { cursor: pointer; }
@media (max-width: 900px) { .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .metrics-grid { grid-template-columns: 1fr; } }
</style>
