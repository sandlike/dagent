<script setup lang="ts">
import { computed } from 'vue'
import { useWizardStore } from '@/stores/wizard'
import { AGENT_TEMPLATES, findTemplate } from '@opencode/shared'
import { Check } from 'lucide-vue-next'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'

const wizard = useWizardStore()

const currentAgent = computed(() => wizard.form.agentType)

function selectAgent(id: string) {
  const t = findTemplate(id)
  if (!t || !t.available) return
  // 注入该模板的推荐配置（保留用户已填的 name/namespace）
  const { name, namespace } = wizard.form
  wizard.form = { ...t.configTemplate, name, namespace, agentType: t.id } as typeof wizard.form
}
</script>

<template>
  <!-- 展示名称（用户填，系统自动生成 UUID 资源名） -->
  <Field label="展示名称" required>
    <Input v-model="wizard.form.name" placeholder="例如：日常编码助手" />
  </Field>

  <!-- 显示描述 -->
  <Field label="显示描述">
    <Input v-model="wizard.form.description" placeholder="例如：用于日常代码编写与审查" />
  </Field>

  <!-- Agent 类型 -->
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">Agent 类型</label>
    <div class="grid gap-3" :style="{ gridTemplateColumns: 'repeat(3, 1fr)' }">
      <button
        v-for="t in AGENT_TEMPLATES"
        :key="t.id"
        class="text-left rounded-xl p-4 cursor-pointer transition-colors flex flex-col gap-1.5"
        :style="{
          border: currentAgent === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
          background: currentAgent === t.id
            ? 'color-mix(in srgb, var(--primary) 8%, var(--card))'
            : 'var(--card)',
          opacity: t.available ? 1 : 0.5,
          cursor: t.available ? 'pointer' : 'not-allowed',
        }"
        @click="selectAgent(t.id)"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
            :style="{
              background: currentAgent === t.id ? 'var(--primary)' : 'var(--muted)',
              color: 'var(--primary-foreground)',
            }"
          >
            <Check v-if="currentAgent === t.id" :size="10" />
          </span>
          <span
            class="text-sm font-semibold"
            :style="{ color: currentAgent === t.id ? 'var(--primary)' : 'var(--foreground)' }"
          >{{ t.label }}</span>
        </div>
        <span class="text-xs" :style="{ color: 'var(--muted-foreground)' }">
          {{ t.available ? t.description : '敬请期待' }}
        </span>
      </button>
    </div>
    <span class="text-xs" :style="{ color: 'var(--muted-foreground)' }">后续将支持更多 Agent 类型</span>
  </div>

  <!-- 默认 Agent -->
  <Field label="默认 Agent">
    <Select v-model="wizard.form.defaultAgent">
      <option value="build">build（构建/编码）</option>
      <option value="plan">plan（规划）</option>
    </Select>
  </Field>
</template>
