<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, Key, Loader2, CheckCircle2, AlertCircle, Pencil, FlaskConical, X } from 'lucide-vue-next'
import { listProviders, createProvider, deleteProvider, updateProvider, testProvider } from '@/api/proxy'
import { useToastStore } from '@/stores/toast'
import { ApiRequestError } from '@/api/client'
import Btn from '@/components/ui/Btn.vue'
import Modal from '@/components/ui/Modal.vue'

const toast = useToastStore()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers = ref<any[]>([])
const loading = ref(false)
const showCreate = ref(false)

// 创建表单
const form = ref({
  name: '',
  template: 'deepseek',
  apiKey: '',
  baseUrl: '',
})
// 创建时可编辑的模型列表（从模板预填，用户可改）
const formModels = ref<string[]>([])
const newModelInput = ref('')
const creating = ref(false)

const TEMPLATES = [
  { id: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-v4-flash'] },
  { id: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  { id: 'moonshot', label: 'Moonshot (Kimi)', defaultUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'qwen', label: '通义千问', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus'] },
  { id: 'custom', label: '自定义 (OpenAI 兼容)', defaultUrl: '', models: [] as string[] },
]

// ===== 编辑模型 Modal =====
const showEdit = ref(false)
const editingId = ref<number | null>(null)
const editingModels = ref<string[]>([])
const editNewInput = ref('')
const savingModels = ref(false)

// ===== 测试连接状态 =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testing = ref<Record<number, any>>({})

async function load() {
  loading.value = true
  try {
    providers.value = await listProviders()
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

function onTemplateChange() {
  const t = TEMPLATES.find((x) => x.id === form.value.template)
  if (t) {
    form.value.baseUrl = t.defaultUrl
    formModels.value = [...t.models]
  }
}

function addFormModel() {
  const m = newModelInput.value.trim()
  if (m && !formModels.value.includes(m)) formModels.value.push(m)
  newModelInput.value = ''
}
function removeFormModel(i: number) {
  formModels.value.splice(i, 1)
}

async function onCreate() {
  if (!form.value.name.trim() || !form.value.apiKey.trim()) {
    toast.error('请填写名称和 API Key')
    return
  }
  if (formModels.value.length === 0) {
    toast.error('请至少添加一个模型')
    return
  }
  creating.value = true
  try {
    await createProvider({
      name: form.value.name,
      template: form.value.template,
      apiKey: form.value.apiKey,
      baseUrl: form.value.baseUrl || undefined,
      models: formModels.value,
    })
    toast.success('LLM Provider 创建成功')
    showCreate.value = false
    form.value = { name: '', template: 'deepseek', apiKey: '', baseUrl: '' }
    formModels.value = []
    await load()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '创建失败')
  } finally {
    creating.value = false
  }
}

async function onDelete(id: number) {
  if (!confirm('确定删除此 Provider？关联的 Higress 资源也会一并清理。')) return
  try {
    await deleteProvider(id)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '删除失败')
  }
}

// ===== 编辑模型 =====
function openEdit(p: any) {
  editingId.value = p.id
  editingModels.value = [...(p.models ?? [])]
  editNewInput.value = ''
  showEdit.value = true
}
function addEditModel() {
  const m = editNewInput.value.trim()
  if (m && !editingModels.value.includes(m)) editingModels.value.push(m)
  editNewInput.value = ''
}
function removeEditModel(i: number) {
  editingModels.value.splice(i, 1)
}
async function saveModels() {
  if (!editingId.value) return
  if (editingModels.value.length === 0) {
    toast.error('请至少保留一个模型')
    return
  }
  savingModels.value = true
  try {
    await updateProvider(editingId.value, { models: editingModels.value })
    toast.success('模型列表已更新')
    showEdit.value = false
    await load()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '更新失败')
  } finally {
    savingModels.value = false
  }
}

// ===== 测试连接 =====
async function onTest(id: number) {
  testing.value[id] = { loading: true }
  try {
    const r = await testProvider(id)
    testing.value[id] = r
    if (r.ok) {
      toast.success(`连通正常（${r.latencyMs}ms）`)
    } else {
      toast.error(`测试失败：${r.error ?? '未知错误'}`)
    }
  } catch (e) {
    testing.value[id] = { ok: false, error: e instanceof ApiRequestError ? e.message : '请求失败' }
    toast.error(e instanceof ApiRequestError ? e.message : '测试失败')
  }
}

function templateLabel(id: string) {
  return TEMPLATES.find((x) => x.id === id)?.label ?? id
}

onMounted(() => {
  load()
})
</script>

<template>
  <div :style="{ maxWidth: '900px', margin: '0 auto', padding: '28px 28px 40px' }">
    <!-- 标题 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-[22px] font-semibold" :style="{ color: 'var(--foreground)' }">LLM 管理</h1>
      <Btn rounded="full" @click="showCreate = true"><Plus :size="15" /> 添加 Provider</Btn>
    </div>

    <!-- 内容 -->
      <!-- 加载中 -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <Loader2 :size="24" class="animate-spin" :style="{ color: 'var(--muted-foreground)' }" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="providers.length === 0" class="flex flex-col items-center justify-center py-12 gap-3">
        <Key :size="40" :style="{ color: 'var(--muted-foreground)' }" />
        <p class="text-sm" :style="{ color: 'var(--muted-foreground)' }">
          还没有配置 LLM Provider
        </p>
        <p class="text-xs" :style="{ color: 'var(--muted-foreground)' }">
          配置后，创建实例时无需填写 API Key，统一走 Higress 网关代理
        </p>
        <Btn size="sm" @click="showCreate = true"><Plus :size="14" /> 添加第一个 Provider</Btn>
      </div>

      <!-- Provider 列表 -->
      <div v-else class="flex flex-col gap-3 max-w-3xl">
        <div
          v-for="p in providers"
          :key="p.id"
          class="rounded-xl p-4 flex items-center gap-4"
          :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
        >
          <!-- 状态图标 -->
          <component
            :is="p.status === 'active' ? CheckCircle2 : AlertCircle"
            :size="20"
            :style="{ color: p.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' }"
          />
          <!-- 信息 -->
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold" :style="{ color: 'var(--foreground)' }">{{ p.name }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full"
                :style="{ background: 'var(--accent)', color: 'var(--accent-foreground)' }"
              >{{ templateLabel(p.template) }}</span>
            </div>
            <span class="text-xs font-mono truncate" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">
              {{ p.baseUrl }}
            </span>
            <div v-if="p.models && p.models.length > 0" class="flex items-center gap-1 flex-wrap mt-0.5">
              <span
                v-for="m in p.models"
                :key="m"
                class="text-[10px] px-1.5 py-0.5 rounded"
                :style="{ background: 'var(--muted)', color: 'var(--muted-foreground)' }"
              >{{ m }}</span>
            </div>
            <!-- 测试结果 -->
            <div v-if="testing[p.id]" class="text-[11px] mt-0.5 flex items-center gap-1.5" :style="{ color: testing[p.id].ok ? 'var(--status-running)' : 'var(--destructive)' }">
              <template v-if="testing[p.id].loading">
                <Loader2 :size="11" class="animate-spin" /> 测试中...
              </template>
              <template v-else-if="testing[p.id].ok">
                <CheckCircle2 :size="11" /> 正常 · {{ testing[p.id].latencyMs }}ms
                <span v-if="testing[p.id].sampleModels?.length" :style="{ color: 'var(--muted-foreground)' }">
                  · 模型: {{ testing[p.id].sampleModels.join(', ') }}
                </span>
              </template>
              <template v-else>
                <AlertCircle :size="11" /> {{ testing[p.id].error ?? '失败' }}
              </template>
            </div>
          </div>
          <!-- 操作 -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="cursor-pointer p-2 rounded-lg"
              :style="{ color: 'var(--muted-foreground)' }"
              :disabled="testing[p.id]?.loading"
              title="测试连接"
              @click="onTest(p.id)"
            >
              <Loader2 v-if="testing[p.id]?.loading" :size="16" class="animate-spin" />
              <FlaskConical v-else :size="16" />
            </button>
            <button
              class="cursor-pointer p-2 rounded-lg"
              :style="{ color: 'var(--muted-foreground)' }"
              title="编辑模型"
              @click="openEdit(p)"
            >
              <Pencil :size="16" />
            </button>
            <button
              class="cursor-pointer p-2 rounded-lg shrink-0"
              :style="{ color: 'var(--destructive)' }"
              title="删除"
              @click="onDelete(p.id)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>

    <!-- 创建 Modal -->
    <Modal v-model="showCreate" title="添加 LLM Provider" width="540px">
      <div class="flex flex-col gap-4 p-2">
        <!-- 名称 -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">名称</label>
          <input
            v-model="form.name"
            placeholder="例如：DeepSeek"
            class="h-9 px-3 rounded-lg text-sm border outline-none"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' }"
          />
        </div>

        <!-- 类型 -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">类型</label>
          <select
            v-model="form.template"
            class="h-9 px-3 rounded-lg text-sm border outline-none"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' }"
            @change="onTemplateChange"
          >
            <option v-for="t in TEMPLATES" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </div>

        <!-- API Key（真实 key，存到 Higress） -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">
            API Key <span :style="{ color: 'var(--destructive)' }">*</span>
          </label>
          <input
            v-model="form.apiKey"
            type="password"
            placeholder="sk-..."
            class="h-9 px-3 rounded-lg text-sm border outline-none font-mono"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }"
          />
          <span class="text-[11px]" :style="{ color: 'var(--muted-foreground)' }">
            真实 Key 将安全存储在 Higress 网关，不会进入 Agent Pod
          </span>
        </div>

        <!-- Base URL（可选） -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">Base URL</label>
          <input
            v-model="form.baseUrl"
            placeholder="https://api.deepseek.com/v1"
            class="h-9 px-3 rounded-lg text-sm border outline-none font-mono"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }"
          />
        </div>

        <!-- 模型列表（可编辑） -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">
            模型列表 <span :style="{ color: 'var(--destructive)' }">*</span>
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="newModelInput"
              placeholder="输入模型名后回车，如 deepseek-chat"
              class="flex-1 h-9 px-3 rounded-lg text-sm border outline-none font-mono"
              :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }"
              @keydown.enter.prevent="addFormModel"
            />
            <Btn size="sm" variant="secondary" @click="addFormModel"><Plus :size="14" /> 添加</Btn>
          </div>
          <div v-if="formModels.length > 0" class="flex items-center gap-1.5 flex-wrap mt-1">
            <span
              v-for="(m, i) in formModels"
              :key="m"
              class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded"
              :style="{ background: 'var(--muted)', color: 'var(--foreground)' }"
            >
              <span class="font-mono">{{ m }}</span>
              <button class="cursor-pointer" :style="{ color: 'var(--muted-foreground)' }" @click="removeFormModel(i)">
                <X :size="11" />
              </button>
            </span>
          </div>
          <span v-else class="text-[11px]" :style="{ color: 'var(--muted-foreground)' }">
            支持自定义模型名，一个 Provider 可配置多个模型
          </span>
        </div>
      </div>

      <template #footer>
        <Btn variant="secondary" @click="showCreate = false">取消</Btn>
        <Btn :disabled="creating" @click="onCreate">
          <Loader2 v-if="creating" :size="14" class="animate-spin" />
          {{ creating ? '创建中...' : '创建' }}
        </Btn>
      </template>
    </Modal>

    <!-- 编辑模型 Modal -->
    <Modal v-model="showEdit" title="编辑模型列表" width="480px">
      <div class="flex flex-col gap-3 p-2">
        <div class="flex items-center gap-2">
          <input
            v-model="editNewInput"
            placeholder="输入模型名后回车添加"
            class="flex-1 h-9 px-3 rounded-lg text-sm border outline-none font-mono"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }"
            @keydown.enter.prevent="addEditModel"
          />
          <Btn size="sm" variant="secondary" @click="addEditModel"><Plus :size="14" /> 添加</Btn>
        </div>
        <div v-if="editingModels.length > 0" class="flex items-center gap-1.5 flex-wrap">
          <span
            v-for="(m, i) in editingModels"
            :key="m"
            class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
            :style="{ background: 'var(--muted)', color: 'var(--foreground)' }"
          >
            <span class="font-mono">{{ m }}</span>
            <button class="cursor-pointer" :style="{ color: 'var(--muted-foreground)' }" @click="removeEditModel(i)">
              <X :size="12" />
            </button>
          </span>
        </div>
        <p v-else class="text-xs" :style="{ color: 'var(--muted-foreground)' }">暂无模型，请添加至少一个</p>
      </div>
      <template #footer>
        <Btn variant="secondary" @click="showEdit = false">取消</Btn>
        <Btn :disabled="savingModels" @click="saveModels">
          <Loader2 v-if="savingModels" :size="14" class="animate-spin" />
          {{ savingModels ? '保存中...' : '保存' }}
        </Btn>
      </template>
    </Modal>
  </div>
</template>
