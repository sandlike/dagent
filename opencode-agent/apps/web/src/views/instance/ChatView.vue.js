import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, Send, Loader2, Wrench } from 'lucide-vue-next';
import { A2UISurface, useMessageProcessor } from 'a2ui-vue';
import { listSessions, sendMessage, controlNext, controlResponse, } from '@/api/proxy';
import { request } from '@/api/client';
import { useToastStore } from '@/stores/toast';
import { ApiRequestError } from '@/api/client';
import PermissionPrompt from '@/components/PermissionPrompt.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const toast = useToastStore();
const instanceId = computed(() => String(route.params.id));
const a2uiProcessor = useMessageProcessor();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessions = ref([]);
const currentSessionId = ref('');
const input = ref('');
const sending = ref(false);
// 中文输入法组合状态（composing 时回车用于选词，不发送）
const isComposing = ref(false);
const messagesEl = ref(null);
const messages = ref([]);
// 当前正在等待回复的 assistant 占位消息 id
let currentAssistantId = null;
function genId() {
    return Math.random().toString(36).slice(2);
}
// 格式化工具调用的输入参数（单行摘要，避免太长）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatToolInput(tool, input) {
    if (!input || typeof input !== 'object')
        return '';
    try {
        if (tool === 'bash' || tool === 'shell') {
            return String(input.command ?? '').slice(0, 80);
        }
        if (tool === 'write' || tool === 'edit') {
            return String(input.filePath ?? input.path ?? '').slice(0, 80);
        }
        if (tool === 'read') {
            return String(input.filePath ?? input.path ?? '').slice(0, 80);
        }
        if (tool === 'grep' || tool === 'glob') {
            return String(input.pattern ?? '').slice(0, 80);
        }
        // 通用：取第一个字符串值
        const vals = Object.values(input).filter((v) => typeof v === 'string');
        return vals.length > 0 ? String(vals[0]).slice(0, 80) : JSON.stringify(input).slice(0, 80);
    }
    catch {
        return '';
    }
}
// ===== 会话列表 =====
async function loadSessions() {
    try {
        sessions.value = await listSessions(instanceId.value);
    }
    catch {
        // 静默
    }
}
// 切换会话：加载历史消息
async function selectSession(sid) {
    currentSessionId.value = sid;
    messages.value = [];
    currentAssistantId = null;
    permissionRequest.value = null;
    sending.value = false;
    await loadHistory(sid);
}
// 加载会话历史消息（从 sidecar /monitor/sessions/:sid/messages 拉）
async function loadHistory(sid) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history = await request(`/api/instances/${instanceId.value}/sessions/${sid}/messages`);
        for (const item of history) {
            const role = item.info?.role ?? item.role ?? 'assistant';
            const text = (item.parts ?? [])
                .filter((p) => p.type === 'text' || p.text)
                .map((p) => p.text || '')
                .join('');
            if (text) {
                messages.value.push({
                    id: genId(),
                    role: role === 'user' ? 'user' : 'assistant',
                    type: 'text',
                    text,
                    status: 'done',
                });
            }
        }
        await nextTick();
        scrollBottom();
    }
    catch {
        // 静默
    }
}
// 新会话：清空，不预创建（发第一条消息时 A2A 自动创建）
function newSession() {
    currentSessionId.value = '';
    messages.value = [];
    currentAssistantId = null;
    permissionRequest.value = null;
    sending.value = false;
}
// ===== 发送消息（同步模式）=====
// Enter 键处理：输入法 composing 中（中文选词）或 isComposing=true 时不发送
function onEnter(e) {
    // 浏览器原生 composing 标志（最可靠）
    if (e.isComposing)
        return;
    // 双保险：我们自己跟踪的 compositionend 有时比 keydown 晚一帧
    if (isComposing.value)
        return;
    // keyCode 229 = 输入法正在处理中（旧浏览器兼容）
    if (e.keyCode === 229)
        return;
    send();
}
// 同步：sendMessage 等待后端完整回复（sidecar 调 opencode /message 同步等）。
// 关键点：bash=ask 时同步请求会阻塞——这正是我们要的：
//   发送后立即启动 control-next 轮询 → 阻塞期间拿到 permission → 弹审批卡片 →
//   用户裁决 → opencode 继续 → 同步 HTTP 自动返回回复。
// 完全不依赖 SSE。
async function send() {
    const text = input.value.trim();
    if (!text || sending.value)
        return;
    input.value = '';
    messages.value.push({ id: genId(), role: 'user', type: 'text', text });
    // 预创建 assistant 占位消息
    const assistantMsg = {
        id: genId(),
        role: 'assistant',
        type: 'text',
        text: '',
        status: 'streaming',
    };
    messages.value.push(assistantMsg);
    currentAssistantId = assistantMsg.id;
    sending.value = true;
    await nextTick();
    scrollBottom();
    // ⚠️ 关键：先启动审批轮询，再发消息
    // 这样同步请求阻塞期间能立即拿到 permission 请求
    startControlLoop();
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await sendMessage(instanceId.value, currentSessionId.value, {
            parts: [{ type: 'text', text }],
        });
        // 更新会话 ID（A2A 层可能创建了新会话）
        if (res?.contextId && res.contextId !== currentSessionId.value) {
            currentSessionId.value = res.contextId;
            if (!sessions.value.find((s) => s.id === res.contextId)) {
                sessions.value.unshift({ id: res.contextId, title: text.slice(0, 40) });
            }
            loadSessions();
        }
        // 同步模式：从 artifacts 提取 parts（含 tool 调用过程 + 最终 text 回复）
        const parts = res?.artifacts?.[0]?.parts ?? [];
        // 兜底：从 history 提取 text（无 artifacts 时）
        if (parts.length === 0) {
            const historyReply = res?.history
                ?.filter((h) => h.role === 'agent')
                ?.map((h) => (h.parts ?? []).map((p) => p.text || '').join(''))
                .join('') ?? '';
            if (historyReply)
                parts.push({ type: 'text', text: historyReply });
        }
        // 按 part 类型拆分渲染：
        //   - tool：工具调用卡片（显示工具名 + 输入）
        //   - text：最终文本回复（填到 assistant 占位消息）
        const toolMessages = [];
        let finalReply = '';
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
                });
            }
            else if (p.type === 'text' && p.text) {
                finalReply = (finalReply + (finalReply ? '\n' : '') + p.text).trim();
            }
        }
        // 把 tool 调用卡片插到 assistant 占位消息「之前」（用户消息之后）
        if (toolMessages.length > 0 && currentAssistantId) {
            const idx = messages.value.findIndex((m) => m.id === currentAssistantId);
            if (idx >= 0) {
                messages.value.splice(idx, 0, ...toolMessages);
            }
            else {
                messages.value.push(...toolMessages);
            }
        }
        // 最终文本回复填到 assistant 占位消息
        const msg = messages.value.find((m) => m.id === currentAssistantId);
        if (msg) {
            if (finalReply) {
                msg.text = finalReply;
            }
            else if (msg.text === '' && toolMessages.length === 0) {
                msg.text = '（空回复）';
                msg.type = 'error';
            }
            else if (msg.text === '') {
                // 有 tool 调用但无文本回复，移除空占位
                const idx = messages.value.findIndex((m) => m.id === currentAssistantId);
                if (idx >= 0)
                    messages.value.splice(idx, 1);
            }
            if (msg.text)
                msg.status = 'done';
        }
    }
    catch (e) {
        const msg = messages.value.find((m) => m.id === currentAssistantId);
        if (msg) {
            msg.text = e instanceof ApiRequestError ? e.message : '请求失败';
            msg.type = 'error';
            msg.status = 'done';
        }
    }
    finally {
        // 同步请求完成（含审批后继续）→ 结束 sending
        currentAssistantId = null;
        sending.value = false;
        permissionRequest.value = null;
        await nextTick();
        scrollBottom();
    }
}
// ===== 权限审批（同步阻塞期间的 control-next 轮询）=====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const permissionRequest = ref(null);
let controlAborted = false;
function startControlLoop() {
    if (controlAborted || !sending.value)
        return;
    controlNext(instanceId.value, currentSessionId.value)
        .then((req) => {
        if (controlAborted || !sending.value)
            return;
        if (req && req.type !== 'noop' && req.permissionId) {
            // 收到 permission 请求，弹卡片（停止轮询直到用户响应）
            permissionRequest.value = req;
        }
        else {
            // 还在阻塞中，继续轮询
            setTimeout(() => startControlLoop(), 1000);
        }
    })
        .catch(() => {
        if (!controlAborted && sending.value) {
            setTimeout(() => startControlLoop(), 2000);
        }
    });
}
async function respondPermission(response, remember) {
    if (!permissionRequest.value)
        return;
    const { sessionId, permissionId } = permissionRequest.value;
    permissionRequest.value = null;
    try {
        await controlResponse(instanceId.value, { sessionId, permissionId, response, remember });
    }
    catch {
        // 忽略
    }
    // 裁决后继续轮询（agent 可能触发更多 permission）
    if (sending.value) {
        setTimeout(() => startControlLoop(), 500);
    }
}
function scrollBottom() {
    if (messagesEl.value)
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}
onMounted(() => {
    loadSessions();
});
onUnmounted(() => {
    controlAborted = true;
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_fnComponent = (await import('vue')).defineComponent({});
;
let __VLS_functionalComponentProps;
function __VLS_template() {
    const __VLS_ctx = {};
    const __VLS_localComponents = {
        ...{},
        ...{},
        ...__VLS_ctx,
    };
    let __VLS_components;
    const __VLS_localDirectives = {
        ...{},
        ...__VLS_ctx,
    };
    let __VLS_directives;
    let __VLS_styleScopedClasses;
    let __VLS_resolvedLocalAndGlobalComponents;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex h-full") }, ...{ style: (({ background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: (({ width: '240px', flex: 'none', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between px-3.5 py-3.5 shrink-0") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[13px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (__VLS_ctx.newSession) }, ...{ class: ("inline-flex items-center justify-center w-7 h-7 rounded-lg border cursor-pointer") }, ...{ style: (({ borderColor: 'var(--border)', color: 'var(--muted-foreground)' })) }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((14)), }));
    const __VLS_2 = __VLS_1({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-h-0 overflow-y-auto px-1.5 pb-3 flex flex-col gap-0.5") }, });
    for (const [s] of __VLS_getVForSourceType((__VLS_ctx.sessions))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.selectSession(s.id);
                } }, key: ((s.id)), ...{ class: ("rounded-lg px-2.5 py-2.5 text-left flex flex-col gap-1 cursor-pointer transition-colors") }, ...{ style: (({
                    background: __VLS_ctx.currentSessionId === s.id ? 'var(--sidebar-accent)' : 'transparent',
                    color: __VLS_ctx.currentSessionId === s.id ? 'var(--sidebar-accent-foreground)' : 'var(--foreground)',
                })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[13px] truncate") }, ...{ style: (({ fontWeight: __VLS_ctx.currentSessionId === s.id ? 500 : 400 })) }, });
        (s.title || '新会话');
    }
    if (__VLS_ctx.sessions.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs px-2.5 py-4 text-center") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-w-0 flex flex-col") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ref: ("messagesEl"), ...{ class: ("flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-3") }, });
    // @ts-ignore navigation for `const messagesEl = ref()`
    __VLS_ctx.messagesEl;
    if (__VLS_ctx.messages.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 flex items-center justify-center") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    for (const [m] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
        (m.id);
        if (m.role === 'user') {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("max-w-[80%] rounded-xl px-4 py-2.5 text-sm") }, ...{ style: (({ alignSelf: 'flex-end', background: 'var(--primary)', color: 'var(--primary-foreground)' })) }, });
            if (m.text.includes('\n')) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({ ...{ class: ("whitespace-pre-wrap font-sans") }, ...{ style: (({ margin: 0, fontFamily: 'inherit' })) }, });
                (m.text);
            }
            else {
                (m.text);
            }
        }
        else if (m.role === 'assistant' && (m.type === 'text' || m.type === 'error')) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("max-w-[80%] rounded-xl px-4 py-2.5 text-sm") }, ...{ style: (({
                        alignSelf: 'flex-start',
                        background: m.type === 'error' ? 'color-mix(in srgb, var(--destructive) 10%, var(--card))' : 'var(--muted)',
                        color: m.type === 'error' ? 'var(--destructive)' : 'var(--foreground)',
                    })) }, });
            if (m.text.includes('\n')) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({ ...{ class: ("whitespace-pre-wrap font-sans") }, ...{ style: (({ margin: 0, fontFamily: 'inherit' })) }, });
                (m.text);
            }
            else {
                (m.text);
            }
            if (m.status === 'streaming' && !m.text) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("inline-flex items-center gap-1") }, });
                const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
                /** @type { [typeof __VLS_components.Loader2, ] } */
                // @ts-ignore
                const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((12)), ...{ class: ("animate-spin") }, }));
                const __VLS_8 = __VLS_7({ size: ((12)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_7));
            }
        }
        else if (m.type === 'a2ui') {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("max-w-[90%] rounded-xl overflow-hidden") }, ...{ style: (({ alignSelf: 'flex-start', border: '1px solid var(--border)', background: 'var(--card)' })) }, });
            const __VLS_12 = __VLS_resolvedLocalAndGlobalComponents.A2UISurface;
            /** @type { [typeof __VLS_components.A2UISurface, ] } */
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({ surfaceId: ((m.surfaceId ?? null)), }));
            const __VLS_14 = __VLS_13({ surfaceId: ((m.surfaceId ?? null)), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        }
        else if (m.type === 'tool') {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("max-w-[80%] rounded-lg px-3 py-2 flex items-center gap-2 text-xs") }, ...{ style: (({
                        alignSelf: 'flex-start',
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted-foreground)',
                        fontFamily: 'var(--font-mono)',
                    })) }, });
            const __VLS_18 = __VLS_resolvedLocalAndGlobalComponents.Wrench;
            /** @type { [typeof __VLS_components.Wrench, ] } */
            // @ts-ignore
            const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({ size: ((13)), ...{ style: (({ color: 'var(--chart-3)' })) }, }));
            const __VLS_20 = __VLS_19({ size: ((13)), ...{ style: (({ color: 'var(--chart-3)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_19));
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
            (m.toolName);
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.formatToolInput(m.toolName, m.toolInput));
        }
    }
    if (__VLS_ctx.permissionRequest) {
        // @ts-ignore
        [PermissionPrompt,];
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(PermissionPrompt, new PermissionPrompt({ ...{ 'onRespond': {} }, request: ((__VLS_ctx.permissionRequest)), }));
        const __VLS_25 = __VLS_24({ ...{ 'onRespond': {} }, request: ((__VLS_ctx.permissionRequest)), }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        let __VLS_29;
        const __VLS_30 = {
            onRespond: ((response, remember) => __VLS_ctx.respondPermission(response, remember))
        };
        let __VLS_26;
        let __VLS_27;
        var __VLS_28;
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("shrink-0 p-4 border-t") }, ...{ style: (({ borderColor: 'var(--border)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-end gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.textarea)({ ...{ onCompositionstart: (...[$event]) => {
                __VLS_ctx.isComposing = true;
            } }, ...{ onCompositionend: (...[$event]) => {
                __VLS_ctx.isComposing = false;
            } }, ...{ onKeydown: (__VLS_ctx.onEnter) }, value: ((__VLS_ctx.input)), placeholder: ("输入消息... (Enter 发送，Shift+Enter 换行)"), rows: ("1"), ...{ class: ("flex-1 resize-none outline-none border rounded-xl px-3.5 py-2.5 text-sm") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (__VLS_ctx.send) }, ...{ class: ("inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 cursor-pointer disabled:opacity-50") }, ...{ style: (({ background: 'var(--primary)', color: 'var(--primary-foreground)' })) }, disabled: ((__VLS_ctx.sending || !__VLS_ctx.input.trim())), });
    const __VLS_31 = __VLS_resolvedLocalAndGlobalComponents.Send;
    /** @type { [typeof __VLS_components.Send, ] } */
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({ size: ((16)), }));
    const __VLS_33 = __VLS_32({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['h-full'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['px-3.5'];
    __VLS_styleScopedClasses['py-3.5'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-7'];
    __VLS_styleScopedClasses['h-7'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-h-0'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['px-1.5'];
    __VLS_styleScopedClasses['pb-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-0.5'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['px-2.5'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['px-2.5'];
    __VLS_styleScopedClasses['py-4'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-h-0'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['px-6'];
    __VLS_styleScopedClasses['py-5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['max-w-[80%]'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['whitespace-pre-wrap'];
    __VLS_styleScopedClasses['font-sans'];
    __VLS_styleScopedClasses['max-w-[80%]'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['whitespace-pre-wrap'];
    __VLS_styleScopedClasses['font-sans'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['max-w-[90%]'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['max-w-[80%]'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['py-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['border-t'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-end'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['resize-none'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['px-3.5'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-9'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['disabled:opacity-50'];
    var __VLS_slots;
    var __VLS_inheritedAttrs;
    const __VLS_refs = {
        "messagesEl": __VLS_nativeElements['div'],
    };
    var $refs;
    var $el;
    return {
        attrs: {},
        slots: __VLS_slots,
        refs: $refs,
        rootEl: $el,
    };
}
;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Plus: Plus,
            Send: Send,
            Loader2: Loader2,
            Wrench: Wrench,
            A2UISurface: A2UISurface,
            PermissionPrompt: PermissionPrompt,
            sessions: sessions,
            currentSessionId: currentSessionId,
            input: input,
            sending: sending,
            isComposing: isComposing,
            messagesEl: messagesEl,
            messages: messages,
            formatToolInput: formatToolInput,
            selectSession: selectSession,
            newSession: newSession,
            onEnter: onEnter,
            send: send,
            permissionRequest: permissionRequest,
            respondPermission: respondPermission,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
