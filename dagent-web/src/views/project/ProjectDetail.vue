<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Connection, Delete, EditPen, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useRequirementStore } from '@/stores/requirement'
import type {
  PriorityCode,
  Repository,
  RepositoryVerification,
  Requirement,
  RunStatus,
  StageCode,
} from '@/api/types'
import { priorityColors, runStatusConfig, stageLabels } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const requirementStore = useRequirementStore()
const projectId = computed(() => Number(route.params.id))
const project = computed(() => projectStore.currentProject)
const showBindDialog = ref(false)
const binding = ref(false)
const deletingCredential = ref(false)
const verifyingRepositoryId = ref<number | null>(null)
const deletingRepositoryId = ref<number | null>(null)
const editingRepository = ref<Repository | null>(null)
const bindForm = reactive({
  name: '',
  provider: 'git',
  url: '',
  default_branch: 'main',
  username: '',
  token: '',
})

function resetRepositoryForm() {
  editingRepository.value = null
  Object.assign(bindForm, {
    name: '',
    provider: 'git',
    url: '',
    default_branch: 'main',
    username: '',
    token: '',
  })
}

function openBindRepository() {
  resetRepositoryForm()
  showBindDialog.value = true
}

function openEditRepository(repository: Repository) {
  editingRepository.value = repository
  Object.assign(bindForm, {
    name: repository.name,
    provider: repository.provider,
    url: repository.url,
    default_branch: repository.default_branch,
    username: '',
    token: '',
  })
  showBindDialog.value = true
}

function notifyVerification(result: RepositoryVerification) {
  const messages = {
    read_success: '读取验证成功，尚未配置推送凭据',
    read_write_success: '读取和推送权限验证成功',
    token_invalid: 'Access Token 无效，请更新后重试',
    no_write_permission: '仓库可以读取，但当前 Token 没有写权限',
    read_failed: '仓库或默认分支无法读取',
  }
  if (result.result === 'read_success' || result.result === 'read_write_success') {
    ElMessage.success(messages[result.result])
  } else {
    ElMessage.error(messages[result.result])
  }
}

async function load() {
  if (!authStore.user) await authStore.fetchUser()
  await Promise.all([
    projectStore.fetchDetail(projectId.value),
    projectStore.fetchRepositories(projectId.value),
    requirementStore.fetchList({ project_id: projectId.value, page_size: 100 }),
  ])
}

function isBranchOrFileUrl(value: string) {
  try {
    const path = new URL(value).pathname.toLowerCase()
    return /\/(?:-\/)?(?:tree|blob)\/[^/]+/.test(path) || /\/src\/[^/]+/.test(path)
  } catch {
    return false
  }
}

async function handleBindRepository() {
  if (!editingRepository.value && (!bindForm.name.trim() || !bindForm.url.trim())) {
    ElMessage.warning('请填写仓库名称和 URL')
    return
  }
  if (!bindForm.url.trim().startsWith('https://')) {
    ElMessage.warning('当前仅支持 HTTPS 仓库地址')
    return
  }
  if (!editingRepository.value && isBranchOrFileUrl(bindForm.url.trim())) {
    ElMessage.warning('请填写仓库主地址，不能填写分支或文件页面地址')
    return
  }
  if ((bindForm.username.trim() && !bindForm.token) || (!bindForm.username.trim() && bindForm.token)) {
    ElMessage.warning('Git 用户名和 Access Token 需要同时填写')
    return
  }
  binding.value = true
  try {
    const repository = editingRepository.value || await projectStore.bindRepository(projectId.value, {
      name: bindForm.name,
      provider: bindForm.provider,
      url: bindForm.url,
      default_branch: bindForm.default_branch,
    })
    if (bindForm.token) {
      await projectStore.setRepositoryCredential(repository.id, {
        username: bindForm.username.trim(),
        token: bindForm.token,
      })
    }
    ElMessage.success(
      bindForm.token
        ? 'Token 已加密保存，请在仓库列表中单独验证连接'
        : '仓库已保存，请在仓库列表中单独验证连接',
    )
    showBindDialog.value = false
    resetRepositoryForm()
  } finally {
    binding.value = false
  }
}

async function handleDeleteCredential() {
  const repository = editingRepository.value
  if (!repository) return
  await ElMessageBox.confirm('删除后将无法使用该凭据推送代码。确认继续？', '删除 Token', {
    type: 'warning',
    confirmButtonText: '删除',
  })
  deletingCredential.value = true
  try {
    const updated = await projectStore.deleteRepositoryCredential(repository.id)
    editingRepository.value = updated
    bindForm.username = ''
    bindForm.token = ''
    ElMessage.success('仓库凭据已删除')
  } finally {
    deletingCredential.value = false
  }
}

async function handleDeleteRepository(repositoryId: number) {
  await ElMessageBox.confirm(
    '删除后，该项目不能再选择此仓库，但不会删除远端 Git 仓库。已被需求使用的仓库不能删除。',
    '删除代码仓库',
    {
      type: 'warning',
      confirmButtonText: '删除',
    },
  )
  deletingRepositoryId.value = repositoryId
  try {
    const result = await projectStore.deleteRepository(projectId.value, repositoryId)
    ElMessage.success(
      result.repository_deleted ? '代码仓库已删除' : '已从当前项目删除，仓库仍被其他项目使用',
    )
  } finally {
    deletingRepositoryId.value = null
  }
}

async function handleVerifyRepository(repositoryId: number) {
  verifyingRepositoryId.value = repositoryId
  try {
    notifyVerification(await projectStore.verifyRepository(repositoryId))
  } finally {
    verifyingRepositoryId.value = null
  }
}

function repositoryStatus(status: string) {
  return {
    verified: { label: '已验证', type: 'success' as const },
    credential_invalid: { label: 'Token 无效', type: 'danger' as const },
    read_only: { label: '无写权限', type: 'warning' as const },
    verification_failed: { label: '读取失败', type: 'danger' as const },
    unverified: { label: '待验证', type: 'info' as const },
  }[status] || { label: status, type: 'info' as const }
}

function formatDate(value: string) {
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

onMounted(load)
</script>

<template>
  <div v-if="project" class="project-detail">
    <div class="page-heading">
      <div>
        <el-button :icon="ArrowLeft" text @click="router.push('/projects')">项目空间</el-button>
        <div class="title-row">
          <h1>{{ project.name }}</h1>
          <el-tag :type="project.status === 'active' ? 'success' : 'info'">{{ project.status }}</el-tag>
        </div>
        <p>{{ project.description || '暂无项目描述' }}</p>
      </div>
      <el-button v-if="authStore.canManageProjects" type="primary" :icon="Plus" @click="openBindRepository">
        绑定仓库
      </el-button>
    </div>

    <div class="project-facts">
      <div><span>项目 ID</span><strong>{{ project.id }}</strong></div>
      <div><span>仓库</span><strong>{{ project.repository_count }}</strong></div>
      <div><span>需求</span><strong>{{ project.requirement_count }}</strong></div>
      <div><span>更新时间</span><strong>{{ formatDate(project.updated_at) }}</strong></div>
    </div>

    <section class="data-section model-route-section">
      <div class="section-heading"><h2>Agent 模型</h2><span>按当前用户配置</span></div>
      <div class="model-route-control">
        <el-icon><Connection /></el-icon>
        <strong>个人模型池</strong>
        <el-button type="primary" plain @click="router.push('/model-gateway')">模型网关</el-button>
      </div>
    </section>

    <section class="data-section">
      <div class="section-heading"><h2>代码仓库</h2><span>仓库连接需单独验证</span></div>
      <el-table :data="projectStore.repositories" empty-text="暂未绑定仓库">
        <el-table-column prop="name" label="仓库" min-width="160" />
        <el-table-column prop="url" label="地址" min-width="300" show-overflow-tooltip />
        <el-table-column prop="default_branch" label="默认分支" width="130" />
        <el-table-column label="连接状态" width="120">
          <template #default="{ row }">
            <el-tag :type="repositoryStatus(row.status).type">{{ repositoryStatus(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="推送凭据" width="110">
          <template #default="{ row }">
            <el-tag :type="row.credential_configured ? 'success' : 'info'">
              {{ row.credential_configured ? '已配置' : '未配置' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="275" fixed="right" align="right">
          <template #default="{ row }">
            <el-button
              text
              type="primary"
              :icon="Check"
              :loading="verifyingRepositoryId === row.id"
              @click="handleVerifyRepository(row.id)"
            >验证连接</el-button>
            <el-button v-if="authStore.canManageProjects" text :icon="EditPen" @click="openEditRepository(row)">编辑</el-button>
            <el-button
              v-if="authStore.canManageProjects"
              text
              type="danger"
              :icon="Delete"
              :loading="deletingRepositoryId === row.id"
              @click="handleDeleteRepository(row.id)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="data-section">
      <div class="section-heading"><h2>关联需求</h2><span>当前项目内的真实需求记录</span></div>
      <el-table :data="requirementStore.requirements" empty-text="暂无关联需求" @row-click="openRequirement">
        <el-table-column prop="title" label="需求" min-width="280" show-overflow-tooltip />
        <el-table-column label="优先级" width="90">
          <template #default="{ row }"><el-tag :color="getPriorityColor(row.priority)" effect="dark" class="priority-tag">{{ row.priority }}</el-tag></template>
        </el-table-column>
        <el-table-column label="阶段" min-width="170"><template #default="{ row }">{{ getStageLabel(row.stage) }}</template></el-table-column>
        <el-table-column label="运行状态" width="140"><template #default="{ row }"><el-tag :type="getRunStatus(row.run_status).type">{{ getRunStatus(row.run_status).label }}</el-tag></template></el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="showBindDialog"
      :title="editingRepository ? '编辑代码仓库' : '绑定代码仓库'"
      width="560px"
      destroy-on-close
      @closed="resetRepositoryForm"
    >
      <el-form label-position="top">
        <el-form-item label="仓库名称" required><el-input v-model="bindForm.name" :disabled="Boolean(editingRepository)" placeholder="例如：trading-api" /></el-form-item>
        <el-form-item label="仓库主地址" required>
          <el-input v-model="bindForm.url" :disabled="Boolean(editingRepository)" placeholder="https://git.example.com/team/repository.git" />
          <div class="field-hint">只填写仓库主地址，不能填写包含 /tree/、/-/tree/ 或 /src/ 的分支页面地址。</div>
        </el-form-item>
        <el-form-item label="默认分支"><el-input v-model="bindForm.default_branch" :disabled="Boolean(editingRepository)" /></el-form-item>
        <div v-if="editingRepository" class="credential-state">
          <span>凭据状态</span>
          <el-tag :type="editingRepository.credential_configured ? 'success' : 'info'">
            {{ editingRepository.credential_configured ? '已配置' : '未配置' }}
          </el-tag>
        </div>
        <el-form-item label="Git 用户名" :required="Boolean(bindForm.token)">
          <el-input v-model="bindForm.username" autocomplete="off" placeholder="GitHub 用户名" />
        </el-form-item>
        <el-form-item label="Access Token" :required="Boolean(bindForm.username)">
          <el-input
            v-model="bindForm.token"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="editingRepository?.credential_configured ? '留空则继续使用已配置 Token' : 'Personal Access Token'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="editingRepository?.credential_configured"
            type="danger"
            plain
            :loading="deletingCredential"
            @click="handleDeleteCredential"
          >删除 Token</el-button>
          <span />
          <el-button @click="showBindDialog = false">取消</el-button>
          <el-button type="primary" :loading="binding" @click="handleBindRepository">
            {{ bindForm.token ? '保存 Token' : (editingRepository ? '完成' : '保存仓库') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
  <el-empty v-else description="项目空间不存在" />
</template>

<style scoped>
.project-detail { max-width: 1440px; margin: 0 auto; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
.page-heading > div > .el-button { padding-left: 0; margin-bottom: 8px; }
.title-row { display: flex; align-items: center; gap: 10px; }
.title-row h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 8px 0 0; color: #687281; font-size: 13px; }
.project-facts { display: grid; grid-template-columns: 120px 100px 100px 1fr; border: 1px solid #dfe3e8; background: #fff; margin-bottom: 18px; }
.project-facts > div { min-height: 72px; padding: 14px 16px; border-right: 1px solid #e4e7eb; display: flex; flex-direction: column; gap: 7px; }
.project-facts > div:last-child { border-right: 0; }
.project-facts span { font-size: 12px; color: #848d99; }
.project-facts strong { font-size: 14px; color: #2b3441; }
.data-section { background: #fff; border: 1px solid #dfe3e8; margin-bottom: 18px; }
.section-heading { min-height: 62px; padding: 0 17px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e6e9ed; }
.section-heading h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.section-heading span { color: #89919c; font-size: 12px; }
.model-route-control { min-height: 72px; padding: 0 18px; display: flex; align-items: center; gap: 12px; }
.model-route-control > .el-icon { width: 34px; height: 34px; border-radius: 5px; color: #d20a10; background: #fbe7e7; font-size: 17px; }
.model-route-control strong { font-size: 14px; color: #374151; }
.field-hint { margin-top: 6px; color: #7a8491; font-size: 12px; line-height: 1.5; }
.credential-state { min-height: 36px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; color: #606b78; font-size: 14px; }
.dialog-footer { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px; }
.priority-tag { border: 0; }
:deep(.el-table__row) { cursor: pointer; }
@media (max-width: 720px) { .project-facts { grid-template-columns: repeat(2, 1fr); } .page-heading { align-items: flex-start; } }
</style>
