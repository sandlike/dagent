<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, Cpu, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-vue-next'
import { listMcpServers, createMcpServer, deleteMcpServer } from '@/api/proxy'
import { useToastStore } from '@/stores/toast'
import { ApiRequestError } from '@/api/client'
import Btn from '@/components/ui/Btn.vue'
import Modal from '@/components/ui/Modal.vue'

const toast = useToastStore()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servers = ref<any[]>([])
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)

const form = ref({
  name: '',
  type: 'remote' as 'remote' | 'local',
  url: '',
  authToken: '',
})

async function load() {
  loading.value = true
  try {
    servers.value = await listMcpServers()
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

async function onCreate() {
  if (!form.value.name.trim()) {
    toast.error('请填写名称')
    return
  }
  if (form.value.type === 'remote' && !form.value.url.trim()) {
    toast.error('请填写 URL')
    return
  }
  creating.value = true
  try {
    await createMcpServer({
      name: form.value.name,
      type: form.value.type,
      url: form.value.url || undefined,
      authToken: form.value.authToken || undefined,
    })
    toast.success('MCP Server 创建成功')
    showCreate.value = false
    form.value = { name: '', type: 'remote', url: '', authToken: '' }
    await load()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '创建失败')
  } finally {
    creating.value = false
  }
}

async function onDelete(id: number) {
  if (!confirm('确定删除此 MCP Server？')) return
  try {
    await deleteMcpServer(id)
    toast.success('已删除')
    await load()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '删除失败')
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div :style="{ maxWidth: '900px', margin: '0 auto', padding: '28px 28px 40px' }">
    <!-- 标题 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-[22px] font-semibold" :style="{ color: 'var(--foreground)' }">MCP 管理</h1>
      <Btn rounded="full" @click="showCreate = true"><Plus :size="15" /> 添加 MCP Server</Btn>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 :size="24" class="animate-spin" :style="{ color: 'var(--muted-foreground)' }" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="servers.length === 0" class="flex flex-col items-center justify-center py-12 gap-3">
      <Cpu :size="40" :style="{ color: 'var(--muted-foreground)' }" />
      <p class="text-sm" :style="{ color: 'var(--muted-foreground)' }">还没有配置 MCP Server</p>
      <p class="text-xs text-center max-w-md" :style="{ color: 'var(--muted-foreground)' }">
        Remote MCP 注册到 Higress 网关后，<br />Agent 调用时统一走代理 + 消费者认证
      </p>
      <Btn size="sm" @click="showCreate = true"><Plus :size="14" /> 添加第一个</Btn>
    </div>

    <!-- MCP Server 列表 -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="s in servers"
        :key="s.id"
        class="rounded-xl p-4 flex items-center gap-4"
        :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
      >
        <component
          :is="s.status === 'active' ? CheckCircle2 : AlertCircle"
          :size="20"
          :style="{ color: s.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' }"
        />
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold" :style="{ color: 'var(--foreground)' }">{{ s.name }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full" :style="{ background: 'var(--muted)', color: 'var(--muted-foreground)' }">{{ s.type }}</span>
          </div>
          <span v-if="s.url" class="text-xs font-mono truncate" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">{{ s.url }}</span>
          <div v-if="s.gatewayUrl" class="flex items-center gap-1 mt-0.5">
            <Shield :size="11" :style="{ color: 'var(--status-running)' }" />
            <span class="text-[10px]" :style="{ color: 'var(--muted-foreground)' }">走 Higress 网关代理</span>
          </div>
        </div>
        <button
          class="cursor-pointer p-2 rounded-lg shrink-0"
          :style="{ color: 'var(--destructive)' }"
          @click="onDelete(s.id)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <!-- 创建 Modal -->
    <Modal v-model="showCreate" title="添加 MCP Server">
      <div class="flex flex-col gap-4 p-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">名称</label>
          <input v-model="form.name" placeholder="如：jira-mcp" class="h-9 px-3 rounded-lg text-sm border outline-none" :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' }" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">类型</label>
          <select v-model="form.type" class="h-9 px-3 rounded-lg text-sm border outline-none" :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' }">
            <option value="remote">Remote（HTTP，走 Higress 代理）</option>
            <option value="local">Local（命令行，不走代理）</option>
          </select>
        </div>
        <div v-if="form.type === 'remote'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">URL</label>
          <input v-model="form.url" placeholder="https://mcp.example.com/sse" class="h-9 px-3 rounded-lg text-sm border outline-none font-mono" :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }" />
        </div>
        <div v-if="form.type === 'remote'" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">Auth Token <span :style="{ color: 'var(--muted-foreground)' }">(可选)</span></label>
          <input v-model="form.authToken" type="password" placeholder="Bearer token（存到 Higress）" class="h-9 px-3 rounded-lg text-sm border outline-none font-mono" :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }" />
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
  </div>
</template>
