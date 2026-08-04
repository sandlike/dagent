<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { Check, X, Shield } from 'lucide-vue-next'
import Btn from '@/components/ui/Btn.vue'

// A2UISurface 异步加载（失败时不影响整个组件树，触发降级）
const A2UISurface = defineAsyncComponent(() =>
  import('a2ui-vue').then((m) => m.A2UISurface),
)

// 审批卡片 —— 用 a2ui-vue 渲染（A2UI 是平台的统一 UI 渲染层）
//
// 数据源：props.request（来自 sidecar permission-watcher 的 control-next 轮询）
// 渲染：把 permission 转成 A2UI v0.9 消息 → MessageProcessor.processMessages → A2UISurface
// 交互：Button 的 action.event.name 通过 processor.onEvent 派发 → 转 respond
//
// 降级策略：若 A2UI 初始化/渲染抛异常（schema 偏差等），回退到原生卡片，
// 绝不让对话崩溃。降级时会在控制台告警，便于发现 schema 问题。
//
// DispatchedEvent 结构（v0.9）：{ message: { action: { name, context, ... } }, resolve }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<{ request: any }>()
const emit = defineEmits<{
  respond: [response: 'allow' | 'deny', remember: boolean]
}>()

// === A2UI 渲染状态 ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null
let unsub: (() => void) | null = null
const a2uiReady = ref(false)
const a2uiSurfaceId = ref<string | null>(null)
// 降级标志：A2UI 不可用时用原生卡片
const useFallback = ref(false)

// === 原生降级卡片状态 ===
const remember = ref(false)

// 懒加载 a2ui-vue + 构造消息（避免顶层 import 失败影响整个 ChatView）
async function setupA2UI() {
  try {
    const [{ useMessageProcessor }, { buildPermissionA2UIMessages, buildDeleteSurfaceMessage }] =
      await Promise.all([import('a2ui-vue'), import('@/lib/a2ui-permission')])
    processor = useMessageProcessor()

    // 注册按钮点击监听（DispatchedEvent → respond）
    unsub = processor.onEvent((event: any) => {
      // v0.9: event.message.action.{name, context}
      const action = event?.message?.action ?? event?.action ?? event
      const name = action?.name ?? action?.event?.name
      if (name !== 'allow' && name !== 'deny') return
      // 用户点了按钮 → 清掉 surface + emit respond
      if (a2uiSurfaceId.value) {
        try {
          processor.processMessages([buildDeleteSurfaceMessage(a2uiSurfaceId.value)])
        } catch {}
        a2uiSurfaceId.value = null
      }
      emit('respond', name, false)
    })

    a2uiReady.value = true
  } catch (e) {
    console.warn('[PermissionPrompt] A2UI 初始化失败，降级到原生卡片', e)
    useFallback.value = true
  }
}

// 把 permission 渲染成 A2UI 卡片
async function renderA2UI(req: any) {
  if (!req || !req.permissionId) return
  if (!processor) await setupA2UI()
  if (!processor || useFallback.value) return // 降级模式，让模板走原生卡片

  try {
    const { buildPermissionA2UIMessages, buildDeleteSurfaceMessage } = await import('@/lib/a2ui-permission')
    // 清掉旧 surface
    if (a2uiSurfaceId.value) {
      try { processor.processMessages([buildDeleteSurfaceMessage(a2uiSurfaceId.value)]) } catch {}
    }
    const built = buildPermissionA2UIMessages({
      permissionId: req.permissionId,
      sessionId: req.sessionId,
      tool: req.tool ?? 'unknown',
      input: req.input,
      description: req.description,
    })
    a2uiSurfaceId.value = built.surfaceId
    processor.processMessages(built.messages)
  } catch (e) {
    console.warn('[PermissionPrompt] A2UI 渲染失败，降级到原生卡片', e)
    useFallback.value = true
    a2uiSurfaceId.value = null
  }
}

// 监听 request 变化（每次新 permission 重新渲染）
watch(
  () => props.request,
  (req) => {
    if (req) renderA2UI(req)
  },
  { immediate: true },
)

onMounted(() => {
  setupA2UI()
})

onUnmounted(() => {
  if (unsub) try { unsub() } catch {}
})
</script>

<template>
  <div
    v-if="props.request"
    class="max-w-[80%] rounded-xl p-4 flex flex-col gap-3"
    :style="{
      alignSelf: 'flex-start',
      background: 'var(--accent)',
      border: '1px solid var(--ring)',
    }"
  >
    <!-- 标题（原生，保证一致风格）-->
    <div class="flex items-center gap-2 shrink-0">
      <Shield :size="16" :style="{ color: 'var(--sidebar-accent-foreground)' }" />
      <span class="text-sm font-semibold" :style="{ color: 'var(--sidebar-accent-foreground)' }">
        权限确认
      </span>
    </div>

    <!-- A2UI 渲染的卡片（含工具名/命令/允许/拒绝按钮）-->
    <A2UISurface
      v-if="a2uiReady && a2uiSurfaceId && !useFallback"
      :surface-id="a2uiSurfaceId"
    />

    <!-- 降级：原生卡片（A2UI 不可用时）-->
    <template v-else>
      <div class="text-xs flex flex-col gap-1" :style="{ color: 'var(--foreground)' }">
        <div v-if="props.request.tool" class="flex gap-2">
          <span :style="{ color: 'var(--muted-foreground)' }">工具：</span>
          <span class="font-mono" :style="{ fontFamily: 'var(--font-mono)' }">{{ props.request.tool }}</span>
        </div>
        <div v-if="props.request.input" class="flex gap-2">
          <span :style="{ color: 'var(--muted-foreground)' }">操作：</span>
          <span class="font-mono break-all" :style="{ fontFamily: 'var(--font-mono)', maxWidth: '400px' }">
            {{ typeof props.request.input === 'string' ? props.request.input : JSON.stringify(props.request.input, null, 2) }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 justify-end">
        <label class="flex items-center gap-1 text-[11px] cursor-pointer mr-auto" :style="{ color: 'var(--muted-foreground)' }">
          <input v-model="remember" type="checkbox" /> 记住选择
        </label>
        <Btn size="sm" variant="secondary" rounded="full" @click="emit('respond', 'deny', false)">
          <X :size="14" /> 拒绝
        </Btn>
        <Btn size="sm" rounded="full" @click="emit('respond', 'allow', remember)">
          <Check :size="14" /> 允许
        </Btn>
      </div>
    </template>
  </div>
</template>
