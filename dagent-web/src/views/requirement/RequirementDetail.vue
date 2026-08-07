<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Close,
  Delete,
  Edit,
  MoreFilled,
  Refresh,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { requirementApi, type ReviewPayload } from '@/api/requirements'
import type {
  AgentTask,
  ArtifactSummary,
  ArtifactVersion,
  ClarificationQuestion,
  ClarificationRound,
  PipelineDetail,
  ReviewGate,
  ReviewRecord,
  RequirementWorkspace,
  MergeQueueEntry,
  TaskLog,
} from '@/api/types'
import AgentLogViewer from '@/components/AgentLogViewer.vue'
import ArtifactRenderer from '@/components/ArtifactRenderer.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useRequirementStore } from '@/stores/requirement'
import {
  artifactLabels,
  gateLabels,
  priorityColors,
  runStatusConfig,
  stageLabels,
  stageOrder,
  taskSummaryByStage,
} from '@/utils/status'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const requirementStore = useRequirementStore()
const requirementId = computed(() => Number(route.params.id))
const requirement = computed(() => requirementStore.currentRequirement)
const canDeleteRequirement = computed(() =>
  Boolean(authStore.user?.roles.some((role) => ['admin', 'pm'].includes(role))),
)
const loading = ref(false)
const pipeline = ref<PipelineDetail | null>(null)
const actions = ref<string[]>([])
const clarificationRounds = ref<ClarificationRound[]>([])
const artifacts = ref<ArtifactSummary[]>([])
const artifactVersions = ref<Record<string, ArtifactVersion[]>>({})
const reviews = ref<ReviewRecord[]>([])
const tasks = ref<AgentTask[]>([])
const taskStarting = ref(false)
const workspaces = ref<RequirementWorkspace[]>([])
const mergeQueue = ref<MergeQueueEntry[]>([])
const workspaceBusy = ref<number | null>(null)
const selectedArtifactType = ref('')
const selectedArtifactVersionNumber = ref<number | null>(null)
const answerValues = reactive<Record<number, unknown>>({})
const answerCustom = reactive<Record<number, string>>({})
const OTHER_ANSWER = '__other__'
const showClarificationConfirm = ref(false)
const clarificationSummary = ref('')
const showReviewDialog = ref(false)
const deliverySubmitting = ref(false)
const reviewAction = ref<'approve' | 'reject' | 'transfer'>('approve')
const reviewComment = ref('')
const reviewAssigneeId = ref<number>()
const showReviseDialog = ref(false)
const reviseContent = ref('')
const reviseComment = ref('')
const showLogDialog = ref(false)
const taskLogs = ref<TaskLog[]>([])
const selectedTask = ref<AgentTask | null>(null)
const showEditDialog = ref(false)
const editForm = reactive({ title: '', description: '', priority: 'P2', repository_ids: [] as number[] })
let pollTimer: number | undefined
let logPollTimer: number | undefined
let eventController: AbortController | undefined

const taskIsStale = computed(() => {
  if (!selectedTask.value || selectedTask.value.status !== 'running') return false
  const latest = taskLogs.value[taskLogs.value.length - 1]?.created_at
  const reference = latest || selectedTask.value.started_at || selectedTask.value.updated_at
  return Boolean(reference && Date.now() - new Date(reference).getTime() > 120_000)
})

const activeStageIndex = computed(() => {
  if (!requirement.value) return 0
  if (requirement.value.stage === 'completed') return stageOrder.length - 1
  return Math.max(stageOrder.indexOf(requirement.value.stage), 0)
})
const finalStageStatus = computed(() => {
  if (requirement.value?.stage === 'completed') return '已完成'
  if (deliverySubmitting.value) return '提交中'
  if (requirement.value?.stage === 'final_acceptance' && requirement.value.run_status === 'failed') {
    return '交付失败，等待重试'
  }
  return requirement.value?.stage === 'final_acceptance' ? '待验收' : ''
})
const projectName = computed(
  () => projectStore.projects.find((item) => item.id === requirement.value?.project_id)?.name || '未知项目',
)
const latestClarificationRound = computed(() =>
  clarificationRounds.value[clarificationRounds.value.length - 1],
)
const currentGate = computed<{ gate: ReviewGate; artifact: string } | null>(() => {
  const stage = requirement.value?.stage
  if (stage === 'development_document_review') return { gate: 'development_document', artifact: 'development_document' }
  if (stage === 'development_report_review') return { gate: 'development_report', artifact: 'development_report' }
  if (stage === 'test_plan_review') return { gate: 'test_plan', artifact: 'test_plan' }
  if (stage === 'final_acceptance') {
    const artifact = ['test_plan', 'test_cases', 'development_report']
      .find((type) => artifacts.value.some((item) => item.type === type)) || 'test_plan'
    return { gate: 'final_acceptance', artifact }
  }
  return null
})
const selectedVersions = computed(() => artifactVersions.value[selectedArtifactType.value] || [])
const selectedArtifactVersion = computed(() =>
  selectedVersions.value.find((item) => item.version === selectedArtifactVersionNumber.value)
  || selectedVersions.value[0],
)
const userNames = computed(() => Object.fromEntries(authStore.users.map((user) => [user.id, user.username])))
const currentGateArtifact = computed(() =>
  currentGate.value ? artifacts.value.find((item) => item.type === currentGate.value?.artifact) : undefined,
)
const canReviseCurrentArtifact = computed(() => {
  if (!currentGate.value || ['test_plan', 'final_acceptance'].includes(currentGate.value.gate)) return false
  return selectedArtifactType.value === currentGate.value.artifact
    && selectedArtifactVersion.value?.version === currentGateArtifact.value?.current_version
})
const isTestPlanGeneration = computed(() => requirement.value?.stage === 'test_plan_generation')
const hasActiveTask = computed(() => tasks.value.some((task) => ['queued', 'running'].includes(task.status)))
const latestCurrentStageTask = computed(() => {
  if (!requirement.value) return undefined
  return tasks.value
    .filter((task) => task.stage === requirement.value?.stage)
    .sort((left, right) => right.id - left.id)[0]
})

const reviewActionLabels = {
  approve: '通过',
  reject: '驳回',
  transfer: '转交',
} as const

function validRequirementId(value: number) {
  return Number.isInteger(value) && value > 0
}

const artifactSourceLabels: Record<string, string> = {
  user: '用户提交',
  agent: 'Agent 生成',
  human_revision: '人工修订',
  user_confirmed_agent_output: '用户确认的澄清结果',
}

function hasAction(action: string) {
  return actions.value.includes(action)
}

async function loadAll(showLoading = true, id = requirementId.value) {
  if (!validRequirementId(id)) return
  if (showLoading) loading.value = true
  try {
    const current = await requirementStore.fetchDetail(id)
    const [
      pipelineResponse,
      actionResponse,
      clarificationResponse,
      artifactResponse,
      reviewResponse,
      taskResponse,
      workspaceResponse,
      mergeQueueResponse,
    ] =
      await Promise.all([
        requirementApi.pipeline(current.id),
        requirementApi.actions(current.id),
        requirementApi.clarificationRounds(current.id),
        requirementApi.artifacts(current.id),
        requirementApi.reviews(current.id),
        requirementApi.tasks(current.id),
        requirementApi.workspaces(current.id),
        requirementApi.mergeQueue(current.id),
        projectStore.fetchList(),
        authStore.fetchUsers(),
        projectStore.fetchRepositories(current.project_id),
      ])
    pipeline.value = pipelineResponse.data
    actions.value = actionResponse.data
    clarificationRounds.value = clarificationResponse.data
    artifacts.value = artifactResponse.data
    reviews.value = reviewResponse.data
    tasks.value = taskResponse.data
    workspaces.value = workspaceResponse.data
    mergeQueue.value = mergeQueueResponse.data
    if (!selectedArtifactType.value && artifacts.value.length) {
      selectedArtifactType.value = currentGate.value?.artifact || artifacts.value[0].type
    }
    const entries = await Promise.all(
      artifacts.value.map(async (artifact) => {
        const response = await requirementApi.artifactVersions(current.id, artifact.type)
        return [artifact.type, response.data] as const
      }),
    )
    artifactVersions.value = Object.fromEntries(entries)
    if (!selectedVersions.value.some((item) => item.version === selectedArtifactVersionNumber.value)) {
      selectedArtifactVersionNumber.value = selectedVersions.value[0]?.version || null
    }
  } catch (error) {
    if (showLoading) throw error
  } finally {
    if (showLoading) loading.value = false
  }
}

async function submitRequirement() {
  if (!requirement.value) return
  await ElMessageBox.confirm('提交后将生成不可变需求文档并进入需求澄清，确认继续？', '提交需求', {
    type: 'warning',
    confirmButtonText: '提交',
  })
  await requirementApi.submit(requirement.value.id, requirement.value.version)
  ElMessage.success('需求已提交')
  await loadAll()
}

async function pauseRequirement() {
  if (!requirement.value) return
  await requirementApi.pause(requirement.value.id, requirement.value.version)
  ElMessage.success('需求已暂停')
  await loadAll()
}

async function resumeRequirement() {
  if (!requirement.value) return
  await requirementApi.resume(requirement.value.id, requirement.value.version)
  ElMessage.success('需求已恢复')
  await loadAll()
}

async function cancelRequirement() {
  if (!requirement.value) return
  const result = await ElMessageBox.prompt('取消后保留全部历史记录，请填写原因。', '取消需求', {
    inputType: 'textarea',
    inputValidator: (value) => Boolean(value.trim()) || '必须填写取消原因',
    confirmButtonText: '确认取消',
    type: 'warning',
  })
  await requirementApi.cancel(requirement.value.id, requirement.value.version, result.value)
  ElMessage.success('需求已取消')
  await loadAll()
}

function openEditDialog() {
  if (!requirement.value) return
  Object.assign(editForm, {
    title: requirement.value.title,
    description: requirement.value.description,
    priority: requirement.value.priority,
    repository_ids: [...requirement.value.repository_ids],
  })
  showEditDialog.value = true
}

async function saveDraft() {
  if (!requirement.value) return
  const startNewClarification =
    requirement.value.stage === 'requirement_clarification'
    && latestClarificationRound.value?.status === 'confirmed'
  await requirementApi.update(requirement.value.id, {
    ...editForm,
    priority: editForm.priority as 'P0' | 'P1' | 'P2' | 'P3',
    project_id: requirement.value.project_id,
    resource_version: requirement.value.version,
  })
  showEditDialog.value = false
  ElMessage.success('需求已更新')
  await loadAll(false)
  if (startNewClarification && requirement.value) {
    await requirementApi.generateClarification(requirement.value.id)
    ElMessage.success('已根据修改后的需求发起新一轮澄清')
    await loadAll()
  }
}

async function generateClarification() {
  if (!requirement.value || taskStarting.value || hasActiveTask.value) return
  taskStarting.value = true
  try {
    if (latestCurrentStageTask.value?.status === 'failed') {
      await requirementApi.retryTask(latestCurrentStageTask.value.id)
      ElMessage.success(`已根据任务 #${latestCurrentStageTask.value.id} 的失败信息创建重试任务`)
    } else {
      await requirementApi.generateClarification(requirement.value.id)
      ElMessage.success('澄清任务已进入队列')
    }
    await loadAll()
  } finally {
    taskStarting.value = false
  }
}

async function reopenClarification() {
  if (!requirement.value) return
  await ElMessageBox.confirm('之前填写的本轮答案会被清除，确认重新回答？', '重新回答本轮问题', {
    type: 'warning',
    confirmButtonText: '重新回答',
    cancelButtonText: '取消',
  })
  await requirementApi.reopenClarification(requirement.value.id, requirement.value.version)
  clearClarificationAnswers()
  ElMessage.success('已返回本轮澄清问题，可重新填写答案')
  await loadAll()
}

function clearClarificationAnswers() {
  Object.keys(answerValues).forEach((key) => delete answerValues[Number(key)])
  Object.keys(answerCustom).forEach((key) => delete answerCustom[Number(key)])
}

async function continueClarification() {
  await ElMessageBox.confirm('将根据本轮答案继续生成下一轮问题，确认继续？', '继续澄清', {
    type: 'info',
    confirmButtonText: '继续澄清',
    cancelButtonText: '取消',
  })
  await generateClarification()
}

function isOtherSelected(question: ClarificationQuestion) {
  const value = answerValues[question.id]
  return question.type === 'single'
    ? value === OTHER_ANSWER
    : Array.isArray(value) && value.includes(OTHER_ANSWER)
}

function isMissingAnswer(question: ClarificationQuestion) {
  const value = answerValues[question.id]
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return true
  return isOtherSelected(question) && !(answerCustom[question.id] || '').trim()
}

function resolvedAnswer(question: ClarificationQuestion) {
  const value = answerValues[question.id]
  const custom = (answerCustom[question.id] || '').trim()
  if (question.type === 'single') return value === OTHER_ANSWER ? custom : value
  if (question.type === 'multiple' && Array.isArray(value)) {
    return value.map((item) => (item === OTHER_ANSWER ? custom : item))
  }
  return value
}

function resolveAnswerDisplay(question: ClarificationQuestion, answer: unknown) {
  if (answer === undefined || answer === null || answer === '') return '未作答'
  let parsed = answer
  if (typeof answer === 'string') {
    try {
      parsed = JSON.parse(answer)
    } catch {
      parsed = answer
    }
  }
  const optionText = (value: unknown) => {
    const option = question.options.find((item) => item.id === String(value))
    if (!option) return String(value)
    return option.description ? `${option.label}（${option.description}）` : option.label
  }
  return Array.isArray(parsed) ? parsed.map(optionText).join('、') : optionText(parsed)
}

function buildClarificationSummary() {
  if (!requirement.value) return ''
  const sections = clarificationRounds.value
    .filter((round) => round.questions.some((question) => question.answers.length))
    .map((round) => {
      const questions = round.questions
        .filter((question) => question.answers.length)
        .map((question, index) => {
          const recommendation = question.ai_recommendation
            ? `\n- AI 建议：${question.ai_recommendation}`
            : ''
          return `**Q${index + 1}：${question.question}**${recommendation}\n- 回答：${resolveAnswerDisplay(question, question.answers.at(-1)?.answer)}`
        })
      return `### 第 ${round.round_no} 轮\n\n${questions.join('\n\n')}`
    })
  return `# ${requirement.value.title}\n\n${requirement.value.description}\n\n---\n\n## 澄清问答\n\n${sections.join('\n\n')}`
}

function openClarificationConfirm() {
  clarificationSummary.value = buildClarificationSummary()
  showClarificationConfirm.value = true
}

async function submitClarificationAnswers() {
  if (!requirement.value || !latestClarificationRound.value) return
  const requiredMissing = latestClarificationRound.value.questions.filter(
    (question) => question.required && isMissingAnswer(question),
  )
  if (requiredMissing.length) {
    ElMessage.warning('请回答全部必答问题')
    return
  }
  const response = await requirementApi.submitAnswers(requirement.value.id, {
    resource_version: requirement.value.version,
    answers: latestClarificationRound.value.questions
      .filter((question) => !isMissingAnswer(question))
      .map((question) => ({ question_id: question.id, answer: resolvedAnswer(question) })),
  })
  requirement.value.version = response.data.resource_version
  await loadAll(false)
  openClarificationConfirm()
}

async function confirmClarification() {
  if (!requirement.value) return
  await ElMessageBox.confirm(
    '确认后将进入开发文档生成，本次确认不能撤销或回退；后续修改只能通过新一轮澄清生成新版本。确定继续？',
    '再次确认澄清结果',
    {
      type: 'warning',
      confirmButtonText: '确定，不能回退',
      cancelButtonText: '返回检查',
    },
  )
  await requirementApi.confirmClarification(requirement.value.id, requirement.value.version, {
    title: requirement.value.title,
    description: requirement.value.description,
    clarification_summary: clarificationSummary.value,
  })
  showClarificationConfirm.value = false
  ElMessage.success('澄清结果已确认')
  await loadAll()
}

async function startTask() {
  if (!requirement.value || taskStarting.value || hasActiveTask.value) return
  taskStarting.value = true
  try {
    if (latestCurrentStageTask.value?.status === 'failed') {
      await requirementApi.retryTask(latestCurrentStageTask.value.id)
      ElMessage.success(`已根据任务 #${latestCurrentStageTask.value.id} 的失败信息创建重试任务`)
    } else {
      await requirementApi.startTask(
        requirement.value.id,
        taskSummaryByStage[requirement.value.stage] || `执行 ${stageLabels[requirement.value.stage]}`,
      )
      ElMessage.success(isTestPlanGeneration.value ? '测试方案生成任务已进入队列' : 'Agent 任务已进入队列')
    }
    await loadAll()
  } finally {
    taskStarting.value = false
  }
}

async function cancelTask(task: AgentTask) {
  await ElMessageBox.confirm(
    `只停止任务 #${task.id}，不会取消当前需求或其他任务。确认继续？`,
    '取消 Agent 任务',
    {
      type: 'warning',
      confirmButtonText: '停止任务',
      cancelButtonText: '返回',
    },
  )
  await requirementApi.cancelTask(task.id)
  ElMessage.success(`任务 #${task.id} 已停止`)
  await loadAll()
}

async function deleteRequirement() {
  if (!requirement.value) return
  const workspaceAction = requirement.value.workspace_retention_policy === 'delete'
    ? '同时删除该需求的 Workspace'
    : '保留该需求的 Workspace'
  await ElMessageBox.confirm(
    `需求会从列表隐藏并立即停止专属 Agent Pod；数据库中的需求、结果、任务日志和审计日志会保留。当前策略：${workspaceAction}。`,
    '删除需求',
    {
      type: 'warning',
      confirmButtonText: '删除需求',
      cancelButtonText: '返回',
    },
  )
  await requirementApi.delete(requirement.value.id, requirement.value.version)
  ElMessage.success('需求已删除，专属 Agent Pod 正在回收')
  router.push('/requirements')
}

async function retryTask(task: AgentTask) {
  await requirementApi.retryTask(task.id)
  ElMessage.success('已从检查点创建重试任务')
  await loadAll()
}

function stopLogPolling() {
  window.clearInterval(logPollTimer)
  logPollTimer = undefined
}

function stopBackgroundUpdates() {
  eventController?.abort()
  eventController = undefined
  window.clearInterval(pollTimer)
  pollTimer = undefined
  stopLogPolling()
}

function startBackgroundUpdates(id: number) {
  if (!validRequirementId(id)) return
  eventController = new AbortController()
  void requirementApi
    .streamEvents(id, () => void loadAll(false, id), eventController.signal)
    .catch(() => undefined)
  pollTimer = window.setInterval(() => void loadAll(false, id), 8000)
}

async function refreshTaskLogs(taskId: number) {
  const [logResponse, taskResponse] = await Promise.all([
    requirementApi.taskLogs(taskId),
    requirementApi.tasks(requirementId.value),
  ])
  taskLogs.value = logResponse.data.items
  const latestTask = taskResponse.data.find((item) => item.id === taskId)
  if (latestTask) {
    selectedTask.value = latestTask
    if (!['queued', 'running'].includes(latestTask.status)) stopLogPolling()
  }
}

async function openTaskLogs(task: AgentTask) {
  selectedTask.value = task
  showLogDialog.value = true
  stopLogPolling()
  await refreshTaskLogs(task.id)
  if (['queued', 'running'].includes(selectedTask.value?.status || task.status)) {
    logPollTimer = window.setInterval(() => {
      void refreshTaskLogs(task.id)
    }, 8000)
  }
}

async function checkWorkspaceMerge(workspace: RequirementWorkspace) {
  workspaceBusy.value = workspace.id
  try {
    const response = await requirementApi.mergeCheck(
      requirementId.value,
      workspace.id,
      workspace.base_branch,
    )
    await ElMessageBox.alert(
      response.data.can_merge
        ? `可以合并到 ${response.data.target_branch}`
        : `存在冲突：${response.data.conflict_files.join(', ') || response.data.message}`,
      '合并检查',
      { type: response.data.can_merge ? 'success' : 'warning' },
    )
  } finally {
    workspaceBusy.value = null
  }
}

async function mergeWorkspace(workspace: RequirementWorkspace) {
  await ElMessageBox.confirm(
    `将 ${workspace.branch_name} 合并并推送到 ${workspace.base_branch}，确认继续？`,
    '进入合并队列',
    { type: 'warning', confirmButtonText: '合并' },
  )
  workspaceBusy.value = workspace.id
  try {
    const response = await requirementApi.merge(
      requirementId.value,
      workspace.id,
      workspace.base_branch,
    )
    if (response.data.status === 'merged') ElMessage.success('代码已合并并推送')
    else ElMessage.warning(response.data.error_message || '合并需要人工处理')
    await loadAll(false)
  } finally {
    workspaceBusy.value = null
  }
}

function openReview(action: 'approve' | 'reject' | 'transfer') {
  reviewAction.value = action
  reviewComment.value = ''
  reviewAssigneeId.value = undefined
  showReviewDialog.value = true
}

function selectArtifact(type: string) {
  selectedArtifactType.value = type
  selectedArtifactVersionNumber.value = artifactVersions.value[type]?.[0]?.version || null
}

async function submitReview() {
  if (!requirement.value || !currentGate.value || !currentGateArtifact.value) return
  if (reviewAction.value === 'reject' && !reviewComment.value.trim()) {
    ElMessage.warning('驳回时必须填写意见')
    return
  }
  if (reviewAction.value === 'transfer' && !reviewAssigneeId.value) {
    ElMessage.warning('请选择转交人')
    return
  }
  let finalConfirmation = false
  const isFinalDelivery = currentGate.value.gate === 'final_acceptance' && reviewAction.value === 'approve'
  if (reviewAction.value === 'approve') {
    await ElMessageBox.confirm(
      isFinalDelivery
        ? '系统将推送全部功能分支，提交后不能撤销或回退；只有全部推送成功后需求才会自动完成。确定人工测试已通过？'
        : '审批通过后将进入下一阶段，本次审批不能撤销或回退。确定继续？',
      isFinalDelivery ? '再次确认验收并提交' : '再次确认审批通过',
      {
        type: 'warning',
        confirmButtonText: isFinalDelivery ? '确定验收并提交' : '确定通过，不能回退',
        cancelButtonText: '返回检查',
      },
    )
    finalConfirmation = isFinalDelivery
  }
  const payload: ReviewPayload = {
    action: reviewAction.value,
    comment: reviewComment.value,
    artifact_version: currentGateArtifact.value.current_version,
    resource_version: requirement.value.version,
    assignee_id: reviewAssigneeId.value,
    final_confirmation: finalConfirmation,
  }
  deliverySubmitting.value = isFinalDelivery
  try {
    await requirementApi.review(requirement.value.id, currentGate.value.gate, payload)
    showReviewDialog.value = false
    ElMessage.success(
      isFinalDelivery
        ? '代码已推送，需求已完成'
        : reviewAction.value === 'approve'
          ? '审批已通过'
          : reviewAction.value === 'reject'
            ? '已驳回'
            : '已转交',
    )
    await loadAll()
  } catch {
    await loadAll(false)
  } finally {
    deliverySubmitting.value = false
  }
}

function openReviseDialog() {
  const current = selectedArtifactVersion.value
  reviseContent.value = typeof current?.content === 'string' ? current.content : JSON.stringify(current?.content, null, 2)
  reviseComment.value = ''
  showReviseDialog.value = true
}

async function reviseArtifact() {
  if (!requirement.value) return
  let content: unknown = reviseContent.value
  try {
    content = JSON.parse(reviseContent.value)
  } catch {
    content = reviseContent.value
  }
  await requirementApi.reviseArtifact(
    requirement.value.id,
    selectedArtifactType.value,
    requirement.value.version,
    content,
    reviseComment.value,
  )
  showReviseDialog.value = false
  ElMessage.success('已生成新的人工修订版本')
  await loadAll()
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

onMounted(async () => {
  const id = requirementId.value
  await loadAll(true, id)
  startBackgroundUpdates(id)
})
watch(requirementId, async (id, previousId) => {
  if (id === previousId) return
  stopBackgroundUpdates()
  if (!validRequirementId(id)) return
  await loadAll(true, id)
  startBackgroundUpdates(id)
})
onBeforeRouteLeave(stopBackgroundUpdates)
onUnmounted(stopBackgroundUpdates)
</script>

<template>
  <div v-if="requirement" v-loading="loading" class="requirement-detail">
    <div class="page-heading">
      <div>
        <el-button :icon="ArrowLeft" text @click="router.push('/requirements')">需求列表</el-button>
        <div class="title-row">
          <span class="requirement-key">REQ-{{ requirement.id }}</span>
          <h1>{{ requirement.title }}</h1>
        </div>
        <div class="title-meta">
          <span>{{ projectName }}</span>
          <el-tag :color="priorityColors[requirement.priority]" effect="dark" class="priority-tag">{{ requirement.priority }}</el-tag>
          <el-tag>{{ stageLabels[requirement.stage] }}</el-tag>
          <el-tag :type="runStatusConfig[requirement.run_status].type">{{ runStatusConfig[requirement.run_status].label }}</el-tag>
          <span>资源版本 {{ requirement.version }}</span>
        </div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
        <el-button v-if="hasAction('edit')" :icon="Edit" @click="openEditDialog">{{ requirement.stage === 'requirement_clarification' ? '修改需求后重新澄清' : '编辑草稿' }}</el-button>
        <el-button v-if="hasAction('submit')" type="primary" :icon="Check" @click="submitRequirement">提交需求</el-button>
        <el-button v-if="hasAction('pause')" :icon="VideoPause" @click="pauseRequirement">暂停</el-button>
        <el-button v-if="hasAction('resume')" type="primary" :icon="VideoPlay" @click="resumeRequirement">恢复</el-button>
        <el-dropdown v-if="canDeleteRequirement || (requirement.stage !== 'completed' && requirement.run_status !== 'cancelled')">
          <el-button :icon="MoreFilled" circle aria-label="更多操作" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="requirement.stage !== 'completed' && requirement.run_status !== 'cancelled'" @click="cancelRequirement">取消需求</el-dropdown-item>
              <el-dropdown-item v-if="canDeleteRequirement" :icon="Delete" divided @click="deleteRequirement">删除需求</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="stage-track">
      <div v-for="(stage, index) in stageOrder" :key="stage" :class="['stage-node', { current: index === activeStageIndex && requirement.stage !== 'completed', done: requirement.stage === 'completed' ? index <= activeStageIndex : index < activeStageIndex }]">
        <span>{{ requirement.stage === 'completed' || index < activeStageIndex ? '✓' : index + 1 }}</span>
        <strong>{{ stageLabels[stage] }}</strong>
        <small v-if="stage === 'final_acceptance' && finalStageStatus">{{ finalStageStatus }}</small>
      </div>
    </div>

    <div class="content-grid">
      <main>
        <section class="panel requirement-panel">
          <div class="panel-heading"><h2>需求描述</h2><span>创建于 {{ formatTime(requirement.created_at) }}</span></div>
          <div class="panel-body"><MarkdownRenderer :content="requirement.description" /></div>
        </section>

        <section v-if="requirement.stage === 'requirement_clarification'" class="panel">
          <div class="panel-heading"><h2>需求澄清</h2><span>所有必答问题完成后才能确认</span></div>
          <div class="panel-body">
            <div v-if="latestClarificationRound" class="clarification-round">
              <div class="round-heading">
                <strong>第 {{ latestClarificationRound.round_no }} 轮</strong>
                <el-tag :type="latestClarificationRound.status === 'pending_answers' ? 'warning' : 'success'">{{ latestClarificationRound.status }}</el-tag>
              </div>
              <div v-for="question in latestClarificationRound.questions" :key="question.id" class="question-block">
                <div class="question-title"><span v-if="question.required">*</span>{{ question.question }}</div>
                <div v-if="question.ai_recommendation" class="recommendation">AI 建议：{{ question.ai_recommendation }}</div>
                <template v-if="latestClarificationRound.status === 'pending_answers'">
                  <template v-if="question.type === 'single' && question.options.length">
                    <el-radio-group v-model="answerValues[question.id]">
                      <el-radio v-for="option in question.options" :key="option.id" :value="option.id">{{ option.label }}</el-radio>
                      <el-radio :value="OTHER_ANSWER">其他（手动输入）</el-radio>
                    </el-radio-group>
                    <el-input v-if="isOtherSelected(question)" v-model="answerCustom[question.id]" class="custom-answer" type="textarea" :rows="3" placeholder="请输入其他回答" />
                  </template>
                  <template v-else-if="question.type === 'multiple'">
                    <el-checkbox-group v-model="answerValues[question.id] as string[]">
                      <el-checkbox v-for="option in question.options" :key="option.id" :value="option.id">{{ option.label }}</el-checkbox>
                      <el-checkbox :value="OTHER_ANSWER">其他（手动输入）</el-checkbox>
                    </el-checkbox-group>
                    <el-input v-if="isOtherSelected(question)" v-model="answerCustom[question.id]" class="custom-answer" type="textarea" :rows="3" placeholder="请输入其他回答" />
                  </template>
                  <el-input v-else v-model="answerValues[question.id] as string" type="textarea" :rows="3" placeholder="请输入回答" />
                </template>
                <div v-else class="answer-readonly">{{ resolveAnswerDisplay(question, question.answers.at(-1)?.answer) }}</div>
              </div>
              <el-button v-if="latestClarificationRound.status === 'pending_answers' && hasAction('answer_clarification')" type="primary" @click="submitClarificationAnswers">提交本轮答案</el-button>
              <template v-else-if="latestClarificationRound.status === 'answered'">
                <el-button v-if="hasAction('confirm_clarification')" type="primary" @click="openClarificationConfirm">确认澄清完成</el-button>
                <el-button v-if="hasAction('generate_clarification')" :loading="taskStarting" :disabled="hasActiveTask" @click="continueClarification">继续澄清</el-button>
              </template>
              <template v-else-if="latestClarificationRound.status === 'confirmed'">
                <el-button v-if="hasAction('reopen_clarification')" @click="reopenClarification">重新回答本轮问题</el-button>
                <el-button v-if="hasAction('generate_clarification')" type="primary" :loading="taskStarting" :disabled="hasActiveTask" @click="generateClarification">根据驳回意见生成新一轮澄清问题</el-button>
                <el-button v-if="hasAction('edit')" :icon="Edit" @click="openEditDialog">修改需求描述</el-button>
              </template>
            </div>
            <div v-else class="empty-action">
              <el-empty description="尚未生成澄清问题" :image-size="70" />
              <el-button v-if="hasAction('generate_clarification')" type="primary" :loading="taskStarting" :disabled="hasActiveTask" @click="generateClarification">生成澄清问题</el-button>
            </div>
          </div>
        </section>

        <section v-if="hasAction('start_task')" class="panel action-panel">
          <div>
            <h2>{{ stageLabels[requirement.stage] }}</h2>
            <p>{{ taskSummaryByStage[requirement.stage] }}</p>
          </div>
          <el-button type="primary" :icon="VideoPlay" :loading="taskStarting" :disabled="hasActiveTask" @click="startTask">{{ isTestPlanGeneration ? '生成测试方案' : '启动 Agent 任务' }}</el-button>
        </section>

        <section v-if="artifacts.length" class="panel">
          <div class="panel-heading">
            <h2>流程产物</h2>
            <el-button v-if="canReviseCurrentArtifact" text type="primary" :icon="Edit" @click="openReviseDialog">人工修订</el-button>
          </div>
          <div class="artifact-layout">
            <nav class="artifact-nav">
              <button v-for="artifact in artifacts" :key="artifact.id" :class="{ active: selectedArtifactType === artifact.type }" type="button" @click="selectArtifact(artifact.type)">
                <span>{{ artifactLabels[artifact.type] || artifact.type }}</span><small>v{{ artifact.current_version }}</small>
              </button>
            </nav>
            <div class="artifact-content">
              <div v-if="selectedArtifactVersion" class="artifact-meta">
                <el-select v-model="selectedArtifactVersionNumber" size="small" aria-label="产物版本" style="width: 92px">
                  <el-option v-for="version in selectedVersions" :key="version.version" :label="`版本 ${version.version}`" :value="version.version" />
                </el-select>
                <span>{{ artifactSourceLabels[selectedArtifactVersion.source] || selectedArtifactVersion.source }}</span>
                <span>{{ formatTime(selectedArtifactVersion.created_at) }}</span>
              </div>
              <MarkdownRenderer v-if="typeof selectedArtifactVersion?.content === 'string'" :content="selectedArtifactVersion.content as string" />
              <ArtifactRenderer
                v-else-if="selectedArtifactVersion"
                :artifact-type="selectedArtifactType"
                :content="selectedArtifactVersion.content"
                :clarification-rounds="clarificationRounds"
                :user-names="userNames"
              />
            </div>
          </div>
        </section>

        <section v-if="tasks.length" class="panel">
          <div class="panel-heading"><h2>Agent 任务</h2><span>任务结果由内部 Agent 服务回调</span></div>
          <el-table :data="tasks" size="small">
            <el-table-column prop="id" label="任务" width="80" />
            <el-table-column prop="task_type" label="类型" min-width="190" />
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'succeeded' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'cancelled' ? 'info' : 'warning'">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column prop="retry_count" label="重试" width="70" align="center" />
            <el-table-column label="更新时间" width="180"><template #default="{ row }">{{ formatTime(row.updated_at) }}</template></el-table-column>
            <el-table-column label="操作" width="220" fixed="right" align="right"><template #default="{ row }"><el-button text type="primary" @click="openTaskLogs(row)">日志</el-button><el-button v-if="['queued', 'running'].includes(row.status)" text type="danger" :icon="VideoPause" @click="cancelTask(row)">取消任务</el-button><el-button v-if="['failed', 'cancelled'].includes(row.status)" text type="primary" @click="retryTask(row)">重试</el-button></template></el-table-column>
          </el-table>
        </section>

        <section v-if="workspaces.length" class="panel">
          <div class="panel-heading"><h2>代码工作区</h2><span>每个需求使用独立分支</span></div>
          <el-table :data="workspaces" size="small">
            <el-table-column label="仓库" width="90"><template #default="{ row }">#{{ row.repository_id }}</template></el-table-column>
            <el-table-column prop="branch_name" label="功能分支" min-width="190" show-overflow-tooltip />
            <el-table-column prop="base_branch" label="目标分支" width="120" />
            <el-table-column label="提交" width="120"><template #default="{ row }"><code>{{ row.head_commit?.slice(0, 8) || '-' }}</code></template></el-table-column>
            <el-table-column label="变更" width="80"><template #default="{ row }">{{ row.changed_files.length }}</template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag>{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column v-if="authStore.canDevelop" label="操作" width="170" align="right">
              <template #default="{ row }">
                <el-button text :loading="workspaceBusy === row.id" @click="checkWorkspaceMerge(row)">检查</el-button>
                <el-button text type="success" :loading="workspaceBusy === row.id" @click="mergeWorkspace(row)">合并</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="mergeQueue.length" class="merge-history">
            <strong>合并记录</strong>
            <span v-for="item in mergeQueue" :key="item.id">#{{ item.id }} {{ item.target_branch }} · {{ item.status }}</span>
          </div>
        </section>
      </main>

      <aside>
        <section v-if="currentGate && currentGateArtifact" class="panel gate-panel">
          <div class="panel-heading"><h2>{{ currentGate.gate === 'final_acceptance' ? '最终验收' : `${gateLabels[currentGate.gate]}审批` }}</h2><el-tag :type="requirement.run_status === 'failed' ? 'danger' : 'warning'">{{ requirement.run_status === 'failed' ? '交付失败，等待重试' : '等待人工' }}</el-tag></div>
          <div class="panel-body">
            <p>当前固定审批产物版本：<strong>v{{ currentGateArtifact.current_version }}</strong></p>
            <div class="gate-actions">
              <el-button v-if="hasAction(`approve:${currentGate.gate}`)" type="success" :icon="Check" :loading="deliverySubmitting" @click="openReview('approve')">{{ currentGate.gate === 'final_acceptance' ? (requirement.run_status === 'failed' ? '重试提交' : '验收通过并提交') : '通过' }}</el-button>
              <el-button v-if="hasAction(`reject:${currentGate.gate}`)" type="danger" :icon="Close" @click="openReview('reject')">驳回</el-button>
              <el-button v-if="hasAction(`transfer:${currentGate.gate}`)" @click="openReview('transfer')">转交</el-button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-heading"><h2>阶段历史</h2><span>{{ pipeline?.history.length || 0 }} 条</span></div>
          <div class="timeline-list">
            <div v-for="item in [...(pipeline?.history || [])].reverse()" :key="item.id" class="timeline-item">
              <span class="timeline-dot" />
              <div><strong>{{ stageLabels[item.to_stage] }}</strong><p>{{ item.trigger }}<template v-if="item.reason"> · {{ item.reason }}</template></p><small>{{ formatTime(item.created_at) }}</small></div>
            </div>
            <el-empty v-if="!pipeline?.history.length" description="暂无阶段变化" :image-size="52" />
          </div>
        </section>

        <section v-if="reviews.length" class="panel">
          <div class="panel-heading"><h2>审批记录</h2><span>{{ reviews.length }} 条</span></div>
          <div class="review-list">
            <div v-for="review in [...reviews].reverse()" :key="review.id">
              <div><strong>{{ gateLabels[review.gate] }} v{{ review.artifact_version }}</strong><el-tag size="small" :type="review.action === 'approve' ? 'success' : review.action === 'reject' ? 'danger' : 'info'">{{ reviewActionLabels[review.action] }}</el-tag></div>
              <p>{{ review.comment || '本次审批未填写补充意见' }}</p>
              <small>{{ userNames[review.reviewer_id] || `用户 #${review.reviewer_id}` }}<template v-if="review.assignee_id"> · 转交给 {{ userNames[review.assignee_id] || `用户 #${review.assignee_id}` }}</template> · {{ formatTime(review.created_at) }}</small>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="showEditDialog" title="编辑需求草稿" width="680px">
      <el-form label-position="top"><el-form-item label="标题"><el-input v-model="editForm.title" /></el-form-item><el-form-item label="描述"><el-input v-model="editForm.description" type="textarea" :rows="8" /></el-form-item><div class="edit-grid"><el-form-item label="优先级"><el-select v-model="editForm.priority" style="width: 100%"><el-option v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority" :value="priority" /></el-select></el-form-item><el-form-item label="仓库"><el-select v-model="editForm.repository_ids" multiple style="width: 100%"><el-option v-for="repository in projectStore.repositories" :key="repository.id" :label="repository.name" :value="repository.id" /></el-select></el-form-item></div></el-form>
      <template #footer><el-button @click="showEditDialog = false">取消</el-button><el-button type="primary" @click="saveDraft">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="showClarificationConfirm" title="确认需求文档" width="680px">
      <el-alert title="确认后将进入开发文档生成，后续修改需要形成新产物版本。" type="warning" show-icon :closable="false" />
      <div class="confirm-doc-preview"><MarkdownRenderer :content="clarificationSummary" /></div>
      <template #footer><el-button @click="showClarificationConfirm = false">取消</el-button><el-button type="primary" @click="confirmClarification">确认完成</el-button></template>
    </el-dialog>

    <el-dialog v-model="showReviewDialog" :title="`${currentGate ? gateLabels[currentGate.gate] : ''}${reviewAction === 'approve' ? '通过' : reviewAction === 'reject' ? '驳回' : '转交'}`" width="520px">
      <el-form label-position="top"><el-form-item v-if="reviewAction === 'transfer'" label="转交给" required><el-select v-model="reviewAssigneeId" filterable style="width: 100%"><el-option v-for="user in authStore.users" :key="user.id" :label="`${user.username} (${user.roles.join(', ')})`" :value="user.id" /></el-select></el-form-item><el-form-item :label="reviewAction === 'reject' ? '驳回意见' : '审批意见'" :required="reviewAction === 'reject'"><el-input v-model="reviewComment" type="textarea" :rows="5" /></el-form-item></el-form>
      <template #footer><el-button @click="showReviewDialog = false">取消</el-button><el-button :type="reviewAction === 'reject' ? 'danger' : 'primary'" :loading="deliverySubmitting" @click="submitReview">{{ currentGate?.gate === 'final_acceptance' && reviewAction === 'approve' ? (requirement.run_status === 'failed' ? '重试提交' : '验收通过并提交') : '确认' }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="showReviseDialog" title="人工修订产物" width="720px"><el-form label-position="top"><el-form-item label="内容"><el-input v-model="reviseContent" type="textarea" :rows="16" /></el-form-item><el-form-item label="修订说明"><el-input v-model="reviseComment" /></el-form-item></el-form><template #footer><el-button @click="showReviseDialog = false">取消</el-button><el-button type="primary" @click="reviseArtifact">保存为新版本</el-button></template></el-dialog>

    <el-dialog v-model="showLogDialog" :title="`任务 #${selectedTask?.id || ''} 日志`" width="760px">
      <el-alert v-if="taskIsStale" type="warning" :closable="false" show-icon title="超过 2 分钟没有新的 Agent 输出，任务可能已停止响应" />
      <AgentLogViewer :logs="taskLogs.map((item) => `[${formatTime(item.created_at)}] ${item.level.toUpperCase()} ${item.message}`)" :is-running="selectedTask?.status === 'running'" />
    </el-dialog>
  </div>
  <el-empty v-else-if="!loading" description="需求不存在" />
</template>

<style scoped>
.requirement-detail { max-width: 1600px; margin: 0 auto; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; margin-bottom: 18px; }
.page-heading > div:first-child > .el-button { padding-left: 0; margin-bottom: 7px; }
.title-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.requirement-key { color: #687386; font-size: 13px; font-weight: 600; white-space: nowrap; }
.title-row h1 { margin: 0; font-size: 23px; letter-spacing: 0; overflow-wrap: anywhere; }
.title-meta { display: flex; gap: 8px; align-items: center; margin-top: 9px; color: #77808d; font-size: 12px; flex-wrap: wrap; }
.header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.priority-tag { border: 0; }
.merge-history { min-height: 48px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-top: 1px solid #e7eaee; color: #606a77; font-size: 12px; }
.merge-history strong { color: #303844; }
.stage-track { min-width: 980px; display: grid; grid-template-columns: repeat(9, minmax(92px, 1fr)); background: #fff; border: 1px solid #dfe3e8; margin-bottom: 18px; overflow: hidden; }
.stage-node { position: relative; min-height: 72px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: #929aa5; text-align: center; border-right: 1px solid #eceef1; }
.stage-node:last-child { border-right: 0; }
.stage-node > span { width: 22px; height: 22px; border-radius: 50%; background: #eef0f3; display: grid; place-items: center; font-size: 11px; }
.stage-node > strong { font-size: 11px; font-weight: 500; letter-spacing: 0; }
.stage-node > small { min-height: 16px; color: #687386; font-size: 10px; }
.stage-node.done { color: #327752; background: #f6fbf8; }
.stage-node.done > span { color: #fff; background: #3b8a60; }
.stage-node.current { color: #a8080d; background: #fbe7e7; box-shadow: inset 0 -3px #d20a10; }
.stage-node.current > span { color: #fff; background: #d20a10; }
.content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 370px; gap: 18px; align-items: start; }
.panel { background: #fff; border: 1px solid #dfe3e8; margin-bottom: 16px; }
.panel-heading { min-height: 58px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #e5e8ec; }
.panel-heading h2, .action-panel h2 { margin: 0; font-size: 15px; letter-spacing: 0; }
.panel-heading > span { color: #89919c; font-size: 12px; }
.panel-body { padding: 17px; }
.action-panel { min-height: 88px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border-left: 3px solid #d20a10; }
.action-panel p { margin: 7px 0 0; color: #707a88; font-size: 13px; }
.round-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.question-block { padding: 15px; margin-bottom: 12px; background: #f8f9fb; border: 1px solid #e5e8ec; border-radius: 4px; }
.question-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.question-title > span { color: #d64545; margin-right: 4px; }
.recommendation { color: #52708b; font-size: 12px; margin-bottom: 10px; }
.custom-answer { margin-top: 8px; }
.answer-readonly { padding: 10px; white-space: pre-wrap; background: #fff; border: 1px solid #e2e6ea; color: #3e4753; font-size: 13px; }
.empty-action { display: flex; flex-direction: column; align-items: center; }
.artifact-layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); min-height: 300px; }
.artifact-nav { border-right: 1px solid #e5e8ec; padding: 8px; }
.artifact-nav button { width: 100%; border: 0; background: transparent; padding: 10px; display: flex; align-items: center; justify-content: space-between; color: #5c6673; cursor: pointer; text-align: left; }
.artifact-nav button:hover { background: #f2f5f7; }
.artifact-nav button.active { color: #a8080d; background: #fbe7e7; font-weight: 600; }
.artifact-nav small { color: #8a929d; }
.artifact-content { min-width: 0; padding: 17px 20px; overflow-x: auto; }
.artifact-content pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Consolas, monospace; font-size: 12px; line-height: 1.65; }
.artifact-meta { display: flex; gap: 14px; color: #838c98; font-size: 11px; padding-bottom: 12px; border-bottom: 1px solid #edf0f2; margin-bottom: 14px; }
.gate-panel { border-top: 3px solid #d78a20; }
.gate-panel p { margin: 0 0 15px; color: #616b78; font-size: 13px; }
.gate-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.timeline-list { padding: 14px 16px; }
.timeline-item { position: relative; display: grid; grid-template-columns: 14px 1fr; gap: 8px; padding-bottom: 17px; }
.timeline-item:not(:last-child)::before { content: ''; position: absolute; left: 5px; top: 12px; bottom: 0; width: 1px; background: #dce1e6; }
.timeline-dot { z-index: 1; width: 11px; height: 11px; margin-top: 4px; border-radius: 50%; background: #d20a10; border: 2px solid #fff; box-shadow: 0 0 0 1px #df5559; }
.timeline-item strong { font-size: 13px; }
.timeline-item p { margin: 4px 0; color: #68717d; font-size: 12px; line-height: 1.5; }
.timeline-item small, .review-list small { color: #979ea8; font-size: 11px; }
.review-list { padding: 5px 16px; }
.review-list > div { padding: 13px 0; border-bottom: 1px solid #edf0f2; }
.review-list > div:last-child { border-bottom: 0; }
.review-list > div > div { display: flex; align-items: center; justify-content: space-between; }
.review-list strong { font-size: 13px; }
.review-list p { margin: 7px 0; color: #626c79; font-size: 12px; line-height: 1.5; }
.edit-grid { display: grid; grid-template-columns: 160px 1fr; gap: 16px; }
.confirm-doc-preview { max-height: 420px; overflow-y: auto; margin-top: 16px; padding: 16px; background: #f8f9fb; border: 1px solid #e5e8ec; border-radius: 4px; }
@media (max-width: 1120px) { .content-grid { grid-template-columns: 1fr; } .stage-track { overflow-x: auto; } }
@media (max-width: 720px) { .page-heading { align-items: flex-start; flex-direction: column; } .artifact-layout { grid-template-columns: 1fr; } .artifact-nav { border-right: 0; border-bottom: 1px solid #e5e8ec; display: flex; overflow-x: auto; } .artifact-nav button { min-width: 150px; } }
</style>
