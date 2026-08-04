<script setup lang="ts">
import { computed } from 'vue'
import type { InstanceStatus, SessionStatus } from '@opencode/shared'
import { INSTANCE_STATUS_META, SESSION_STATUS_META } from '@opencode/shared'

const props = defineProps<{
  status?: InstanceStatus | SessionStatus
  label?: string
  color?: string // 自定义颜色（CSS 变量或色值），覆盖 status 推断
  dot?: boolean
}>()

const meta = computed(() => {
  if (props.status) {
    const isInstance = props.status in INSTANCE_STATUS_META
    return isInstance
      ? INSTANCE_STATUS_META[props.status as InstanceStatus]
      : SESSION_STATUS_META[props.status as SessionStatus]
  }
  return null
})

const text = computed(() => props.label ?? meta.value?.label ?? '')
const dotColor = computed(
  () => props.color ?? meta.value?.color ?? 'var(--status-running)',
)
const textColor = computed(
  () => props.color ?? meta.value?.color ?? 'var(--foreground)',
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs"
    :style="{ color: textColor }"
  >
    <span
      v-if="dot"
      class="rounded-full"
      :style="{ width: '7px', height: '7px', background: dotColor }"
    />
    {{ text }}
  </span>
</template>
