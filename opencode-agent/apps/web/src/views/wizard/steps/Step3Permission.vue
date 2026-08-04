<script setup lang="ts">
import { computed } from 'vue'
import { useWizardStore } from '@/stores/wizard'
import { PERMISSION_PRESETS, PERMISSION_TOOLS, PERMISSION_ACTIONS } from '@opencode/shared'
import type { PermissionMode, PermissionTool } from '@opencode/shared'
import { Plus, Trash2 } from 'lucide-vue-next'
import Btn from '@/components/ui/Btn.vue'

const wizard = useWizardStore()

const modeOptions: { value: PermissionMode; label: string; desc: string }[] = [
  { value: 'readonly', label: '只读', desc: 'edit/bash = deny' },
  { value: 'ask', label: '审批制', desc: '所有操作 ask' },
  { value: 'full', label: '全开', desc: '默认 allow' },
  { value: 'custom', label: '自定义', desc: '下方表格配置' },
]

function onModeChange(v: string) {
  wizard.form.permissionMode = v as PermissionMode
  if (v !== 'custom') {
    wizard.form.toolPermissions = { ...PERMISSION_PRESETS[v as Exclude<PermissionMode, 'custom'>] }
  }
}

function isCustom() {
  return wizard.form.permissionMode === 'custom'
}

function addBashRule() {
  wizard.form.bashRules.push({ pattern: '', action: 'deny' })
}
function removeBashRule(i: number) {
  wizard.form.bashRules.splice(i, 1)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">权限模式</label>
    <div class="grid gap-2" :style="{ gridTemplateColumns: 'repeat(2, 1fr)' }">
      <button
        v-for="opt in modeOptions"
        :key="opt.value"
        class="text-left rounded-lg p-3 border cursor-pointer transition-colors"
        :style="{
          borderColor: wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'var(--border)',
          background: wizard.form.permissionMode === opt.value ? 'color-mix(in srgb, var(--primary) 10%, var(--card))' : 'var(--card)',
        }"
        @click="onModeChange(opt.value)"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-3.5 h-3.5 rounded-full border-2"
            :style="{ borderColor: wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'var(--border)', background: wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'transparent' }"
          />
          <span class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">{{ opt.label }}</span>
        </div>
        <p class="text-xs mt-1 ml-5.5" :style="{ color: 'var(--muted-foreground)' }">{{ opt.desc }}</p>
      </button>
    </div>
  </div>

  <!-- 工具权限表 -->
  <div class="rounded-xl overflow-hidden border" :style="{ borderColor: 'var(--border)' }">
    <table class="w-full text-sm">
      <thead>
        <tr :style="{ background: 'var(--muted)' }">
          <th class="text-left font-medium px-4 py-2.5" :style="{ color: 'var(--muted-foreground)' }">工具</th>
          <th v-for="a in PERMISSION_ACTIONS" :key="a" class="px-4 py-2.5 font-medium text-center" :style="{ color: 'var(--muted-foreground)' }">{{ a }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in PERMISSION_TOOLS"
          :key="t.tool"
          :style="{ borderTop: '1px solid var(--border)' }"
        >
          <td class="px-4 py-2.5" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' }">{{ t.label }}</td>
          <td v-for="a in PERMISSION_ACTIONS" :key="a" class="px-4 py-2.5 text-center">
            <input
              type="radio"
              :name="`tool-${t.tool}`"
              :checked="wizard.form.toolPermissions[t.tool as PermissionTool] === a"
              :disabled="!isCustom()"
              class="cursor-pointer accent-[var(--primary)]"
              @change="wizard.form.toolPermissions[t.tool as PermissionTool] = a"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-if="!isCustom()" class="text-xs" :style="{ color: 'var(--muted-foreground)' }">
    当前为预设模式，表格只读展示。选择"自定义"可编辑。
  </p>

  <!-- bash 细粒度规则 -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">bash 细粒度规则</label>
      <Btn size="sm" variant="ghost" @click="addBashRule"><Plus :size="14" /> 添加</Btn>
    </div>
    <div
      v-for="(rule, i) in wizard.form.bashRules"
      :key="i"
      class="flex items-center gap-2"
    >
      <input
        v-model="rule.pattern"
        placeholder="命令模式，如 rm -rf *"
        class="flex-1"
        :style="{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' }"
      />
      <select
        v-model="rule.action"
        class="cursor-pointer"
        :style="{ height: '32px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '12px' }"
      >
        <option v-for="a in PERMISSION_ACTIONS" :key="a" :value="a">{{ a }}</option>
      </select>
      <button class="cursor-pointer p-1.5" :style="{ color: 'var(--destructive)' }" @click="removeBashRule(i)">
        <Trash2 :size="14" />
      </button>
    </div>
  </div>
</template>
