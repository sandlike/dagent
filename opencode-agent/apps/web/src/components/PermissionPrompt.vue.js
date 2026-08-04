import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { Check, X, Shield } from 'lucide-vue-next';
import Btn from '@/components/ui/Btn.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
// A2UISurface 异步加载（失败时不影响整个组件树，触发降级）
const A2UISurface = defineAsyncComponent(() => import('a2ui-vue').then((m) => m.A2UISurface));
const props = defineProps();
const emit = defineEmits();
// === A2UI 渲染状态 ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor = null;
let unsub = null;
const a2uiReady = ref(false);
const a2uiSurfaceId = ref(null);
// 降级标志：A2UI 不可用时用原生卡片
const useFallback = ref(false);
// === 原生降级卡片状态 ===
const remember = ref(false);
// 懒加载 a2ui-vue + 构造消息（避免顶层 import 失败影响整个 ChatView）
async function setupA2UI() {
    try {
        const [{ useMessageProcessor }, { buildPermissionA2UIMessages, buildDeleteSurfaceMessage }] = await Promise.all([import('a2ui-vue'), import('@/lib/a2ui-permission')]);
        processor = useMessageProcessor();
        // 注册按钮点击监听（DispatchedEvent → respond）
        unsub = processor.onEvent((event) => {
            // v0.9: event.message.action.{name, context}
            const action = event?.message?.action ?? event?.action ?? event;
            const name = action?.name ?? action?.event?.name;
            if (name !== 'allow' && name !== 'deny')
                return;
            // 用户点了按钮 → 清掉 surface + emit respond
            if (a2uiSurfaceId.value) {
                try {
                    processor.processMessages([buildDeleteSurfaceMessage(a2uiSurfaceId.value)]);
                }
                catch { }
                a2uiSurfaceId.value = null;
            }
            emit('respond', name, false);
        });
        a2uiReady.value = true;
    }
    catch (e) {
        console.warn('[PermissionPrompt] A2UI 初始化失败，降级到原生卡片', e);
        useFallback.value = true;
    }
}
// 把 permission 渲染成 A2UI 卡片
async function renderA2UI(req) {
    if (!req || !req.permissionId)
        return;
    if (!processor)
        await setupA2UI();
    if (!processor || useFallback.value)
        return; // 降级模式，让模板走原生卡片
    try {
        const { buildPermissionA2UIMessages, buildDeleteSurfaceMessage } = await import('@/lib/a2ui-permission');
        // 清掉旧 surface
        if (a2uiSurfaceId.value) {
            try {
                processor.processMessages([buildDeleteSurfaceMessage(a2uiSurfaceId.value)]);
            }
            catch { }
        }
        const built = buildPermissionA2UIMessages({
            permissionId: req.permissionId,
            sessionId: req.sessionId,
            tool: req.tool ?? 'unknown',
            input: req.input,
            description: req.description,
        });
        a2uiSurfaceId.value = built.surfaceId;
        processor.processMessages(built.messages);
    }
    catch (e) {
        console.warn('[PermissionPrompt] A2UI 渲染失败，降级到原生卡片', e);
        useFallback.value = true;
        a2uiSurfaceId.value = null;
    }
}
// 监听 request 变化（每次新 permission 重新渲染）
watch(() => props.request, (req) => {
    if (req)
        renderA2UI(req);
}, { immediate: true });
onMounted(() => {
    setupA2UI();
});
onUnmounted(() => {
    if (unsub)
        try {
            unsub();
        }
        catch { }
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_fnComponent = (await import('vue')).defineComponent({
    __typeEmits: {},
});
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
    if (props.request) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("max-w-[80%] rounded-xl p-4 flex flex-col gap-3") }, ...{ style: (({
                    alignSelf: 'flex-start',
                    background: 'var(--accent)',
                    border: '1px solid var(--ring)',
                })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 shrink-0") }, });
        const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.Shield;
        /** @type { [typeof __VLS_components.Shield, ] } */
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((16)), ...{ style: (({ color: 'var(--sidebar-accent-foreground)' })) }, }));
        const __VLS_2 = __VLS_1({ size: ((16)), ...{ style: (({ color: 'var(--sidebar-accent-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--sidebar-accent-foreground)' })) }, });
        if (__VLS_ctx.a2uiReady && __VLS_ctx.a2uiSurfaceId && !__VLS_ctx.useFallback) {
            const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.A2UISurface;
            /** @type { [typeof __VLS_components.A2UISurface, ] } */
            // @ts-ignore
            const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ surfaceId: ((__VLS_ctx.a2uiSurfaceId)), }));
            const __VLS_8 = __VLS_7({ surfaceId: ((__VLS_ctx.a2uiSurfaceId)), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        }
        else {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("text-xs flex flex-col gap-1") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
            if (props.request.tool) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-2") }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, ...{ style: (({ fontFamily: 'var(--font-mono)' })) }, });
                (props.request.tool);
            }
            if (props.request.input) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-2") }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono break-all") }, ...{ style: (({ fontFamily: 'var(--font-mono)', maxWidth: '400px' })) }, });
                (typeof props.request.input === 'string' ? props.request.input : JSON.stringify(props.request.input, null, 2));
            }
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 justify-end") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("flex items-center gap-1 text-[11px] cursor-pointer mr-auto") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ type: ("checkbox"), });
            (__VLS_ctx.remember);
            // @ts-ignore
            [Btn, Btn,];
            // @ts-ignore
            const __VLS_12 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), rounded: ("full"), }));
            const __VLS_13 = __VLS_12({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
            let __VLS_17;
            const __VLS_18 = {
                onClick: (...[$event]) => {
                    if (!((props.request)))
                        return;
                    if (!(!((__VLS_ctx.a2uiReady && __VLS_ctx.a2uiSurfaceId && !__VLS_ctx.useFallback))))
                        return;
                    __VLS_ctx.emit('respond', 'deny', false);
                }
            };
            let __VLS_14;
            let __VLS_15;
            const __VLS_19 = __VLS_resolvedLocalAndGlobalComponents.X;
            /** @type { [typeof __VLS_components.X, ] } */
            // @ts-ignore
            const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({ size: ((14)), }));
            const __VLS_21 = __VLS_20({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_20));
            __VLS_nonNullable(__VLS_16.slots).default;
            var __VLS_16;
            // @ts-ignore
            [Btn, Btn,];
            // @ts-ignore
            const __VLS_25 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), rounded: ("full"), }));
            const __VLS_26 = __VLS_25({ ...{ 'onClick': {} }, size: ("sm"), rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_25));
            let __VLS_30;
            const __VLS_31 = {
                onClick: (...[$event]) => {
                    if (!((props.request)))
                        return;
                    if (!(!((__VLS_ctx.a2uiReady && __VLS_ctx.a2uiSurfaceId && !__VLS_ctx.useFallback))))
                        return;
                    __VLS_ctx.emit('respond', 'allow', __VLS_ctx.remember);
                }
            };
            let __VLS_27;
            let __VLS_28;
            const __VLS_32 = __VLS_resolvedLocalAndGlobalComponents.Check;
            /** @type { [typeof __VLS_components.Check, ] } */
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({ size: ((14)), }));
            const __VLS_34 = __VLS_33({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_33));
            __VLS_nonNullable(__VLS_29.slots).default;
            var __VLS_29;
        }
    }
    __VLS_styleScopedClasses['max-w-[80%]'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['break-all'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['justify-end'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['mr-auto'];
    var __VLS_slots;
    var __VLS_inheritedAttrs;
    const __VLS_refs = {};
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
            Check: Check,
            X: X,
            Shield: Shield,
            Btn: Btn,
            A2UISurface: A2UISurface,
            emit: emit,
            a2uiReady: a2uiReady,
            a2uiSurfaceId: a2uiSurfaceId,
            useFallback: useFallback,
            remember: remember,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
