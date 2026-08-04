<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { useRoute, useRouter, RouterView, RouterLink } from 'vue-router'
import { ArrowLeft, MessageSquare, FileCode, Activity, Settings } from 'lucide-vue-next'
import { useInstancesStore } from '@/stores/instances'
import Badge from '@/components/ui/Badge.vue'

const route = useRoute()
const router = useRouter()
const instances = useInstancesStore()

const instanceId = computed(() => String(route.params.id))
const current = computed(() => instances.current)

async function load(id: string | string[]) {
  const idStr = Array.isArray(id) ? id[0] : id
  try {
    await instances.fetchOne(idStr)
  } catch {
    // 实例不存在或无权访问时，store 里 current 保持 null
  }
}

onMounted(() => load(instanceId.value))
watch(instanceId, (id) => {
  if (id) load(id)
})

const tabs = [
  { name: 'chat', label: '对话', icon: MessageSquare },
  { name: 'skills', label: 'Skills', icon: FileCode },
  { name: 'monitor', label: '监控', icon: Activity },
  { name: 'settings', label: '设置', icon: Settings },
]
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- 顶栏：返回 + 实例名 + 状态 -->
    <header
      class="flex items-center gap-3 px-5 shrink-0"
      :style="{ height: '52px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }"
    >
      <button
        class="inline-flex items-center gap-1.5 text-sm cursor-pointer hover:underline shrink-0"
        :style="{ color: 'var(--muted-foreground)' }"
        @click="router.push('/')"
      >
        <ArrowLeft :size="16" /> 返回
      </button>
      <span :style="{ width: '1px', height: '20px', background: 'var(--border)' }" />
      <span class="text-sm font-semibold truncate" :style="{ color: 'var(--foreground)' }">
        {{ current?.displayName || '加载中...' }}
      </span>
      <span v-if="current" class="font-mono text-[11px] shrink-0" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">
        v{{ current.versionNum }}
      </span>
      <Badge v-if="current" :status="current.status" dot />
    </header>

    <!-- 二级横向 Tab -->
    <nav
      class="flex items-center gap-1 px-5 shrink-0"
      :style="{ height: '44px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }"
    >
      <RouterLink
        v-for="t in tabs"
        :key="t.name"
        :to="{ name: t.name, params: { id: instanceId } }"
        class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition-colors"
        :style="{
          color: route.name === t.name ? 'var(--primary)' : 'var(--muted-foreground)',
          fontWeight: route.name === t.name ? 600 : 400,
          background: route.name === t.name ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
        }"
      >
        <component :is="t.icon" :size="14" />
        {{ t.label }}
      </RouterLink>
    </nav>

    <!-- 内容区 -->
    <div class="flex-1 overflow-hidden" :style="{ minWidth: 0, minHeight: 0 }">
      <RouterView />
    </div>
  </div>
</template>
