<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import { getHealth, listSessions, getMcp, getAgent } from '@/api/proxy'
import Btn from '@/components/ui/Btn.vue'
import Badge from '@/components/ui/Badge.vue'

const route = useRoute()
const instanceId = String(route.params.id)

const health = ref<{ healthy: boolean; version: string } | null>(null)
const sessions = ref<any[]>([])
const mcp = ref<Record<string, any>>({})
const agents = ref<any[]>([])
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    const [h, s, m, a] = await Promise.allSettled([
      getHealth(instanceId),
      listSessions(instanceId),
      getMcp(instanceId),
      getAgent(instanceId),
    ])
    if (h.status === 'fulfilled') health.value = h.value
    if (s.status === 'fulfilled') sessions.value = s.value
    if (m.status === 'fulfilled') mcp.value = m.value
    if (a.status === 'fulfilled') agents.value = a.value
  } finally {
    loading.value = false
  }
}

let timer: number | undefined
onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 10000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="h-full overflow-y-auto" :style="{ padding: '24px', background: 'var(--background)', maxWidth: '1120px' }">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-xl font-semibold mb-1" :style="{ color: 'var(--foreground)' }">运行时监控</h1>
        <p class="text-[13px]" :style="{ color: 'var(--muted-foreground)' }">实例运行状态</p>
      </div>
      <Btn size="sm" variant="ghost" :disabled="loading" @click="refresh"><RefreshCw :size="14" :class="{ 'animate-spin': loading }" /> 刷新</Btn>
    </div>

    <!-- KPI cards -->
    <div class="grid gap-3.5 mb-6" :style="{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }">
      <div class="rounded-[14px] p-4" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
        <p class="text-xs mb-2" :style="{ color: 'var(--muted-foreground)' }">健康状态</p>
        <p class="text-[28px] font-semibold" :style="{ color: 'var(--foreground)' }">
          <span :style="{ color: health?.healthy ? 'var(--status-running)' : 'var(--status-error)' }">●</span>
          {{ health?.healthy ? '健康' : '未知' }}
        </p>
        <p class="text-xs mt-1.5" :style="{ color: 'var(--muted-foreground)' }">{{ health?.version ?? '--' }}</p>
      </div>
      <div class="rounded-[14px] p-4" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
        <p class="text-xs mb-2" :style="{ color: 'var(--muted-foreground)' }">总会话数</p>
        <p class="text-[28px] font-semibold" :style="{ color: 'var(--foreground)' }">{{ sessions.length }}</p>
      </div>
      <div class="rounded-[14px] p-4" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
        <p class="text-xs mb-2" :style="{ color: 'var(--muted-foreground)' }">MCP 服务器</p>
        <p class="text-[28px] font-semibold" :style="{ color: 'var(--foreground)' }">{{ Object.keys(mcp).length }}</p>
      </div>
      <div class="rounded-[14px] p-4" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
        <p class="text-xs mb-2" :style="{ color: 'var(--muted-foreground)' }">Agent 数</p>
        <p class="text-[28px] font-semibold" :style="{ color: 'var(--foreground)' }">{{ agents.length }}</p>
      </div>
    </div>

    <!-- MCP status -->
    <div class="rounded-[14px] p-4 mb-6" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
      <h2 class="text-[13px] font-semibold mb-3" :style="{ color: 'var(--foreground)' }">MCP 服务器</h2>
      <div class="flex flex-col gap-2">
        <div v-for="(v, name) in mcp" :key="name" class="flex items-center gap-2.5">
          <span class="rounded-full" :style="{ width: '6px', height: '6px', background: v?.connected || v?.running ? 'var(--chart-2)' : 'var(--muted-foreground)' }" />
          <span class="flex-1 text-[13px] font-mono min-w-0 truncate" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">{{ name }}</span>
          <Badge :label="v?.connected || v?.running ? '运行中' : '已停止'" :status="v?.connected || v?.running ? 'running' : 'idle'" dot />
        </div>
        <p v-if="Object.keys(mcp).length === 0" class="text-xs" :style="{ color: 'var(--muted-foreground)' }">无 MCP 服务器</p>
      </div>
    </div>

    <!-- Recent sessions -->
    <div class="rounded-[14px] overflow-hidden" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
      <h2 class="text-[13px] font-semibold px-4 pt-4 pb-3" :style="{ color: 'var(--foreground)' }">最近会话</h2>
      <table class="w-full text-sm">
        <thead>
          <tr :style="{ background: 'var(--muted)' }">
            <th class="text-left font-medium px-4 py-2.5" :style="{ color: 'var(--muted-foreground)' }">标题</th>
            <th class="text-left font-medium px-4 py-2.5" :style="{ color: 'var(--muted-foreground)' }">状态</th>
            <th class="text-left font-medium px-4 py-2.5" :style="{ color: 'var(--muted-foreground)' }">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions.slice(0, 10)" :key="s.id" :style="{ borderTop: '1px solid var(--border)' }">
            <td class="px-4 py-2.5 truncate" :style="{ color: 'var(--foreground)', maxWidth: '300px' }">{{ s.title || '(无标题)' }}</td>
            <td class="px-4 py-2.5"><Badge :status="s.status || 'idle'" dot /></td>
            <td class="px-4 py-2.5" :style="{ color: 'var(--muted-foreground)' }">{{ s.updatedAt || s.createdAt || '--' }}</td>
          </tr>
          <tr v-if="sessions.length === 0">
            <td colspan="3" class="px-4 py-8 text-center text-xs" :style="{ color: 'var(--muted-foreground)' }">暂无会话</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
