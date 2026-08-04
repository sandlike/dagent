<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Plus, Search, MessagesSquare, Key, Bot, Cpu, LogOut } from 'lucide-vue-next'
import { useInstancesStore } from '@/stores/instances'
import { useAuthStore } from '@/stores/auth'
import Btn from '@/components/ui/Btn.vue'
import Badge from '@/components/ui/Badge.vue'
import { useToastStore } from '@/stores/toast'
import { ApiRequestError } from '@/api/client'
import { deleteInstance } from '@/api/instances'

const router = useRouter()
const route = useRoute()
const instances = useInstancesStore()
const auth = useAuthStore()
const toast = useToastStore()

const keyword = ref('')
const statusFilter = ref<string>('all')

// ===== 左侧导航 =====
const navItems = [
  { key: 'agents', label: 'Agent 管理', icon: Bot, route: '/' },
  { key: 'llm', label: 'LLM 管理', icon: Key, route: '/providers' },
  { key: 'mcp', label: 'MCP 管理', icon: Cpu, route: '/mcp' },
]

const activeNav = computed(() => {
  const path = route.path
  if (path === '/' || path.startsWith('/instances')) return 'agents'
  if (path === '/providers') return 'llm'
  if (path === '/mcp') return 'mcp'
  return 'agents'
})

const filtered = computed(() => {
  let list = instances.list
  if (keyword.value.trim()) {
    const kw = keyword.value.toLowerCase()
    list = list.filter((i: any) =>
      (i.displayName ?? i.name).toLowerCase().includes(kw) ||
      (i.modelId ?? '').toLowerCase().includes(kw),
    )
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((i: any) => i.status === statusFilter.value)
  }
  return list
})

async function onDeploy() {
  router.push('/instances/new')
}

function openChat(id: number) {
  router.push({ name: 'chat', params: { id } })
}

function openSettings(id: number) {
  router.push({ name: 'settings', params: { id } })
}

async function onDelete(id: number) {
  if (!confirm('确定删除此实例？相关 K8s 资源将一并清理。')) return
  try {
    await deleteInstance(id)
    toast.success('实例已删除')
    await instances.fetchList()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '删除失败')
  }
}

onMounted(() => {
  instances.fetchList()
})
</script>

<template>
  <div class="grid h-screen" :style="{ gridTemplateColumns: '200px minmax(0,1fr)' }">
    <!-- 左侧导航 -->
    <aside
      :style="{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
      }"
    >
      <!-- Logo -->
      <div class="flex items-center gap-2 px-4 py-4 cursor-pointer" @click="router.push('/')">
        <span class="font-bold" :style="{ fontSize: '15px', color: 'var(--foreground)' }">OhMyAgent</span>
      </div>

      <!-- 导航项 -->
      <nav class="flex-1 flex flex-col gap-0.5 px-2 pt-2">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors"
          :style="{
            background: activeNav === item.key ? 'var(--sidebar-accent)' : 'transparent',
            color: activeNav === item.key ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)',
            fontWeight: activeNav === item.key ? 600 : 400,
          }"
          @click="router.push(item.route)"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </button>
      </nav>

      <!-- 底部用户信息 -->
      <div class="px-3 py-3 border-t" :style="{ borderColor: 'var(--sidebar-border)' }">
        <div class="flex items-center gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold text-white"
            :style="{ background: 'var(--primary)' }"
          >
            {{ auth.user?.username?.[0]?.toUpperCase() ?? '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium truncate" :style="{ color: 'var(--foreground)' }">{{ auth.user?.username }}</div>
          </div>
          <button
            class="cursor-pointer p-1 rounded"
            :style="{ color: 'var(--muted-foreground)' }"
            @click="auth.logout(); router.push('/login')"
            title="退出"
          >
            <LogOut :size="14" />
          </button>
        </div>
      </div>
    </aside>

    <!-- 右侧主区 -->
    <div :style="{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }">
      <!-- Topbar -->
      <header
        :style="{ height: '56px', flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }"
      >
        <div class="flex-1" />
        <Btn variant="ghost" size="sm" @click="auth.logout(); router.push('/login')">退出</Btn>
      </header>

      <!-- 内容区（RouterView 让子路由渲染，或本组件渲染实例列表） -->
      <div class="flex-1 overflow-y-auto">
        <!-- Agent 管理视图（实例列表） -->
        <div v-if="activeNav === 'agents'" :style="{ maxWidth: '1100px', margin: '0 auto', padding: '28px 28px 40px' }">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-[22px] font-semibold" :style="{ color: 'var(--foreground)' }">我的实例</h1>
            <Btn rounded="full" @click="onDeploy">
              <Plus :size="15" /> 新建实例
            </Btn>
          </div>

          <!-- Search + filter -->
          <div class="flex items-center gap-3 mb-6 flex-wrap">
            <div class="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" :style="{ color: 'var(--muted-foreground)' }" />
              <input
                v-model="keyword"
                placeholder="搜索实例..."
                class="w-full pl-9 pr-3 border outline-none"
                :style="{ height: '36px', borderRadius: '10px', background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontSize: '13px' }"
              />
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="s in ['all', 'running', 'deploying', 'error', 'stopped']"
                :key="s"
                class="px-3 py-1 rounded-full text-xs cursor-pointer"
                :style="{
                  background: statusFilter === s ? 'var(--primary)' : 'var(--muted)',
                  color: statusFilter === s ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }"
                @click="statusFilter = s"
              >
                {{ s === 'all' ? '全部' : s === 'running' ? '运行中' : s === 'deploying' ? '部署中' : s === 'error' ? '异常' : '已停止' }}
              </button>
            </div>
          </div>

          <!-- 卡片网格 -->
          <div v-if="filtered.length > 0" class="grid gap-4" :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }">
            <div
              v-for="inst in filtered"
              :key="inst.id"
              class="rounded-xl p-5 flex flex-col gap-3 cursor-pointer"
              :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
              @click="openChat(inst.id)"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold" :style="{ color: 'var(--foreground)' }">{{ inst.displayName || inst.name }}</span>
                <Badge :status="inst.status" />
              </div>
              <div class="flex items-center gap-3 text-xs" :style="{ color: 'var(--muted-foreground)' }">
                <span v-if="inst.modelId" class="font-mono">{{ inst.modelId }}</span>
                <span v-if="inst.provider" :style="{ width: '1px', height: '10px', background: 'var(--border)' }" />
                <span v-if="inst.provider">{{ inst.provider }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs" :style="{ color: 'var(--muted-foreground)' }">
                <MessagesSquare :size="12" />
                <span>{{ inst.sessionCount ?? 0 }} 会话</span>
              </div>
              <div class="flex items-center gap-2 mt-auto pt-2">
                <Btn size="sm" variant="ghost" @click.stop="openChat(inst.id)">对话</Btn>
                <Btn size="sm" variant="ghost" @click.stop="openSettings(inst.id)">设置</Btn>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-16 gap-3">
            <p class="text-sm" :style="{ color: 'var(--muted-foreground)' }">暂无实例</p>
            <Btn rounded="full" @click="onDeploy"><Plus :size="15" /> 创建第一个实例</Btn>
          </div>
        </div>

        <!-- LLM 管理 / MCP 管理 由子路由渲染 -->
        <RouterView v-else />
      </div>
    </div>
  </div>
</template>
