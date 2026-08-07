<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { requirementApi } from '@/api/requirements'
import type { AgentDefinition, PriorityCode, Requirement, RunStatus, StageCode } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useRequirementStore } from '@/stores/requirement'
import { priorityColors, runStatusConfig, stageLabels, stageOrder } from '@/utils/status'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const store = useRequirementStore()
const page = ref(1)
const pageSize = ref(20)
const showCreateDialog = ref(false)
const saving = ref(false)
const agents = ref<AgentDefinition[]>([])
const filters = reactive({ stage: '', priority: '', project_id: undefined as number | undefined })
const form = reactive({
  project_id: undefined as number | undefined,
  title: '',
  description: '',
  priority: 'P2' as PriorityCode,
  repository_ids: [] as number[],
  requirement_agent_version_id: undefined as number | undefined,
  development_document_agent_version_id: undefined as number | undefined,
  development_agent_version_id: undefined as number | undefined,
  workspace_retention_policy: 'retain' as 'retain' | 'delete',
})

const canCreate = computed(() => authStore.user?.roles.some((role) => ['admin', 'pm'].includes(role)))
const projectNames = computed(() =>
  Object.fromEntries(projectStore.projects.map((project) => [project.id, project.name])),
)
const requirementAgentVersions = computed(() =>
  agents.value.filter((item) => item.role_type === 'requirement_clarification').flatMap((item) => item.versions.map((version) => ({ ...version, name: item.name }))),
)
const developmentAgentVersions = computed(() =>
  agents.value.filter((item) => item.role_type === 'development').flatMap((item) => item.versions.map((version) => ({ ...version, name: item.name }))),
)
const developmentDocumentAgentVersions = computed(() =>
  agents.value.filter((item) => item.role_type === 'development_document').flatMap((item) => item.versions.map((version) => ({ ...version, name: item.name }))),
)
async function fetchList() {
  await store.fetchList({
    page: page.value,
    page_size: pageSize.value,
    stage: filters.stage || undefined,
    priority: filters.priority || undefined,
    project_id: filters.project_id,
  })
}

async function openCreateDialog() {
  const response = await requirementApi.agentDefinitions()
  agents.value = response.data
  showCreateDialog.value = true
}

async function handleCreate() {
  if (!form.project_id || !form.title.trim() || !form.description.trim()) {
    ElMessage.warning('请完整填写项目、标题和需求描述')
    return
  }
  if (!form.repository_ids.length) {
    ElMessage.warning('请至少选择一个代码仓库')
    return
  }
  saving.value = true
  try {
    const requirement = await store.createRequirement({
      project_id: form.project_id,
      title: form.title,
      description: form.description,
      priority: form.priority,
      repository_ids: form.repository_ids,
      requirement_agent_version_id: form.requirement_agent_version_id,
      development_document_agent_version_id: form.development_document_agent_version_id,
      development_agent_version_id: form.development_agent_version_id,
      workspace_retention_policy: form.workspace_retention_policy,
    })
    ElMessage.success('需求草稿已创建')
    showCreateDialog.value = false
    router.push(`/requirements/${requirement.id}`)
  } finally {
    saving.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { stage: '', priority: '', project_id: undefined })
  page.value = 1
  fetchList()
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function openRequirement(row: Requirement) {
  router.push(`/requirements/${row.id}`)
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

watch(
  () => form.project_id,
  async (projectId) => {
    form.repository_ids = []
    if (projectId) await projectStore.fetchRepositories(projectId)
  },
)

onMounted(async () => {
  await Promise.all([projectStore.fetchList(), fetchList()])
})
</script>

<template>
  <div class="requirements-page">
    <div class="page-heading">
      <div>
        <h1>需求</h1>
        <p>每条需求拥有独立流程、产物、Agent 任务和审批记录</p>
      </div>
      <el-button v-if="canCreate" type="primary" :icon="Plus" @click="openCreateDialog">新建需求</el-button>
    </div>

    <div class="filter-bar">
      <el-select v-model="filters.project_id" clearable placeholder="全部项目" style="width: 190px">
        <el-option v-for="project in projectStore.projects" :key="project.id" :label="project.name" :value="project.id" />
      </el-select>
      <el-select v-model="filters.stage" clearable placeholder="全部阶段" style="width: 190px">
        <el-option v-for="stage in stageOrder" :key="stage" :label="stageLabels[stage]" :value="stage" />
      </el-select>
      <el-select v-model="filters.priority" clearable placeholder="全部优先级" style="width: 140px">
        <el-option v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority" :label="priority" :value="priority" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="page = 1; fetchList()">查询</el-button>
      <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
    </div>

    <section class="data-section" v-loading="store.loading">
      <el-table :data="store.requirements" empty-text="暂无需求" @row-click="openRequirement">
        <el-table-column label="编号" width="100"><template #default="{ row }">REQ-{{ row.id }}</template></el-table-column>
        <el-table-column prop="title" label="需求标题" min-width="280" show-overflow-tooltip />
        <el-table-column label="项目" min-width="150"><template #default="{ row }">{{ projectNames[row.project_id] || `项目 #${row.project_id}` }}</template></el-table-column>
        <el-table-column label="优先级" width="90" align="center"><template #default="{ row }"><el-tag :color="getPriorityColor(row.priority)" effect="dark" class="priority-tag">{{ row.priority }}</el-tag></template></el-table-column>
        <el-table-column label="阶段" min-width="180"><template #default="{ row }">{{ getStageLabel(row.stage) }}</template></el-table-column>
        <el-table-column label="运行状态" width="140"><template #default="{ row }"><el-tag :type="getRunStatus(row.run_status).type">{{ getRunStatus(row.run_status).label }}</el-tag></template></el-table-column>
        <el-table-column label="更新时间" width="190"><template #default="{ row }">{{ formatTime(row.updated_at) }}</template></el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" layout="total, sizes, prev, pager, next" :total="store.total" :page-sizes="[20, 50, 100]" @change="fetchList" />
      </div>
    </section>

    <el-dialog v-model="showCreateDialog" title="新建需求草稿" width="680px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="所属项目" required>
            <el-select v-model="form.project_id" style="width: 100%" placeholder="选择项目">
              <el-option v-for="project in projectStore.projects.filter((item) => item.status === 'active')" :key="project.id" :label="project.name" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="form.priority" style="width: 100%"><el-option v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority" :value="priority" /></el-select>
          </el-form-item>
        </div>
        <el-form-item label="需求标题" required><el-input v-model="form.title" maxlength="240" /></el-form-item>
        <el-form-item label="需求描述" required><el-input v-model="form.description" type="textarea" :rows="7" maxlength="100000" /></el-form-item>
        <el-form-item label="涉及仓库" required>
          <el-select v-model="form.repository_ids" multiple style="width: 100%" :disabled="!form.project_id" placeholder="先选择项目">
            <el-option v-for="repository in projectStore.repositories" :key="repository.id" :label="`${repository.name} (${repository.default_branch})`" :value="repository.id" />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="需求澄清 Agent">
            <el-select v-model="form.requirement_agent_version_id" clearable style="width: 100%" placeholder="使用项目默认配置">
              <el-option v-for="version in requirementAgentVersions" :key="version.id" :label="`${version.name} / ${version.style} v${version.version}`" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="开发文档 Agent">
            <el-select v-model="form.development_document_agent_version_id" clearable style="width: 100%" placeholder="使用项目默认配置">
              <el-option v-for="version in developmentDocumentAgentVersions" :key="version.id" :label="`${version.name} / ${version.style} v${version.version}`" :value="version.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="开发 Agent">
            <el-select v-model="form.development_agent_version_id" clearable style="width: 100%" placeholder="使用项目默认配置">
              <el-option v-for="version in developmentAgentVersions" :key="version.id" :label="`${version.name} / ${version.style} v${version.version}`" :value="version.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="需求完成或删除后的 Workspace">
          <el-segmented v-model="form.workspace_retention_policy" :options="[{ label: '保留', value: 'retain' }, { label: '删除', value: 'delete' }]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreate">创建草稿</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.requirements-page { max-width: 1500px; margin: 0 auto; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 7px 0 0; color: #697381; font-size: 13px; }
.filter-bar { display: flex; align-items: center; gap: 10px; padding: 14px; background: #fff; border: 1px solid #dfe3e8; border-bottom: 0; flex-wrap: wrap; }
.data-section { background: #fff; border: 1px solid #dfe3e8; }
.pagination-row { display: flex; justify-content: flex-end; padding: 14px 16px; border-top: 1px solid #e5e8ec; }
.priority-tag { border: 0; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
:deep(.el-table__row) { cursor: pointer; }
@media (max-width: 680px) { .form-grid { grid-template-columns: 1fr; gap: 0; } }
</style>
