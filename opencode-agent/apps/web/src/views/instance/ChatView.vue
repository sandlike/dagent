<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Send, Loader2, Wrench } from 'lucide-vue-next'
import { A2UISurface, useMessageProcessor } from 'a2ui-vue'
import {
  listSessions, sendMessage, controlNext, controlResponse,
} from '@/api/proxy'
import { request } from '@/api/client'
import { useToastStore } from '@/stores/toast'
import { ApiRequestError } from '@/api/client'
import PermissionPrompt from '@/components/PermissionPrompt.vue'

const route = useRoute()
const toast = useToastStore()
const instanceId = computed(() => String(route.params.id))
const a2uiProcessor = useMessageProcessor()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessions = ref<any[]>([])
const currentSessionId = ref<string>('')
const input = ref('')
const sending = ref(false)
// 中文输入法组合状态（composing 时回车用于选词，不发送）
const isComposing = ref(false)
const messagesEl = ref<HTMLElement | null>(null)

// ===== 消息模型 =====
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  type: 'text' | 'a2ui' | 'error' | 'tool'
  text: string
  status?: 'streaming' | 'done'
  surfaceId?: string
  // tool 调用详情（type='tool' 时）
  toolName?: string
  toolStatus?: string
  toolInput?: unknown
}
const messages = ref<ChatMessage[]>([])

// 当前正在等待回复的 assistant 占位消息 id
let currentAssistantId: string | null = null

function genId(): string {
  return Math.random().toString(36).slice(2)
}

// 格式化工具调用的输入参数（单行摘要，避免太长）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatToolInput(tool: string | undefined, input: any): string {
  if (!input || typeof input !== 'object') return ''
  try {
    if (tool === 'bash' || tool === 'shell') {
      return String(input.command ?? '').slice(0, 80)
    }
    if (tool === 'write' || tool === 'edit') {
      return String(input.filePath ?? input.path ?? '').slice(0, 80)
    }
    if (tool === 'read') {
      return String(input.filePath ?? input.path ?? '').slice(0, 80)
    }
    if (tool === 'grep' || tool === 'glob') {
      return String(input.pattern ?? '').slice(0, 80)
    }
    // 通用：取第一个字符串值
    const vals = Object.values(input).filter((v) => typeof v === 'string')
    return vals.length > 0 ? String(vals[0]).slice(0, 80) : JSON.stringify(input).slice(0, 80)
  } catch {
    return ''
  }
}

// ===== 会话列表 =====
async function loadSessions() {
  try {
    sessions.value = await listSessions(instanceId.value)
  } catch {
    // 静默
  }
}

// 切换会话：加载历史消息
async function selectSession(sid: string) {
  currentSessionId.value = sid
  messages.value = []
  currentAssistantId = null
  permissionRequest.value = null
  sending.value = false
  await loadHistory(sid)
}

// 加载会话历史消息（从 sidecar /monitor/sessions/:sid/messages 拉）
async function loadHistory(sid: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history: any[] = await request(`/api/instances/${instanceId.value}/sessions/${sid}/messages`) as any[]
    for (const item of history) {
      const role = item.info?.role ?? item.role ?? 'assistant'
      const text = (item.parts ?? [])
        .filter((p: any) => p.type === 'text' || p.text)
        .map((p: any) => p.text || '')
        .join('')
      if (text) {
        messages.value.push({
          id: genId(),
          role: role === 'user' ? 'user' : 'assistant',
          type: 'text',
          text,
          status: 'done',
        })
      }
    }
    await nextTick()
    scrollBottom()
  } catch {
    // 静默
  }
}

// 新会话：清空，不预创建（发第一条消息时 A2A 自动创建）
function newSession() {
  currentSessionId.value = ''
  messages.value = []
  currentAssistantId = null
  permissionRequest.value = null
  sending.value = false
}

// ===== 发送消息（同步模式）=====
// Enter 键处理：输入法 composing 中（中文选词）或 isComposing=true 时不发送
function onEnter(e: KeyboardEvent) {
  // 浏览器原生 composing 标志（最可靠）
  if (e.isComposing) return
  // 双保险：我们自己跟踪的 compositionend 有时比 keydown 晚一帧
  if (isComposing.value) return
  // keyCode 229 = 输入法正在处理中（旧浏览器兼容）
  if (e.keyCode === 229) return
  send()
}

// 同步：sendMessage 等待后端完整回复（sidecar 调 opencode /message 同步等）。
// 关键点：bash=ask 时同步请求会阻塞——这正是我们要的：
//   发送后立即启动 control-next 轮询 → 阻塞期间拿到 permission → 弹审批卡片 →
//   用户裁决 → opencode 继续 → 同步 HTTP 自动返回回复。
// 完全不依赖 SSE。
async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return

  input.value = ''
  messages.value.push({ id: genId(), role: 'user', type: 'text', text })
  // 预创建 assistant 占位消息
  const assistantMsg: ChatMessage = {
    id: genId(),
    role: 'assistant',
    type: 'text',
    text: '',
    status: 'streaming',
  }
  messages.value.push(assistantMsg)
  currentAssistantId = assistantMsg.id
  sending.value = true
  await nextTick()
  scrollBottom()

  // ⚠️ 关键：先启动审批轮询，再发消息
  // 这样同步请求阻塞期间能立即拿到 permission 请求
  startControlLoop()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await sendMessage(instanceId.value, currentSessionId.value, {
      parts: [{ type: 'text', text }],
    })

    // 更新会话 ID（A2A 层可能创建了新会话）
    if (res?.contextId && res.contextId !== currentSessionId.value) {
      currentSessionId.value = res.contextId
      if (!sessions.value.find((s: any) => s.id === res.contextId)) {
        sessions.value.unshift({ id: res.contextId, title: text.slice(0, 40) })
      }
      loadSessions()
    }

    // 同步模式：从 artifacts 提取 parts（含 tool 调用过程 + 最终 text 回复）
    const parts: any[] = res?.artifacts?.[0]?.parts ?? []
    // 兜底：从 history 提取 text（无 artifacts 时）
    if (parts.length === 0) {
      const historyReply = res?.history
        ?.filter((h: any) => h.role === 'agent')
        ?.map((h: any) => (h.parts ?? []).map((p: any) => p.text || '').join(''))
        .join('') ?? ''
      if (historyReply) parts.push({ type: 'text', text: historyReply })
    }

    // 按 part 类型拆分渲染：
    //   - tool：工具调用卡片（显示工具名 + 输入）
    //   - text：最终文本回复（填到 assistant 占位消息）
    const toolMessages: ChatMessage[] = []
    let finalReply = ''
    for (const p of parts) {
      if (p.type === 'tool' && p.tool) {
        toolMessages.push({
          id: genId(),
          role: 'tool',
          type: 'tool',
          text: '',
          status: 'done',
          toolName: p.tool,
          toolStatus: p.status,
          toolInput: p.input,
        })
      } else if (p.type === 'text' && p.text) {
        finalReply = (finalReply + (finalReply ? '\n' : '') + p.text).trim()
      }
    }

    // 把 tool 调用卡片插到 assistant 占位消息「之前」（用户消息之后）
    if (toolMessages.length > 0 && currentAssistantId) {
      const idx = messages.value.findIndex((m) => m.id === currentAssistantId)
      if (idx >= 0) {
        messages.value.splice(idx, 0, ...toolMessages)
      } else {
        messages.value.push(...toolMessages)
      }
    }

    // 最终文本回复填到 assistant 占位消息
    const msg = messages.value.find((m) => m.id === currentAssistantId)
    if (msg) {
      if (finalReply) {
        msg.text = finalReply
      } else if (msg.text === '' && toolMessages.length === 0) {
        msg.text = '（空回复）'
        msg.type = 'error'
      } else if (msg.text === '') {
        // 有 tool 调用但无文本回复，移除空占位
        const idx = messages.value.findIndex((m) => m.id === currentAssistantId)
        if (idx >= 0) messages.value.splice(idx, 1)
      }
      if (msg.text) msg.status = 'done'
    }
  } catch (e) {
    const msg = messages.value.find((m) => m.id === currentAssistantId)
    if (msg) {
      msg.text = e instanceof ApiRequestError ? e.message : '请求失败'
      msg.type = 'error'
      msg.status = 'done'
    }
  } finally {
    // 同步请求完成（含审批后继续）→ 结束 sending
    currentAssistantId = null
    sending.value = false
    permissionRequest.value = null
    await nextTick()
    scrollBottom()
  }
}

// ===== 权限审批（同步阻塞期间的 control-next 轮询）=====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const permissionRequest = ref<any>(null)
let controlAborted = false

function startControlLoop() {
  if (controlAborted || !sending.value) return
  controlNext(instanceId.value, currentSessionId.value)
    .then((req) => {
      if (controlAborted || !sending.value) return
      if (req && req.type !== 'noop' && req.permissionId) {
        // 收到 permission 请求，弹卡片（停止轮询直到用户响应）
        permissionRequest.value = req
      } else {
        // 还在阻塞中，继续轮询
        setTimeout(() => startControlLoop(), 1000)
      }
    })
    .catch(() => {
      if (!controlAborted && sending.value) {
        setTimeout(() => startControlLoop(), 2000)
      }
    })
}

async function respondPermission(response: 'allow' | 'deny', remember: boolean) {
  if (!permissionRequest.value) return
  const { sessionId, permissionId } = permissionRequest.value
  permissionRequest.value = null
  try {
    await controlResponse(instanceId.value, { sessionId, permissionId, response, remember })
  } catch {
    // 忽略
  }
  // 裁决后继续轮询（agent 可能触发更多 permission）
  if (sending.value) {
    setTimeout(() => startControlLoop(), 500)
  }
}

function scrollBottom() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

onMounted(() => {
  loadSessions()
})

onUnmounted(() => {
  controlAborted = true
})
</script>

<template>
  <div class="flex h-full" :style="{ background: 'var(--background)' }">
    <!-- 会话列表 -->
    <div
      :style="{ width: '240px', flex: 'none', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--background)' }"
    >
      <div class="flex items-center justify-between px-3.5 py-3.5 shrink-0">
        <span class="text-[13px] font-semibold" :style="{ color: 'var(--foreground)' }">会话列表</span>
        <button
          class="inline-flex items-center justify-center w-7 h-7 rounded-lg border cursor-pointer"
          :style="{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }"
          @click="newSession"
        >
          <Plus :size="14" />
        </button>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto px-1.5 pb-3 flex flex-col gap-0.5">
        <button
          v-for="s in sessions"
          :key="s.id"
          class="rounded-lg px-2.5 py-2.5 text-left flex flex-col gap-1 cursor-pointer transition-colors"
          :style="{
            background: currentSessionId === s.id ? 'var(--sidebar-accent)' : 'transparent',
            color: currentSessionId === s.id ? 'var(--sidebar-accent-foreground)' : 'var(--foreground)',
          }"
          @click="selectSession(s.id)"
        >
          <span class="text-[13px] truncate" :style="{ fontWeight: currentSessionId === s.id ? 500 : 400 }">{{ s.title || '新会话' }}</span>
        </button>
        <p v-if="sessions.length === 0" class="text-xs px-2.5 py-4 text-center" :style="{ color: 'var(--muted-foreground)' }">暂无会话</p>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div ref="messagesEl" class="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-3">
        <div v-if="messages.length === 0" class="flex-1 flex items-center justify-center">
          <p class="text-sm" :style="{ color: 'var(--muted-foreground)' }">发送一条消息开始对话</p>
        </div>

        <template v-for="m in messages" :key="m.id">
          <!-- 用户消息 -->
          <div
            v-if="m.role === 'user'"
            class="max-w-[80%] rounded-xl px-4 py-2.5 text-sm"
            :style="{ alignSelf: 'flex-end', background: 'var(--primary)', color: 'var(--primary-foreground)' }"
          >
            <pre v-if="m.text.includes('\n')" class="whitespace-pre-wrap font-sans" :style="{ margin: 0, fontFamily: 'inherit' }">{{ m.text }}</pre>
            <template v-else>{{ m.text }}</template>
          </div>

          <!-- Assistant 文本消息 -->
          <div
            v-else-if="m.role === 'assistant' && (m.type === 'text' || m.type === 'error')"
            class="max-w-[80%] rounded-xl px-4 py-2.5 text-sm"
            :style="{
              alignSelf: 'flex-start',
              background: m.type === 'error' ? 'color-mix(in srgb, var(--destructive) 10%, var(--card))' : 'var(--muted)',
              color: m.type === 'error' ? 'var(--destructive)' : 'var(--foreground)',
            }"
          >
            <pre v-if="m.text.includes('\n')" class="whitespace-pre-wrap font-sans" :style="{ margin: 0, fontFamily: 'inherit' }">{{ m.text }}</pre>
            <template v-else>{{ m.text }}</template>
            <span v-if="m.status === 'streaming' && !m.text" class="inline-flex items-center gap-1">
              <Loader2 :size="12" class="animate-spin" />
            </span>
          </div>

          <!-- A2UI 结构化 UI -->
          <div
            v-else-if="m.type === 'a2ui'"
            class="max-w-[90%] rounded-xl overflow-hidden"
            :style="{ alignSelf: 'flex-start', border: '1px solid var(--border)', background: 'var(--card)' }"
          >
            <A2UISurface :surface-id="m.surfaceId ?? null" />
          </div>

          <!-- 工具调用卡片（bash/write/edit 等中间过程）-->
          <div
            v-else-if="m.type === 'tool'"
            class="max-w-[80%] rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
            :style="{
              alignSelf: 'flex-start',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
              fontFamily: 'var(--font-mono)',
            }"
          >
            <Wrench :size="13" :style="{ color: 'var(--chart-3)' }" />
            <span class="font-semibold" :style="{ color: 'var(--foreground)' }">{{ m.toolName }}</span>
            <span :style="{ color: 'var(--muted-foreground)' }">·</span>
            <span>{{ formatToolInput(m.toolName, m.toolInput) }}</span>
          </div>
        </template>

        <!-- 权限确认 -->
        <PermissionPrompt
          v-if="permissionRequest"
          :request="permissionRequest"
          @respond="(response: 'allow' | 'deny', remember: boolean) => respondPermission(response, remember)"
        />
      </div>

      <!-- 输入框 -->
      <div class="shrink-0 p-4 border-t" :style="{ borderColor: 'var(--border)' }">
        <div class="flex items-end gap-2">
          <textarea
            v-model="input"
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            rows="1"
            class="flex-1 resize-none outline-none border rounded-xl px-3.5 py-2.5 text-sm"
            :style="{ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' }"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            @keydown.enter.exact.prevent="onEnter"
          />
          <button
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
            :style="{ background: 'var(--primary)', color: 'var(--primary-foreground)' }"
            :disabled="sending || !input.trim()"
            @click="send"
          >
            <Send :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
