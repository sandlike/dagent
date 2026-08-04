<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import { CheckCircle2, XCircle, Info } from 'lucide-vue-next'

const toast = useToastStore()
</script>

<template>
  <div
    class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
    style="pointer-events: none"
  >
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-sm shadow-lg"
        :style="{
          background: 'var(--popover)',
          border: '1px solid var(--border)',
          color: 'var(--popover-foreground)',
          pointerEvents: 'auto',
        }"
      >
        <CheckCircle2
          v-if="t.variant === 'success'"
          :size="16"
          :style="{ color: 'var(--status-running)' }"
        />
        <XCircle
          v-else-if="t.variant === 'error'"
          :size="16"
          :style="{ color: 'var(--destructive)' }"
        />
        <Info v-else :size="16" :style="{ color: 'var(--muted-foreground)' }" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
