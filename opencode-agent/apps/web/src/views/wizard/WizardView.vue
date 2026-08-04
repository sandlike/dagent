<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { parseConfig } from '@opencode/shared'
import { useWizardStore } from '@/stores/wizard'
import { useToastStore } from '@/stores/toast'
import { useInstancesStore } from '@/stores/instances'
import { deployInstance, updateInstance } from '@/api/instances'
import { ApiRequestError } from '@/api/client'
import Btn from '@/components/ui/Btn.vue'
import JsonPreview from './JsonPreview.vue'
import Step1Basic from './steps/Step1Basic.vue'
import Step2Provider from './steps/Step2Provider.vue'
import Step3Permission from './steps/Step3Permission.vue'
import Step4McpSkills from './steps/Step4McpSkills.vue'

const router = useRouter()
const wizard = useWizardStore()
const toast = useToastStore()
const instances = useInstancesStore()
const deploying = ref(false)

// 4 步向导（去掉了原「版本选择」，改为基本信息里的 Agent 类型卡片）
const steps = [
  { n: 1, label: '基本信息' },
  { n: 2, label: '模型与 Provider' },
  { n: 3, label: '权限策略' },
  { n: 4, label: 'MCP + Skills' },
]

function onImport(jsonStr: string) {
  try {
    const obj = JSON.parse(jsonStr)
    wizard.form = parseConfig(obj, { name: wizard.form.name, namespace: wizard.form.namespace })
    toast.success('配置已导入，请检查各步骤')
  } catch {
    toast.error('JSON 解析失败，请检查格式')
  }
}

async function deploy() {
  if (!wizard.form.name.trim()) {
    toast.error('请先填写展示名称')
    wizard.goTo(1)
    return
  }
  // 编辑模式：检测 localStorage 里的 editingInstanceId，走 PUT（部署新版本）
  const editingId = localStorage.getItem('oma:editingInstanceId')
  deploying.value = true
  try {
    if (editingId) {
      const res = await updateInstance(editingId, {
        displayName: wizard.form.name,
        configJson: wizard.configJson,
        provider: wizard.form.provider.template,
        modelId: wizard.form.model,
        agentType: wizard.form.agentType,
        providerId: wizard.form.providerId,
      } as any)
      localStorage.removeItem('oma:editingInstanceId')
      localStorage.removeItem('oma:editingGroupId')
      toast.success('已部署新版本')
      await instances.fetchList()
      router.push({ name: 'settings', params: { id: res.instance.id } })
    } else {
      const res = await deployInstance({
        displayName: wizard.form.name,
        configJson: wizard.configJson,
        provider: wizard.form.provider.template,
        modelId: wizard.form.model,
        agentType: wizard.form.agentType,
        providerId: wizard.form.providerId,
      } as any)
      toast.success('部署请求已提交')
      await instances.fetchList()
      router.push({ name: 'settings', params: { id: res.instance.id } })
    }
  } catch (e) {
    const msg = e instanceof ApiRequestError ? e.message : '部署失败，请重试'
    toast.error(msg)
  } finally {
    deploying.value = false
  }
}

// 顶部标题反映模式
const isEditing = ref(false)
function cancelEdit() {
  localStorage.removeItem('oma:editingInstanceId')
  localStorage.removeItem('oma:editingGroupId')
  router.push('/')
}
onMounted(() => {
  isEditing.value = !!localStorage.getItem('oma:editingInstanceId')
})
</script>

<template>
  <main class="flex flex-col h-screen overflow-hidden">
    <!-- Top -->
    <header
      class="flex items-center justify-between h-14 px-6 border-b shrink-0"
      :style="{ borderColor: 'var(--border)', background: 'var(--background)' }"
    >
      <button
        class="inline-flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer hover:underline"
        :style="{ color: 'var(--muted-foreground)' }"
        @click="cancelEdit"
      >
        <ArrowLeft :size="16" /> 返回实例列表
      </button>
      <h1 class="text-base font-semibold truncate" :style="{ color: 'var(--foreground)' }">
        {{ isEditing ? '编辑配置（部署新版本）' : '新建实例' }}
      </h1>
      <div class="flex items-center gap-2">
        <label class="text-xs whitespace-nowrap" :style="{ color: 'var(--muted-foreground)' }">展示名</label>
        <input
          v-model="wizard.form.name"
          placeholder="输入展示名称"
          class="w-48"
          :style="{ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' }"
        />
      </div>
    </header>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left: steps -->
      <div class="flex flex-col overflow-y-auto" :style="{ width: '55%', minWidth: 0, background: 'var(--background)' }">
        <!-- Step nav -->
        <div class="flex items-center gap-1 px-8 pt-6 pb-4 shrink-0 flex-wrap">
          <template v-for="(s, idx) in steps" :key="s.n">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                :style="
                  wizard.step > s.n
                    ? { background: 'color-mix(in srgb, var(--chart-2) 20%, transparent)', color: 'var(--chart-2)' }
                    : wizard.step === s.n
                      ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
                      : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                "
              >
                <Check v-if="wizard.step > s.n" :size="14" />
                <template v-else>{{ s.n }}</template>
              </span>
              <span
                class="text-sm"
                :style="{
                  color: wizard.step === s.n ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: wizard.step === s.n ? 600 : 400,
                }"
              >
                {{ s.label }}
              </span>
            </div>
            <span v-if="idx < steps.length - 1" class="mx-2 text-xs" :style="{ color: 'var(--border)' }">--</span>
          </template>
        </div>

        <div class="px-8 pb-8 flex flex-col gap-6">
          <Step1Basic v-if="wizard.step === 1" />
          <Step2Provider v-else-if="wizard.step === 2" />
          <Step3Permission v-else-if="wizard.step === 3" />
          <Step4McpSkills v-else-if="wizard.step === 4" />
        </div>
      </div>

      <!-- Right: JSON preview -->
      <JsonPreview :config-json="wizard.configJson" @import="onImport" />
    </div>

    <!-- Bottom -->
    <footer
      class="flex items-center justify-between h-14 px-6 border-t shrink-0"
      :style="{ borderColor: 'var(--border)', background: 'var(--background)' }"
    >
      <Btn variant="secondary" rounded="full" :disabled="wizard.step === 1" @click="wizard.prev()">
        <ChevronLeft :size="16" /> 上一步
      </Btn>
      <div class="flex items-center gap-3">
        <Btn
          v-if="wizard.step === wizard.totalSteps"
          rounded="full"
          :disabled="deploying"
          @click="deploy"
        >
          {{ deploying ? '部署中...' : (isEditing ? '部署新版本' : '一键部署') }}
        </Btn>
        <Btn v-else rounded="full" @click="wizard.next()">
          下一步 <ChevronRight :size="16" />
        </Btn>
      </div>
    </footer>
  </main>
</template>
