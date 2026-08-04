<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    type?: string
    placeholder?: string
    disabled?: boolean
    mono?: boolean
    size?: 'sm' | 'md'
  }>(),
  {
    type: 'text',
    disabled: false,
    mono: false,
    size: 'md',
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v === undefined ? '' : String(v)),
})
</script>

<template>
  <input
    v-model="value"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    class="w-full px-3 border outline-none transition-colors duration-150 focus:border-[var(--ring)] disabled:opacity-50"
    :style="{
      height: size === 'sm' ? '32px' : '36px',
      borderRadius: '10px',
      background: 'var(--card)',
      borderColor: 'var(--input)',
      color: 'var(--foreground)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: size === 'sm' ? '12px' : '13px',
    }"
  />
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent);
}
</style>
