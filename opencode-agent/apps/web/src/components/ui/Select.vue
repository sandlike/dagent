<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    disabled?: boolean
    mono?: boolean
    size?: 'sm' | 'md'
  }>(),
  { disabled: false, mono: false, size: 'md' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v ?? ''),
})
</script>

<template>
  <div class="relative w-full">
    <select
      v-model="value"
      :disabled="disabled"
      class="w-full appearance-none px-3 border outline-none cursor-pointer disabled:opacity-50 pr-9"
      :style="{
        height: size === 'sm' ? '32px' : '36px',
        borderRadius: '10px',
        background: 'var(--card)',
        borderColor: 'var(--input)',
        color: 'var(--foreground)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: size === 'sm' ? '12px' : '13px',
      }"
    >
      <slot />
    </select>
    <ChevronDown
      :size="16"
      class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      :style="{ color: 'var(--muted-foreground)' }"
    />
  </div>
</template>
