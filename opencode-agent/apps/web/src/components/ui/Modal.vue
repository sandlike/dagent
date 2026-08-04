<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
    closeOnBackdrop?: boolean
  }>(),
  { width: '440px', closeOnBackdrop: true },
)
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

function close() {
  emit('update:modelValue', false)
}
function onBackdrop() {
  if (props.closeOnBackdrop) close()
}

watch(
  () => props.modelValue,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[90] flex items-center justify-center p-4"
        :style="{ background: 'rgba(0,0,0,0.5)' }"
        @click.self="onBackdrop"
      >
        <div
          class="rounded-[16px] flex flex-col max-h-[90vh]"
          :style="{
            width: width,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--card-foreground)',
          }"
        >
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between px-5 py-4 border-b shrink-0"
            :style="{ borderColor: 'var(--border)' }"
          >
            <slot name="header">
              <h3 class="text-base font-semibold">{{ title }}</h3>
            </slot>
            <button
              class="cursor-pointer p-1 rounded-md transition-colors"
              :style="{ color: 'var(--muted-foreground)' }"
              @click="close"
            >
              <X :size="18" />
            </button>
          </div>
          <div class="p-5 overflow-y-auto flex-1 min-h-0">
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0"
            :style="{ borderColor: 'var(--border)' }"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
