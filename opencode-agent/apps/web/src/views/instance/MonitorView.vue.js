import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { RefreshCw } from 'lucide-vue-next';
import { getHealth, listSessions, getMcp, getAgent } from '@/api/proxy';
import Btn from '@/components/ui/Btn.vue';
import Badge from '@/components/ui/Badge.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const instanceId = String(route.params.id);
const health = ref(null);
const sessions = ref([]);
const mcp = ref({});
const agents = ref([]);
const loading = ref(false);
async function refresh() {
    loading.value = true;
    try {
        const [h, s, m, a] = await Promise.allSettled([
            getHealth(instanceId),
            listSessions(instanceId),
            getMcp(instanceId),
            getAgent(instanceId),
        ]);
        if (h.status === 'fulfilled')
            health.value = h.value;
        if (s.status === 'fulfilled')
            sessions.value = s.value;
        if (m.status === 'fulfilled')
            mcp.value = m.value;
        if (a.status === 'fulfilled')
            agents.value = a.value;
    }
    finally {
        loading.value = false;
    }
}
let timer;
onMounted(() => {
    refresh();
    timer = window.setInterval(refresh, 10000);
});
onUnmounted(() => {
    if (timer)
        clearInterval(timer);
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("h-full overflow-y-auto") }, ...{ style: (({ padding: '24px', background: 'var(--background)', maxWidth: '1120px' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between gap-4 mb-6") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-xl font-semibold mb-1") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[13px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), disabled: ((__VLS_ctx.loading)), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), disabled: ((__VLS_ctx.loading)), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (__VLS_ctx.refresh)
    };
    let __VLS_2;
    let __VLS_3;
    const __VLS_7 = __VLS_resolvedLocalAndGlobalComponents.RefreshCw;
    /** @type { [typeof __VLS_components.RefreshCw, ] } */
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({ size: ((14)), ...{ class: (({ 'animate-spin': __VLS_ctx.loading })) }, }));
    const __VLS_9 = __VLS_8({ size: ((14)), ...{ class: (({ 'animate-spin': __VLS_ctx.loading })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid gap-3.5 mb-6") }, ...{ style: (({ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] p-4") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mb-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[28px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: __VLS_ctx.health?.healthy ? 'var(--status-running)' : 'var(--status-error)' })) }, });
    (__VLS_ctx.health?.healthy ? '健康' : '未知');
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mt-1.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    (__VLS_ctx.health?.version ?? '--');
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] p-4") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mb-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[28px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.sessions.length);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] p-4") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mb-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[28px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (Object.keys(__VLS_ctx.mcp).length);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] p-4") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mb-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[28px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.agents.length);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] p-4 mb-6") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-[13px] font-semibold mb-3") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
    for (const [v, name] of __VLS_getVForSourceType((__VLS_ctx.mcp))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((name)), ...{ class: ("flex items-center gap-2.5") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ class: ("rounded-full") }, ...{ style: (({ width: '6px', height: '6px', background: v?.connected || v?.running ? 'var(--chart-2)' : 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("flex-1 text-[13px] font-mono min-w-0 truncate") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (name);
        // @ts-ignore
        [Badge,];
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(Badge, new Badge({ label: ((v?.connected || v?.running ? '运行中' : '已停止')), status: ((v?.connected || v?.running ? 'running' : 'idle')), dot: (true), }));
        const __VLS_14 = __VLS_13({ label: ((v?.connected || v?.running ? '运行中' : '已停止')), status: ((v?.connected || v?.running ? 'running' : 'idle')), dot: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    if (Object.keys(__VLS_ctx.mcp).length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[14px] overflow-hidden") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-[13px] font-semibold px-4 pt-4 pb-3") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({ ...{ class: ("w-full text-sm") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({ ...{ style: (({ background: 'var(--muted)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({ ...{ class: ("text-left font-medium px-4 py-2.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({ ...{ class: ("text-left font-medium px-4 py-2.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({ ...{ class: ("text-left font-medium px-4 py-2.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [s] of __VLS_getVForSourceType((__VLS_ctx.sessions.slice(0, 10)))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({ key: ((s.id)), ...{ style: (({ borderTop: '1px solid var(--border)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ ...{ class: ("px-4 py-2.5 truncate") }, ...{ style: (({ color: 'var(--foreground)', maxWidth: '300px' })) }, });
        (s.title || '(无标题)');
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ ...{ class: ("px-4 py-2.5") }, });
        // @ts-ignore
        [Badge,];
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((s.status || 'idle')), dot: (true), }));
        const __VLS_19 = __VLS_18({ status: ((s.status || 'idle')), dot: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ ...{ class: ("px-4 py-2.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        (s.updatedAt || s.createdAt || '--');
    }
    if (__VLS_ctx.sessions.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ colspan: ("3"), ...{ class: ("px-4 py-8 text-center text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_styleScopedClasses['h-full'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['text-xl'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-1'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['gap-3.5'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mb-2'];
    __VLS_styleScopedClasses['text-[28px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mt-1.5'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mb-2'];
    __VLS_styleScopedClasses['text-[28px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mb-2'];
    __VLS_styleScopedClasses['text-[28px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mb-2'];
    __VLS_styleScopedClasses['text-[28px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2.5'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['rounded-[14px]'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['pt-4'];
    __VLS_styleScopedClasses['pb-3'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-8'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['text-xs'];
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
            RefreshCw: RefreshCw,
            Btn: Btn,
            Badge: Badge,
            health: health,
            sessions: sessions,
            mcp: mcp,
            agents: agents,
            loading: loading,
            refresh: refresh,
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
