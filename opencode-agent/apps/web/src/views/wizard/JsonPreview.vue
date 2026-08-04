<script setup lang="ts">
import { ref } from 'vue'
import { File, Check } from 'lucide-vue-next'
import Btn from '@/components/ui/Btn.vue'
import Modal from '@/components/ui/Modal.vue'

defineProps<{ configJson: string }>()
const emit = defineEmits<{ import: [json: string] }>()

const showImport = ref(false)
const importText = ref('')
const rawMode = ref(false)

function doImport() {
  if (importText.value.trim()) {
    emit('import', importText.value)
  }
  showImport.value = false
  importText.value = ''
}
</script>

<template>
  <div class="flex flex-col overflow-hidden" :style="{ width: '45%', minWidth: 0, background: 'var(--muted)' }">
    <!-- Title bar -->
    <div
      class="flex items-center justify-between h-11 px-4 border-b shrink-0"
      :style="{ borderColor: 'var(--border)', background: 'var(--muted)' }"
    >
      <div class="flex items-center gap-2">
        <File :size="16" :style="{ color: 'var(--muted-foreground)' }" />
        <span class="text-sm font-semibold" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">opencode.json</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-xs whitespace-nowrap border cursor-pointer"
          :style="{ background: rawMode ? 'var(--primary)' : 'var(--background)', borderColor: 'var(--border)', color: rawMode ? 'var(--primary-foreground)' : 'var(--muted-foreground)' }"
          @click="rawMode = !rawMode"
        >
          {{ rawMode ? '返回预览' : '切换原始编辑' }}
        </button>
        <button
          class="inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-xs whitespace-nowrap border cursor-pointer"
          :style="{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }"
          @click="showImport = true"
        >
          导入JSON
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <textarea
        v-if="rawMode"
        :value="configJson"
        readonly
        class="w-full h-full resize-none outline-none border-0"
        :style="{ background: 'transparent', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' }"
      />
      <pre
        v-else
        class="text-sm leading-6 whitespace-pre-wrap break-all"
        :style="{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--foreground)', margin: 0 }"
        >{{ configJson }}</pre>
    </div>

    <!-- Deploy checklist -->
    <div
      class="flex items-center gap-3 px-4 py-3 border-t shrink-0 flex-wrap"
      :style="{ borderColor: 'var(--border)', background: 'var(--muted)' }"
    >
      <span
        v-for="item in ['ConfigMap', 'Secret', 'Deployment', 'PVC']"
        :key="item"
        class="inline-flex items-center gap-1.5 text-xs"
        :style="{ color: 'var(--chart-2)' }"
      >
        <span
          class="inline-flex items-center justify-center w-6 h-6 rounded-md"
          :style="{ background: 'color-mix(in srgb, var(--chart-2) 15%, transparent)' }"
        >
          <Check :size="14" />
        </span>
        {{ item }}
      </span>
    </div>

    <!-- Import modal -->
    <Modal v-model="showImport" title="导入 opencode.json" width="560px">
      <p class="text-sm mb-3" :style="{ color: 'var(--muted-foreground)' }">
        粘贴一份 opencode.json，将自动解析并回填到各步骤表单。
      </p>
      <textarea
        v-model="importText"
        placeholder='{ "provider": {...}, "model": "..." }'
        rows="14"
        class="w-full resize-none outline-none border p-3 rounded-lg"
        :style="{ background: 'var(--background)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' }"
      />
      <template #footer>
        <Btn variant="ghost" @click="showImport = false">取消</Btn>
        <Btn @click="doImport">导入</Btn>
      </template>
    </Modal>
  </div>
</template>
