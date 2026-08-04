<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    rounded?: 'md' | 'full'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    rounded: 'md',
    disabled: false,
    type: 'button',
  },
)

const height = computed(() =>
  ({ sm: '32px', md: '36px', lg: '40px' })[props.size],
)
const padding = computed(() =>
  props.rounded === 'full'
    ? ({ sm: '0 13px', md: '0 16px', lg: '0 20px' })[props.size]
    : ({ sm: '0 13px', md: '0 14px', lg: '0 16px' })[props.size],
)
const fontSize = computed(() =>
  ({ sm: '12px', md: '13px', lg: '14px' })[props.size],
)

const variantStyle = computed(() => {
  switch (props.variant) {
    case 'primary':
      return {
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        border: '1px solid var(--primary)',
      }
    case 'secondary':
      return {
        background: 'var(--muted)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }
    case 'destructive':
      return {
        background: 'transparent',
        color: 'var(--destructive)',
        border: '1px solid var(--border)',
      }
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap cursor-pointer transition-all duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0"
    :style="{
      height: height,
      padding: padding,
      fontSize: fontSize,
      borderRadius: rounded === 'full' ? '999px' : '10px',
      ...variantStyle,
    }"
  >
    <slot />
  </button>
</template>
