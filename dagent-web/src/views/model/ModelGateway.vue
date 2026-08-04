<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  CircleCheck,
  Connection,
  EditPen,
  Plus,
  Refresh,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  modelGatewayApi,
  type UserModelRouteInput,
  type UserModelRouteUpdate,
} from '@/api/modelGateway'
import type {
  AgentModelType,
  ModelCatalogItem,
  UserModelCallLog,
  UserModelGateway,
  UserModelLevel,
  UserModelRoute,
} from '@/api/types'

const agentTypes = reactive<{ value: AgentModelType; label: string; route_ids: number[] }[]>([
  { value: 'requirement_clarification', label: '需求澄清 Agent', route_ids: [] },
  { value: 'development', label: '开发 Agent', route_ids: [] },
])

const loading = ref(false)
const saving = ref(false)
const testingRouteId = ref<number | null>(null)
const savingBinding = ref<AgentModelType | null>(null)
const updatingSettings = ref(false)
const activeTab = ref('routes')
const gateway = ref<UserModelGateway | null>(null)
const catalog = ref<ModelCatalogItem[]>([])
const logs = ref<UserModelCallLog[]>([])
const logTotal = ref(0)
const logPage = ref(1)
const selectedLogRoute = ref<number | undefined>()
const showRouteDialog = ref(false)
const editingRouteId = ref<number | null>(null)

const routeForm = reactive<UserModelRouteInput>({
  platform_route_id: 0,
  name: '',
  level: 'standard',
  priority: 1,
  quota_limit: 50_000,
})

const routes = computed(() => gateway.value?.routes ?? [])
const quota = computed(() => gateway.value?.quota)
const bindings = computed(() => gateway.value?.bindings ?? [])
const editingRoute = computed(() => routes.value.find((item) => item.id === editingRouteId.value))
const activeRoutes = computed(() => routes.value.filter((item) => item.status === 'active'))

function bindingFor(agentType: AgentModelType) {
  return bindings.value.find((item) => item.agent_type === agentType)
}

function syncBindingDrafts() {
  for (const row of agentTypes) row.route_ids = [...(bindingFor(row.value)?.route_ids ?? [])]
}

async function loadLogs() {
  const response = await modelGatewayApi.myLogs({
    page: logPage.value,
    page_size: 20,
    user_route_id: selectedLogRoute.value,
  })
  logs.value = response.data.items
  logTotal.value = response.data.total
}

async function loadAll() {
  loading.value = true
  try {
    const [gatewayResponse, catalogResponse] = await Promise.all([
      modelGatewayApi.myGateway(),
      modelGatewayApi.modelCatalog(),
    ])
    gateway.value = gatewayResponse.data
    catalog.value = catalogResponse.data
    syncBindingDrafts()
    await loadLogs()
  } finally {
    loading.value = false
  }
}

function resetRouteForm() {
  Object.assign(routeForm, {
    platform_route_id: catalog.value[0]?.id ?? 0,
    name: '',
    level: 'standard' as UserModelLevel,
    priority: Math.max(0, ...routes.value.map((item) => item.priority)) + 1,
    quota_limit: quota.value?.quota_limit ?? 50_000,
  })
}

function openCreate() {
  editingRouteId.value = null
  resetRouteForm()
  showRouteDialog.value = true
}

function openEdit(route: UserModelRoute) {
  editingRouteId.value = route.id
  Object.assign(routeForm, {
    platform_route_id: route.platform_route_id,
    name: route.name,
    level: route.level,
    priority: route.priority,
    quota_limit: route.quota_limit,
  })
  showRouteDialog.value = true
}

async function saveRoute() {
  if (!routeForm.platform_route_id || !routeForm.name.trim()) {
    ElMessage.warning('请选择模型并填写节点名称')
    return
  }
  saving.value = true
  try {
    if (editingRoute.value) {
      const update: UserModelRouteUpdate = {
        name: routeForm.name.trim(),
        level: routeForm.level,
        priority: routeForm.priority,
        quota_limit: routeForm.quota_limit,
        resource_version: editingRoute.value.resource_version,
      }
      await modelGatewayApi.updateMyRoute(editingRoute.value.id, update)
      ElMessage.success('模型节点已更新')
    } else {
      await modelGatewayApi.createMyRoute({ ...routeForm, name: routeForm.name.trim() })
      ElMessage.success('模型节点已添加')
    }
    showRouteDialog.value = false
    await loadAll()
  } finally {
    saving.value = false
  }
}

async function testRoute(route: UserModelRoute) {
  testingRouteId.value = route.id
  try {
    const response = await modelGatewayApi.testMyRoute(route.id)
    if (response.data.ok) ElMessage.success(`连接正常，${response.data.latency_ms} ms`)
    else ElMessage.error(response.data.message)
    await loadAll()
  } finally {
    testingRouteId.value = null
  }
}

async function toggleRoute(route: UserModelRoute) {
  await modelGatewayApi.updateMyRoute(route.id, {
    status: route.status === 'active' ? 'disabled' : 'active',
    resource_version: route.resource_version,
  })
  ElMessage.success(route.status === 'active' ? '模型节点已停用' : '模型节点已启用')
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

function quotaPercentage(route: UserModelRoute) {
  return Math.min(100, Math.round(((route.quota_used + route.quota_reserved) / route.quota_limit) * 100))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function healthLabel(status: UserModelRoute['health_status']) {
  return { healthy: '正常', unhealthy: '异常', unknown: '未检测' }[status]
}

function healthType(status: UserModelRoute['health_status']) {
  return status === 'healthy' ? 'success' : status === 'unhealthy' ? 'danger' : 'info'
}

function levelLabel(level: UserModelLevel) {
  return { high: '高性能', standard: '普通', economy: '低成本' }[level]
}

function agentLabel(agentType: string) {
  return agentTypes.find((item) => item.value === agentType)?.label ?? agentType
}

function routeName(routeId: number | null) {
  return routes.value.find((item) => item.id === routeId)?.name ?? '-'
}

onMounted(loadAll)
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
        <el-button type="primary" :icon="Plus" :disabled="!catalog.length" @click="openCreate">添加模型</el-button>
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
        <el-tab-pane label="我的模型" name="routes">
          <el-table :data="routes" empty-text="暂无可用模型">
            <el-table-column prop="priority" label="优先级" width="82" align="center" />
            <el-table-column label="模型节点" min-width="200">
              <template #default="{ row }">
                <div class="route-name"><strong>{{ row.name }}</strong><span>{{ row.provider }}</span></div>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="170" show-overflow-tooltip />
            <el-table-column label="级别" width="95"><template #default="{ row }">{{ levelLabel(row.level) }}</template></el-table-column>
            <el-table-column label="API Key" width="105">
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
            <el-table-column label="操作" width="240" fixed="right" align="right">
              <template #default="{ row }">
                <el-button text type="primary" :icon="Connection" :loading="testingRouteId === row.id" @click="testRoute(row)">验证</el-button>
                <el-button text :icon="EditPen" @click="openEdit(row)">编辑</el-button>
                <el-button text :type="row.status === 'active' ? 'danger' : 'success'" :icon="row.status === 'active' ? VideoPause : VideoPlay" @click="toggleRoute(row)">{{ row.status === 'active' ? '停用' : '启用' }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Agent 模型绑定" name="bindings">
          <el-table :data="agentTypes" empty-text="暂无 Agent">
            <el-table-column prop="label" label="Agent" min-width="190" />
            <el-table-column label="模型顺序" min-width="520">
              <template #default="{ row }">
                <el-select v-model="row.route_ids" multiple style="width: 100%">
                  <el-option v-for="route in activeRoutes" :key="route.id" :label="`${route.priority}. ${route.name} · ${route.model}`" :value="route.id" />
                </el-select>
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
            <el-table-column label="切换来源" min-width="140"><template #default="{ row }">{{ routeName(row.fallback_from_user_route_id) }}</template></el-table-column>
            <el-table-column label="切换原因" min-width="135"><template #default="{ row }">{{ row.fallback_reason || row.error_type || '-' }}</template></el-table-column>
            <el-table-column prop="latency_ms" label="耗时(ms)" width="105" align="right" />
          </el-table>
          <el-pagination v-if="logTotal > 20" v-model:current-page="logPage" class="pagination" :page-size="20" :total="logTotal" layout="prev, pager, next, total" @current-change="loadLogs" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="showRouteDialog" :title="editingRoute ? '编辑模型节点' : '添加模型节点'" width="600px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="平台模型" required>
          <el-select v-model="routeForm.platform_route_id" :disabled="Boolean(editingRoute)" style="width: 100%">
            <el-option v-for="item in catalog" :key="item.id" :label="`${item.name} · ${item.model}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="节点名称" required><el-input v-model="routeForm.name" maxlength="120" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="模型级别"><el-select v-model="routeForm.level" style="width: 100%"><el-option label="高性能" value="high" /><el-option label="普通" value="standard" /><el-option label="低成本" value="economy" /></el-select></el-form-item>
          <el-form-item label="优先级"><el-input-number v-model="routeForm.priority" :min="1" :max="1000" controls-position="right" /></el-form-item>
        </div>
        <el-form-item label="节点 Token 额度"><el-input-number v-model="routeForm.quota_limit" :min="1" controls-position="right" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRouteDialog = false">取消</el-button>
        <el-button type="primary" :icon="CircleCheck" :loading="saving" @click="saveRoute">保存</el-button>
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
.log-toolbar { min-height: 58px; display: flex; align-items: center; justify-content: flex-end; padding: 0 16px; border-bottom: 1px solid #ebeef2; }
.pagination { justify-content: flex-end; padding: 16px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
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
