<script setup lang="ts">
defineProps<{ label?: string; hint?: string; required?: boolean }>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="text-sm font-medium flex items-center gap-1" :style="{ color: 'var(--foreground)' }">
      {{ label }}
      <span v-if="required" :style="{ color: 'var(--destructive)' }">*</span>
    </label>
    <slot />
    <p v-if="hint" class="text-xs" :style="{ color: 'var(--muted-foreground)' }">
      {{ hint }}
    </p>
  </div>
</template>
