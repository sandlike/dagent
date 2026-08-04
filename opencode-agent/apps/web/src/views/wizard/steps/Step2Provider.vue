<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWizardStore } from '@/stores/wizard'
import { listProviders } from '@/api/proxy'
import { Plus, Shield, AlertCircle } from 'lucide-vue-next'
import Field from '@/components/ui/Field.vue'
import Btn from '@/components/ui/Btn.vue'

const wizard = useWizardStore()
const router = useRouter()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers = ref<any[]>([])
const selectedProviderId = ref<number | null>(null)

async function loadProviders() {
  try {
    providers.value = await listProviders()
    // 默认选第一个
    if (providers.value.length > 0 && !selectedProviderId.value) {
      selectedProviderId.value = providers.value[0].id
    }
  } catch {
    // 静默
  }
}

const selectedProvider = computed(() =>
  providers.value.find((p) => p.id === selectedProviderId.value),
)

const availableModels = computed(() => selectedProvider.value?.models ?? [])

// 选 provider 时，更新 wizard form 的 model
watch(selectedProviderId, (id) => {
  if (!id) return
  wizard.form.providerId = id
  const p = providers.value.find((x) => x.id === id)
  if (p) {
    // 更新 provider 信息（生成 configJson 用）
    wizard.form.provider.template = p.template
    wizard.form.provider.baseUrl = p.baseUrl
    wizard.form.provider.apiKey = '' // 不需要填，走 Higress
    // 默认选第一个模型
    if (p.models?.length > 0) {
      wizard.form.model = `${p.template}/${p.models[0]}`
      wizard.form.smallModel = `${p.template}/${p.models[0]}`
    }
  }
})

onMounted(() => {
  loadProviders()
})
</script>

<template>
  <!-- 已配 Provider 列表 -->
  <div v-if="providers.length > 0" class="flex flex-col gap-3">
    <Field label="选择 LLM Provider">
      <select
        :value="selectedProviderId"
        @change="(e) => selectedProviderId = Number((e.target as HTMLSelectElement).value)"
        class="w-full appearance-none px-3 border outline-none cursor-pointer"
        :style="{ height: '36px', borderRadius: '10px', background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontSize: '13px' }"
      >
        <option v-for="p in providers" :key="p.id" :value="p.id">
          {{ p.name }} ({{ p.template }})
        </option>
      </select>
    </Field>

    <!-- 选中 provider 的信息 -->
    <div
      v-if="selectedProvider"
      class="rounded-xl p-4 flex flex-col gap-2"
      :style="{ background: 'var(--card)', border: '1px solid var(--border)' }"
    >
      <div class="flex items-center gap-2">
        <Shield :size="14" :style="{ color: 'var(--status-running)' }" />
        <span class="text-xs" :style="{ color: 'var(--muted-foreground)' }">
          通过 Higress 网关代理，真实 API Key 不进入 Agent Pod
        </span>
      </div>
      <div class="text-xs font-mono" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">
        {{ selectedProvider.baseUrl }}
      </div>
    </div>

    <!-- 模型选择 -->
    <Field v-if="availableModels.length > 0" label="主模型">
      <Select v-model="wizard.form.model" mono>
        <option v-for="m in availableModels" :key="m" :value="`${selectedProvider?.template}/${m}`">
          {{ m }}
        </option>
      </Select>
    </Field>

    <Field v-if="availableModels.length > 0" label="小模型（标题生成等轻量任务）">
      <Select v-model="wizard.form.smallModel" mono>
        <option v-for="m in availableModels" :key="m" :value="`${selectedProvider?.template}/${m}`">
          {{ m }}
        </option>
      </Select>
    </Field>
  </div>

  <!-- 空状态：引导去配 Provider -->
  <div v-else class="flex flex-col items-center justify-center gap-3 py-8">
    <AlertCircle :size="32" :style="{ color: 'var(--muted-foreground)' }" />
    <p class="text-sm" :style="{ color: 'var(--foreground)' }">
      还没有配置 LLM Provider
    </p>
    <p class="text-xs text-center" :style="{ color: 'var(--muted-foreground)' }">
      请先在 LLM 管理页面配置 API Key，<br />创建实例时无需填写，统一走 Higress 网关代理
    </p>
    <Btn size="sm" @click="router.push('/providers')">
      <Plus :size="14" /> 去配置 LLM
    </Btn>
  </div>
</template>
