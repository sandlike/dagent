<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Connection,
  Delete,
  EditPen,
  Plus,
  Refresh,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  modelGatewayApi,
  type ModelRouteInput,
} from '@/api/modelGateway'
import type {
  AgentModelType,
  AgentModelRoute,
  ModelRoute,
  UserModelCallLog,
  UserModelGateway,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth'

interface AgentBindingDraft {
  value: AgentModelType
  label: string
  route_ids: number[]
  pending_route_id: number | null
}

const agentTypes = reactive<AgentBindingDraft[]>([
  { value: 'requirement_clarification', label: '需求澄清 Agent', route_ids: [], pending_route_id: null },
  { value: 'development', label: '开发 Agent', route_ids: [], pending_route_id: null },
])

const loading = ref(false)
const authStore = useAuthStore()
const platformSaving = ref(false)
const testingPlatformRouteId = ref<number | null>(null)
const savingBinding = ref<AgentModelType | null>(null)
const updatingSettings = ref(false)
const activeTab = ref('routes')
const gateway = ref<UserModelGateway | null>(null)
const logs = ref<UserModelCallLog[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const selectedLogRoute = ref<number | undefined>()
const showPlatformDialog = ref(false)
const editingPlatformRouteId = ref<number | null>(null)
const platformRoutes = ref<ModelRoute[]>([])

const platformForm = reactive<ModelRouteInput>({
  name: '',
  provider: 'openai-compatible',
  model: '',
  base_url: '',
  api_protocol: 'auto',
  priority: 100,
  quota_limit: 50_000,
  timeout_ms: 300_000,
  max_retries: 1,
  fallback_on: ['quota_exhausted', 'rate_limited', 'timeout', 'server_error', 'authentication_error'],
  agent_types: [],
  project_ids: [],
  environments: ['test', 'production'],
  credential_ref: null,
  api_token: null,
  gateway_provider_ref: null,
  gateway_route_ref: null,
})

const routes = computed(() => gateway.value?.routes ?? [])
const displayRoutes = computed(() => authStore.isAdmin ? platformRoutes.value : routes.value)
const quota = computed(() => gateway.value?.quota)
const bindings = computed(() => gateway.value?.bindings ?? [])
function bindingFor(agentType: AgentModelType) {
  return bindings.value.find((item) => item.agent_type === agentType)
}

function syncBindingDrafts() {
  for (const row of agentTypes) {
    row.route_ids = [...(bindingFor(row.value)?.route_ids ?? [])]
    row.pending_route_id = null
  }
}

function routeById(routeId: number) {
  return routes.value.find((item) => item.id === routeId)
}

function routeSupportsAgent(route: AgentModelRoute, agentType: AgentModelType) {
  return !route.agent_types.length || route.agent_types.includes(agentType)
}

function availableRoutesFor(row: AgentBindingDraft) {
  return routes.value.filter(
    (route) => route.status === 'active'
      && routeSupportsAgent(route, row.value)
      && !row.route_ids.includes(route.id),
  )
}

function addBindingRoute(row: AgentBindingDraft) {
  if (!row.pending_route_id) return
  if (!row.route_ids.includes(row.pending_route_id)) row.route_ids.push(row.pending_route_id)
  row.pending_route_id = null
}

function moveBindingRoute(row: AgentBindingDraft, index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= row.route_ids.length) return
  const next = [...row.route_ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  row.route_ids = next
}

function removeBindingRoute(row: AgentBindingDraft, index: number) {
  row.route_ids = row.route_ids.filter((_, current) => current !== index)
}

async function loadLogs() {
  const response = await modelGatewayApi.myLogs({
    page: logPage.value,
    page_size: 20,
    route_id: selectedLogRoute.value,
  })
  logs.value = response.data.items
  logTotal.value = response.data.total
}

async function loadAll() {
  loading.value = true
  try {
    const gatewayResponse = await modelGatewayApi.myGateway()
    gateway.value = gatewayResponse.data
    platformRoutes.value = authStore.isAdmin
      ? (await modelGatewayApi.routes({ page: 1, page_size: 100 })).data.items
      : []
    syncBindingDrafts()
    await loadLogs()
  } finally {
    loading.value = false
  }
}

function resetPlatformForm() {
  Object.assign(platformForm, {
    name: '',
    provider: 'openai-compatible',
    model: '',
    base_url: '',
    api_protocol: 'auto',
    priority: 100,
    quota_limit: 50_000,
    timeout_ms: 300_000,
    max_retries: 1,
    fallback_on: ['quota_exhausted', 'rate_limited', 'timeout', 'server_error', 'authentication_error'],
    agent_types: [],
    project_ids: [],
    environments: ['test', 'production'],
    credential_ref: null,
    api_token: null,
    gateway_provider_ref: null,
    gateway_route_ref: null,
  })
}

function openPlatformCreate() {
  editingPlatformRouteId.value = null
  resetPlatformForm()
  showPlatformDialog.value = true
}

function openPlatformEdit(route: ModelRoute) {
  editingPlatformRouteId.value = route.id
  Object.assign(platformForm, {
    name: route.name,
    provider: route.provider,
    model: route.model,
    base_url: route.base_url,
    api_protocol: route.api_protocol,
    priority: route.priority,
    quota_limit: route.quota_limit,
    timeout_ms: route.timeout_ms,
    max_retries: route.max_retries,
    fallback_on: [...route.fallback_on],
    agent_types: [...route.agent_types],
    project_ids: [...route.project_ids],
    environments: [...route.environments],
    credential_ref: route.credential_ref,
    api_token: null,
    gateway_provider_ref: route.gateway_provider_ref,
    gateway_route_ref: route.gateway_route_ref,
  })
  showPlatformDialog.value = true
}

async function savePlatformRoute() {
  if (!platformForm.name.trim() || !platformForm.model.trim() || !platformForm.base_url.trim()) {
    ElMessage.warning('请填写模型名称、模型标识和模型地址')
    return
  }
  const token = platformForm.api_token?.trim()
  if (!editingPlatformRouteId.value && !token) {
    ElMessage.warning('请填写 API Token')
    return
  }
  platformSaving.value = true
  try {
    if (editingPlatformRouteId.value) {
      const route = platformRoutes.value.find((item) => item.id === editingPlatformRouteId.value)
      if (!route) return
      const update: Partial<ModelRouteInput> & { resource_version: number } = {
        name: platformForm.name.trim(),
        priority: platformForm.priority,
        quota_limit: platformForm.quota_limit,
        agent_types: [...platformForm.agent_types],
        resource_version: route.version,
      }
      if (platformForm.provider.trim() !== route.provider) update.provider = platformForm.provider.trim()
      if (platformForm.model.trim() !== route.model) update.model = platformForm.model.trim()
      if (platformForm.base_url.trim().replace(/\/$/, '') !== route.base_url.replace(/\/$/, '')) {
        update.base_url = platformForm.base_url.trim()
      }
      if (platformForm.api_protocol !== route.api_protocol) update.api_protocol = platformForm.api_protocol
      if (token) update.api_token = token
      await modelGatewayApi.updateRoute(route.id, update)
      ElMessage.success('平台模型已更新')
    } else {
      await modelGatewayApi.createRoute({
        ...platformForm,
        name: platformForm.name.trim(),
        provider: platformForm.provider.trim(),
        model: platformForm.model.trim(),
        base_url: platformForm.base_url.trim(),
        api_protocol: platformForm.api_protocol,
        api_token: token || null,
      })
      ElMessage.success('平台模型已添加，请先验证连接再启用')
    }
    showPlatformDialog.value = false
    await loadAll()
  } finally {
    platformSaving.value = false
  }
}

async function testPlatformRoute(route: ModelRoute) {
  testingPlatformRouteId.value = route.id
  try {
    const response = await modelGatewayApi.testRoute(route.id)
    if (response.data.ok) {
      const preview = response.data.response_preview?.trim()
      const protocol = response.data.detected_api_protocol === 'responses'
        ? 'Responses API'
        : response.data.detected_api_protocol === 'chat_completions'
          ? 'Chat Completions'
          : ''
      ElMessage.success(preview
        ? `模型真实响应：${preview}（${protocol}，${response.data.latency_ms} ms）`
        : `模型真实请求成功（${protocol}，${response.data.latency_ms} ms）`)
    }
    else ElMessage.error(response.data.message)
    await loadAll()
  } finally {
    testingPlatformRouteId.value = null
  }
}

async function togglePlatformRoute(route: ModelRoute) {
  if (route.status === 'disabled') await modelGatewayApi.enableRoute(route.id)
  else await modelGatewayApi.disableRoute(route.id)
  ElMessage.success(route.status === 'active' ? '平台模型已停用' : '平台模型已启用')
  await loadAll()
}

async function saveBinding(agentType: AgentModelType) {
  const binding = bindingFor(agentType)
  const row = agentTypes.find((item) => item.value === agentType)
  if (!row?.route_ids.length) {
    ElMessage.warning('至少选择一个模型节点')
    return
  }
  if (!binding) return
  savingBinding.value = agentType
  try {
    await modelGatewayApi.updateAgentBinding(
      agentType,
      row.route_ids,
      binding.resource_version,
    )
    ElMessage.success('Agent 模型顺序已保存')
    await loadAll()
  } finally {
    savingBinding.value = null
  }
}

async function updateAutoFallback(value: string | number | boolean) {
  if (!quota.value) return
  updatingSettings.value = true
  try {
    const response = await modelGatewayApi.updateMySettings(Boolean(value), quota.value.resource_version)
    gateway.value!.quota = response.data
    ElMessage.success(response.data.auto_fallback ? '自动切换已开启' : '自动切换已关闭')
  } catch {
    await loadAll()
  } finally {
    updatingSettings.value = false
  }
}

async function changeLogFilter() {
  logPage.value = 1
  await loadLogs()
}

function quotaPercentage(route: AgentModelRoute) {
  return Math.min(100, Math.round(((route.quota_used + route.quota_reserved) / route.quota_limit) * 100))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function healthLabel(status: AgentModelRoute['health_status']) {
  return { healthy: '正常', unhealthy: '异常', unknown: '未检测' }[status]
}

function healthType(status: AgentModelRoute['health_status']) {
  return status === 'healthy' ? 'success' : status === 'unhealthy' ? 'danger' : 'info'
}

function protocolLabel(protocol: ModelRoute['api_protocol'], detected: ModelRoute['detected_api_protocol']) {
  const value = detected ?? protocol
  return {
    auto: '自动识别',
    chat_completions: 'Chat Completions',
    responses: 'Responses API',
  }[value]
}

function agentLabel(agentType: string) {
  return agentTypes.find((item) => item.value === agentType)?.label ?? agentType
}

function routeName(routeId: number | null) {
  return routes.value.find((item) => item.id === routeId)?.name ?? '-'
}

async function resetPlatformQuota(route: ModelRoute) {
  await modelGatewayApi.resetQuota(route.id)
  ElMessage.success('平台模型额度已重置')
  await loadAll()
}

onMounted(async () => {
  if (!authStore.user) await authStore.fetchUser()
  await loadAll()
})
</script>

<template>
  <div v-loading="loading" class="gateway-page">
    <div class="page-heading">
      <h1>模型网关</h1>
      <div class="heading-actions">
        <div class="fallback-toggle">
          <span>自动切换</span>
          <el-switch
            :model-value="quota?.auto_fallback"
            :loading="updatingSettings"
            @change="updateAutoFallback"
          />
        </div>
        <el-button :icon="Refresh" @click="loadAll">刷新</el-button>
        <el-button v-if="authStore.isAdmin" type="warning" :icon="Plus" @click="openPlatformCreate">新增平台模型</el-button>
      </div>
    </div>

    <div v-if="quota" class="metric-strip">
      <div><span>用户总预算</span><strong>{{ quota.hard_limit_enabled ? formatNumber(quota.quota_limit) : '未设硬限制' }}</strong></div>
      <div><span>已使用</span><strong>{{ formatNumber(quota.quota_used) }}</strong></div>
      <div><span>预占中</span><strong>{{ formatNumber(quota.quota_reserved) }}</strong></div>
      <div><span>预算剩余</span><strong>{{ quota.quota_remaining === null ? '不限制' : formatNumber(quota.quota_remaining) }}</strong></div>
      <div><span>重置时间</span><strong class="metric-time">{{ formatTime(quota.reset_at) }}</strong></div>
    </div>

    <section class="gateway-section">
      <el-tabs v-model="activeTab" class="gateway-tabs">
        <el-tab-pane label="平台模型" name="routes">
          <el-table :data="displayRoutes" empty-text="暂无可用平台模型">
            <el-table-column label="模型节点" min-width="200">
              <template #default="{ row }">
                <div class="route-name"><strong>{{ row.name }}</strong><span>{{ row.provider }}</span></div>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="170" show-overflow-tooltip />
            <el-table-column label="API 协议" min-width="155">
              <template #default="{ row }">{{ protocolLabel(row.api_protocol, row.detected_api_protocol) }}</template>
            </el-table-column>
            <el-table-column v-if="authStore.isAdmin" prop="base_url" label="模型地址" min-width="240" show-overflow-tooltip />
            <el-table-column label="API Token" width="105">
              <template #default="{ row }"><el-tag :type="row.credential_configured ? 'success' : 'info'">{{ row.credential_configured ? '已配置' : '未配置' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="连接" width="90">
              <template #default="{ row }"><el-tag :type="healthType(row.health_status)">{{ healthLabel(row.health_status) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="节点额度" min-width="210">
              <template #default="{ row }">
                <div class="quota-cell">
                  <span>{{ formatNumber(row.quota_used + row.quota_reserved) }} / {{ formatNumber(row.quota_limit) }}</span>
                  <el-progress :percentage="quotaPercentage(row)" :stroke-width="6" :show-text="false" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="call_count" label="调用" width="82" align="right" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag></template>
            </el-table-column>
            <el-table-column v-if="authStore.isAdmin" label="操作" width="330" fixed="right" align="right">
              <template #default="{ row }">
                <el-button text type="primary" :icon="Connection" :loading="testingPlatformRouteId === row.id" @click="testPlatformRoute(row)">真实验证</el-button>
                <el-button text :icon="EditPen" @click="openPlatformEdit(row)">编辑</el-button>
                <el-button text :icon="Refresh" @click="resetPlatformQuota(row)">重置额度</el-button>
                <el-button text :type="row.status === 'active' ? 'danger' : 'success'" :icon="row.status === 'active' ? VideoPause : VideoPlay" @click="togglePlatformRoute(row)">{{ row.status === 'active' ? '停用' : '启用' }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Agent 模型绑定" name="bindings">
          <el-table :data="agentTypes" empty-text="暂无 Agent">
            <el-table-column prop="label" label="Agent" min-width="190" />
            <el-table-column label="Agent 独立优先级" min-width="600">
              <template #default="{ row }">
                <div class="binding-editor">
                  <div v-for="(routeId, index) in row.route_ids" :key="routeId" class="binding-route">
                    <span class="binding-priority">{{ index + 1 }}</span>
                    <div class="binding-route-name">
                      <strong>{{ routeById(routeId)?.name ?? `节点 #${routeId}` }}</strong>
                      <span>{{ routeById(routeId)?.model ?? '节点不可用' }}</span>
                    </div>
                    <div class="binding-route-actions">
                      <el-tooltip content="上移">
                        <el-button text circle :icon="ArrowUp" :disabled="index === 0" @click="moveBindingRoute(row, index, -1)" />
                      </el-tooltip>
                      <el-tooltip content="下移">
                        <el-button text circle :icon="ArrowDown" :disabled="index === row.route_ids.length - 1" @click="moveBindingRoute(row, index, 1)" />
                      </el-tooltip>
                      <el-tooltip content="移除">
                        <el-button text circle type="danger" :icon="Delete" @click="removeBindingRoute(row, index)" />
                      </el-tooltip>
                    </div>
                  </div>
                  <div class="binding-add">
                    <el-select v-model="row.pending_route_id" clearable placeholder="添加模型节点" style="width: 100%">
                      <el-option v-for="route in availableRoutesFor(row)" :key="route.id" :label="`${route.name} · ${route.model}`" :value="route.id" />
                    </el-select>
                    <el-button :icon="Plus" :disabled="!row.pending_route_id" @click="addBindingRoute(row)">添加</el-button>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="right">
              <template #default="{ row }">
                <el-button type="primary" plain :loading="savingBinding === row.value" @click="saveBinding(row.value)">保存</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="调用记录" name="logs">
          <div class="log-toolbar">
            <el-select v-model="selectedLogRoute" clearable placeholder="全部模型节点" style="width: 240px" @change="changeLogFilter">
              <el-option v-for="route in routes" :key="route.id" :label="route.name" :value="route.id" />
            </el-select>
          </div>
          <el-table :data="logs" empty-text="暂无调用记录">
            <el-table-column label="时间" width="175"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
            <el-table-column label="Agent" min-width="165"><template #default="{ row }">{{ agentLabel(row.agent_type) }}</template></el-table-column>
            <el-table-column prop="route_name" label="模型节点" min-width="150" />
            <el-table-column prop="model" label="模型" min-width="160" />
            <el-table-column prop="attempt_no" label="尝试" width="72" align="center" />
            <el-table-column label="状态" width="105"><template #default="{ row }"><el-tag :type="row.status === 'succeeded' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column label="预计输入" width="105" align="right"><template #default="{ row }">{{ formatNumber(row.estimated_input_tokens) }}</template></el-table-column>
            <el-table-column label="输出预算" width="105" align="right"><template #default="{ row }">{{ formatNumber(row.output_token_budget) }}</template></el-table-column>
            <el-table-column label="预留量" width="95" align="right"><template #default="{ row }">{{ formatNumber(row.reserved_tokens) }}</template></el-table-column>
            <el-table-column label="实际用量" width="105" align="right"><template #default="{ row }">{{ formatNumber(row.input_tokens + row.output_tokens) }}</template></el-table-column>
            <el-table-column label="释放量" width="95" align="right"><template #default="{ row }">{{ formatNumber(row.released_tokens) }}</template></el-table-column>
            <el-table-column label="切换来源" min-width="140"><template #default="{ row }">{{ routeName(row.fallback_from_route_id) }}</template></el-table-column>
            <el-table-column label="切换原因" min-width="135"><template #default="{ row }">{{ row.fallback_reason || row.error_type || '-' }}</template></el-table-column>
            <el-table-column prop="latency_ms" label="耗时(ms)" width="105" align="right" />
          </el-table>
          <el-pagination v-if="logTotal > 20" v-model:current-page="logPage" class="pagination" :page-size="20" :total="logTotal" layout="prev, pager, next, total" @current-change="loadLogs" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-if="authStore.isAdmin" v-model="showPlatformDialog" :title="editingPlatformRouteId ? '编辑平台模型' : '新增平台模型'" width="680px" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="节点名称" required><el-input v-model="platformForm.name" maxlength="120" placeholder="例如：GLM 主节点" /></el-form-item>
          <el-form-item label="供应商标识" required><el-input v-model="platformForm.provider" maxlength="50" placeholder="例如：bigmodel" /></el-form-item>
        </div>
        <el-form-item label="模型名称" required><el-input v-model="platformForm.model" maxlength="160" placeholder="例如：glm-4.7-flash" /></el-form-item>
        <el-form-item label="模型地址" required><el-input v-model="platformForm.base_url" maxlength="500" placeholder="例如：https://example.com/v1" /></el-form-item>
        <el-form-item label="API 协议" required>
          <el-select v-model="platformForm.api_protocol" style="width: 100%">
            <el-option label="自动识别（真实验证时检测）" value="auto" />
            <el-option label="OpenAI Chat Completions" value="chat_completions" />
            <el-option label="OpenAI Responses API" value="responses" />
          </el-select>
        </el-form-item>
        <el-form-item label="API Token" :required="!editingPlatformRouteId"><el-input v-model="platformForm.api_token" type="password" show-password autocomplete="new-password" placeholder="编辑时留空表示保持原 Token" /></el-form-item>
        <el-form-item label="适用 Agent">
          <el-checkbox-group v-model="platformForm.agent_types">
            <el-checkbox value="requirement_clarification">需求澄清 Agent</el-checkbox>
            <el-checkbox value="development">开发 Agent</el-checkbox>
          </el-checkbox-group>
          <div class="field-hint">不选择表示该模型对所有主 Agent 可用。</div>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="平台优先级"><el-input-number v-model="platformForm.priority" :min="1" :max="1000" controls-position="right" /></el-form-item>
          <el-form-item label="节点 Token 额度"><el-input-number v-model="platformForm.quota_limit" :min="1" controls-position="right" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showPlatformDialog = false">取消</el-button>
        <el-button type="primary" :icon="CircleCheck" :loading="platformSaving" @click="savePlatformRoute">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.gateway-page { max-width: 1540px; margin: 0 auto; }
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.heading-actions { display: flex; align-items: center; gap: 10px; }
.fallback-toggle { height: 32px; padding: 0 12px; border-right: 1px solid #dfe3e8; display: flex; align-items: center; gap: 10px; color: #4d5866; font-size: 13px; }
.metric-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid #dfe3e8; background: #fff; margin-bottom: 18px; }
.metric-strip > div { min-height: 82px; padding: 15px 18px; border-right: 1px solid #e4e7eb; display: flex; flex-direction: column; justify-content: center; gap: 7px; }
.metric-strip > div:last-child { border-right: 0; }
.metric-strip span { color: #7c8794; font-size: 12px; }
.metric-strip strong { color: #25303d; font-size: 22px; font-weight: 650; }
.metric-strip .metric-time { font-size: 14px; }
.gateway-section { min-width: 0; overflow: hidden; background: #fff; border: 1px solid #dfe3e8; }
.gateway-tabs :deep(.el-tabs__header) { margin: 0; padding: 0 18px; border-bottom: 1px solid #e7eaee; }
.gateway-tabs :deep(.el-tabs__content) { overflow-x: auto; }
.route-name { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.route-name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.route-name span { color: #8a939f; font-size: 11px; }
.quota-cell { display: grid; grid-template-columns: 1fr; gap: 6px; }
.quota-cell span { color: #566170; font-size: 12px; }
.binding-editor { display: grid; gap: 8px; padding: 8px 0; }
.binding-route { min-height: 42px; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; border-bottom: 1px solid #ebeef2; }
.binding-priority { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #c8ced6; color: #4d5866; font-size: 12px; font-weight: 650; }
.binding-route-name { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.binding-route-name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.binding-route-name span { color: #7c8794; font-size: 11px; }
.binding-route-actions { display: flex; align-items: center; }
.binding-add { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.log-toolbar { min-height: 58px; display: flex; align-items: center; justify-content: flex-end; padding: 0 16px; border-bottom: 1px solid #ebeef2; }
.pagination { justify-content: flex-end; padding: 16px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
.field-hint { margin-top: 4px; color: #8a939f; font-size: 12px; }
:deep(.el-input-number) { width: 100%; }
@media (max-width: 1100px) { .metric-strip { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 760px) {
  .page-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .heading-actions { width: 100%; flex-wrap: wrap; }
  .fallback-toggle { border-right: 0; padding-left: 0; }
  .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric-strip > div { min-height: 72px; padding: 12px; }
  .form-grid { grid-template-columns: 1fr; }
  :deep(.el-dialog) { width: calc(100vw - 24px) !important; }
}
</style>
