<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageCircleMore, Folder, CircleCheck, PenLine, Box, ChevronDown } from 'lucide-vue-next'
import { useInstancesStore } from '@/stores/instances'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const instances = useInstancesStore()
const auth = useAuthStore()

const navItems = [
  { key: 'chat', label: '对话', icon: MessageCircleMore },
  { key: 'skills', label: 'Skills', icon: Folder },
  { key: 'monitor', label: '监控', icon: CircleCheck },
  { key: 'settings', label: '设置', icon: PenLine },
]

const activeKey = computed(() => {
  const name = route.name as string | undefined
  return navItems.find((n) => n.key === name)?.key ?? ''
})

const instanceName = computed(() => instances.current?.name ?? '实例')
const initial = computed(() => (auth.user?.username ?? 'U')[0].toUpperCase())

function go(key: string) {
  const id = route.params.id as string
  router.push({ name: key, params: { id } })
}
</script>

<template>
  <div
    class="app-shell"
    :style="{
      display: 'grid',
      gridTemplateColumns: '200px minmax(0,1fr)',
      height: '100vh',
      background: 'var(--background)',
      overflow: 'hidden',
    }"
  >
    <!-- Sidebar -->
    <aside
      :style="{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
        minHeight: 0,
      }"
    >
      <nav
        :style="{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }"
      >
        <button
          v-for="item in navItems"
          :key="item.key"
          class="shell-nav-item"
          :data-active="activeKey === item.key"
          :style="{
            width: '100%',
            border: 0,
            background: 'transparent',
            color: 'var(--sidebar-foreground)',
            borderRadius: '10px',
            padding: '9px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            textAlign: 'left',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            transition: 'background 140ms ease, color 140ms ease',
          }"
          @click="go(item.key)"
        >
          <component
            :is="item.icon"
            :size="18"
            :style="{ flex: 'none', color: activeKey === item.key ? 'var(--primary)' : undefined }"
          />
          <span class="truncate flex-1 min-w-0">{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- Main column -->
    <div :style="{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }">
      <!-- Topbar -->
      <header
        :style="{
          height: '56px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--background)',
        }"
      >
        <!-- Logo -->
        <button
          class="flex items-center gap-2 cursor-pointer"
          style="flex: none"
          @click="router.push('/')"
        >
          <Box :size="22" :style="{ color: 'var(--primary)' }" />
          <span
            class="font-semibold whitespace-nowrap"
            :style="{ fontSize: '15px', color: 'var(--foreground)' }"
            >OhMyAgent</span
          >
        </button>

        <!-- Instance selector -->
        <div class="flex-1 flex justify-center min-w-0">
          <button
            class="inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            :style="{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              background: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: '13px',
            }"
            @click="router.push('/')"
          >
            <span class="truncate max-w-[200px]">{{ instanceName }}</span>
            <ChevronDown :size="14" :style="{ color: 'var(--muted-foreground)' }" />
          </button>
        </div>

        <!-- User -->
        <div class="flex items-center gap-2" style="flex: none">
          <div
            class="rounded-full grid place-items-center font-semibold"
            :style="{
              width: '30px',
              height: '30px',
              background: 'linear-gradient(135deg,var(--chart-1),var(--chart-4))',
              color: 'var(--primary-foreground)',
              fontSize: '12px',
            }"
          >
            {{ initial }}
          </div>
        </div>
      </header>

      <!-- Content slot -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell-nav-item:hover {
  background: color-mix(in srgb, var(--background) 64%, var(--sidebar));
}
.shell-nav-item[data-active='true'] {
  background: var(--background);
  color: var(--foreground);
  font-weight: 600;
}
</style>
