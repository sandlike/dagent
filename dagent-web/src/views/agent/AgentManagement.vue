<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Check, CircleClose, Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { agentApi, type AgentDefinitionCreate, type AgentVersionCreate } from '@/api/agents'
import type { AgentDefinition } from '@/api/types'

const loading = ref(false)
const definitions = ref<AgentDefinition[]>([])
const skills = ref<{ name: string; status: string }[]>([])
const mcpServers = ref<{ name: string; status: unknown }[]>([])
const showDefinitionDialog = ref(false)
const showVersionDialog = ref(false)
const selectedDefinition = ref<AgentDefinition | null>(null)
const definitionForm = reactive<AgentDefinitionCreate>({
  role_type: 'development',
  name: '',
  default_flag: false,
})
const versionForm = reactive({
  style: 'balanced',
  prompt_ref: 'opencode://agent/development',
  skill_policy: '',
  mcp_policy: '{}',
  tool_policy: '{}',
})

const roleLabels: Record<string, string> = {
  requirement_clarification: '需求澄清',
  development: '开发',
}

async function load() {
  loading.value = true
  try {
    const [definitionResponse, skillResponse, mcpResponse] = await Promise.all([
      agentApi.list(),
      agentApi.skills(),
      agentApi.mcpServers(),
    ])
    definitions.value = definitionResponse.data
    skills.value = skillResponse.data
    mcpServers.value = mcpResponse.data
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(definitionForm, { role_type: 'development', name: '', default_flag: false })
  showDefinitionDialog.value = true
}

async function createDefinition() {
  if (!definitionForm.name.trim()) return ElMessage.warning('请输入 Agent 名称')
  await agentApi.create({ ...definitionForm })
  showDefinitionDialog.value = false
  ElMessage.success('Agent 定义已创建')
  await load()
}

function openVersion(definition: AgentDefinition) {
  selectedDefinition.value = definition
  Object.assign(versionForm, {
    style: 'balanced',
    prompt_ref: `opencode://agent/${definition.role_type}`,
    skill_policy: '',
    mcp_policy: '{}',
    tool_policy: '{}',
  })
  showVersionDialog.value = true
}

function parseObject(value: string, label: string) {
  try {
    const result = JSON.parse(value || '{}')
    if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error()
    return result as Record<string, unknown>
  } catch {
    throw new Error(`${label} 必须是 JSON 对象`)
  }
}

async function createVersion() {
  if (!selectedDefinition.value) return
  try {
    const payload: AgentVersionCreate = {
      style: versionForm.style,
      prompt_ref: versionForm.prompt_ref,
      skill_policy: versionForm.skill_policy.split(',').map((item) => item.trim()).filter(Boolean),
      mcp_policy: parseObject(versionForm.mcp_policy, 'MCP 策略'),
      tool_policy: parseObject(versionForm.tool_policy, '工具策略'),
    }
    await agentApi.createVersion(selectedDefinition.value.id, payload)
    showVersionDialog.value = false
    ElMessage.success('草稿版本已创建')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '版本配置无效')
  }
}

async function publish(definition: AgentDefinition, versionId: number) {
  await ElMessageBox.confirm('发布后，之前的已发布版本会被标记为已替代。', '发布 Agent 版本', {
    type: 'warning',
    confirmButtonText: '发布',
  })
  await agentApi.publish(definition.id, versionId)
  ElMessage.success('Agent 版本已发布')
  await load()
}

async function setDefault(definition: AgentDefinition) {
  await agentApi.update(definition.id, { default_flag: true })
  ElMessage.success('默认 Agent 已更新')
  await load()
}

async function disable(definition: AgentDefinition) {
  await ElMessageBox.confirm('停用后不能发布新版本，也不会再作为默认 Agent。', '停用 Agent', {
    type: 'warning',
    confirmButtonText: '停用',
  })
  await agentApi.disable(definition.id)
  ElMessage.success('Agent 已停用')
  await load()
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onMounted(load)
</script>

<template>
  <div class="agent-page" v-loading="loading">
    <header class="page-heading">
      <div><h1>Agent 管理</h1><p>需求澄清与开发 Agent 的定义、版本和运行策略</p></div>
      <div class="heading-actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建 Agent</el-button>
      </div>
    </header>

    <section class="summary-band">
      <div><span>Agent 定义</span><strong>{{ definitions.length }}</strong></div>
      <div><span>已发布版本</span><strong>{{ definitions.flatMap((item) => item.versions).filter((item) => item.status === 'published').length }}</strong></div>
      <div><span>允许 Skills</span><strong>{{ skills.length }}</strong></div>
      <div><span>MCP 服务</span><strong>{{ mcpServers.length }}</strong></div>
    </section>

    <section class="data-section">
      <div class="section-heading"><h2>Agent 定义</h2><span>运行任务时按角色选择已发布版本</span></div>
      <el-table :data="definitions" empty-text="暂无 Agent 定义" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="version-list">
              <el-table :data="row.versions" size="small" empty-text="暂无版本">
                <el-table-column prop="version" label="版本" width="80" />
                <el-table-column prop="style" label="风格" width="110" />
                <el-table-column prop="prompt_ref" label="Prompt" min-width="240" show-overflow-tooltip />
                <el-table-column label="策略" min-width="180">
                  <template #default="scope">{{ scope.row.skill_policy.join(', ') || '默认' }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="scope"><el-tag :type="scope.row.status === 'published' ? 'success' : 'info'">{{ scope.row.status }}</el-tag></template>
                </el-table-column>
                <el-table-column label="创建时间" width="180"><template #default="scope">{{ formatTime(scope.row.created_at) }}</template></el-table-column>
                <el-table-column label="操作" width="100" align="right">
                  <template #default="scope"><el-button v-if="scope.row.status === 'draft' && row.status !== 'disabled'" text type="primary" :icon="Check" @click="publish(row, scope.row.id)">发布</el-button></template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="200" />
        <el-table-column label="角色" width="150"><template #default="{ row }">{{ roleLabels[row.role_type] || row.role_type }}</template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status }}</el-tag></template></el-table-column>
        <el-table-column label="默认" width="90"><template #default="{ row }"><el-tag v-if="row.default_flag" type="primary">默认</el-tag><span v-else>-</span></template></el-table-column>
        <el-table-column label="版本数" width="90"><template #default="{ row }">{{ row.versions.length }}</template></el-table-column>
        <el-table-column label="操作" width="260" align="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'disabled'" text type="primary" :icon="Plus" @click="openVersion(row)">新版本</el-button>
            <el-button v-if="row.status !== 'disabled' && !row.default_flag" text @click="setDefault(row)">设为默认</el-button>
            <el-button v-if="row.status !== 'disabled'" text type="danger" :icon="CircleClose" @click="disable(row)">停用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="showDefinitionDialog" title="新建 Agent" width="520px">
      <el-form label-position="top">
        <el-form-item label="角色" required><el-segmented v-model="definitionForm.role_type" :options="[{ label: '需求澄清', value: 'requirement_clarification' }, { label: '开发', value: 'development' }]" /></el-form-item>
        <el-form-item label="名称" required><el-input v-model="definitionForm.name" placeholder="例如：开发 Agent" /></el-form-item>
        <el-form-item><el-checkbox v-model="definitionForm.default_flag">设为该角色的默认 Agent</el-checkbox></el-form-item>
      </el-form>
      <template #footer><el-button @click="showDefinitionDialog = false">取消</el-button><el-button type="primary" @click="createDefinition">创建</el-button></template>
    </el-dialog>

    <el-dialog v-model="showVersionDialog" :title="`新建版本 · ${selectedDefinition?.name || ''}`" width="680px">
      <el-form label-position="top">
        <div class="form-grid"><el-form-item label="执行风格"><el-select v-model="versionForm.style" style="width: 100%"><el-option value="balanced" label="Balanced" /><el-option value="strict" label="Strict" /></el-select></el-form-item><el-form-item label="Prompt 引用" required><el-input v-model="versionForm.prompt_ref" /></el-form-item></div>
        <el-form-item label="Skills（逗号分隔）"><el-input v-model="versionForm.skill_policy" placeholder="例如：code-change, test-design" /></el-form-item>
        <el-form-item label="MCP 策略"><el-input v-model="versionForm.mcp_policy" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="工具策略"><el-input v-model="versionForm.tool_policy" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showVersionDialog = false">取消</el-button><el-button type="primary" @click="createVersion">创建草稿</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.agent-page { max-width: 1500px; margin: 0 auto; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 7px 0 0; color: #707a87; font-size: 13px; }
.heading-actions { display: flex; gap: 8px; }
.summary-band { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); background: #fff; border: 1px solid #dfe3e8; margin-bottom: 18px; }
.summary-band > div { min-height: 76px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid #e5e8eb; }
.summary-band > div:last-child { border-right: 0; }
.summary-band span { color: #7f8996; font-size: 12px; }
.summary-band strong { font-size: 20px; }
.data-section { background: #fff; border: 1px solid #dfe3e8; }
.section-heading { min-height: 62px; padding: 0 17px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e6e9ed; }
.section-heading h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.section-heading span { color: #89919c; font-size: 12px; }
.version-list { padding: 12px 36px; background: #f7f8fa; }
.form-grid { display: grid; grid-template-columns: 160px 1fr; gap: 14px; }
@media (max-width: 760px) { .summary-band { grid-template-columns: repeat(2, 1fr); } .page-heading { align-items: flex-start; } .form-grid { grid-template-columns: 1fr; } }
</style>
