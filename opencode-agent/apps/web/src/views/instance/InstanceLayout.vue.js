import { onMounted, watch, computed } from 'vue';
import { useRoute, useRouter, RouterView, RouterLink } from 'vue-router';
import { ArrowLeft, MessageSquare, FileCode, Activity, Settings } from 'lucide-vue-next';
import { useInstancesStore } from '@/stores/instances';
import Badge from '@/components/ui/Badge.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const instances = useInstancesStore();
const instanceId = computed(() => String(route.params.id));
const current = computed(() => instances.current);
async function load(id) {
    const idStr = Array.isArray(id) ? id[0] : id;
    try {
        await instances.fetchOne(idStr);
    }
    catch {
        // 实例不存在或无权访问时，store 里 current 保持 null
    }
}
onMounted(() => load(instanceId.value));
watch(instanceId, (id) => {
    if (id)
        load(id);
});
const tabs = [
    { name: 'chat', label: '对话', icon: MessageSquare },
    { name: 'skills', label: 'Skills', icon: FileCode },
    { name: 'monitor', label: '监控', icon: Activity },
    { name: 'settings', label: '设置', icon: Settings },
]; /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col h-screen") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({ ...{ class: ("flex items-center gap-3 px-5 shrink-0") }, ...{ style: (({ height: '52px', borderBottom: '1px solid var(--border)', background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.router.push('/');
            } }, ...{ class: ("inline-flex items-center gap-1.5 text-sm cursor-pointer hover:underline shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.ArrowLeft;
    /** @type { [typeof __VLS_components.ArrowLeft, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((16)), }));
    const __VLS_2 = __VLS_1({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ style: (({ width: '1px', height: '20px', background: 'var(--border)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold truncate") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.current?.displayName || '加载中...');
    if (__VLS_ctx.current) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono text-[11px] shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (__VLS_ctx.current.versionNum);
    }
    if (__VLS_ctx.current) {
        // @ts-ignore
        [Badge,];
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((__VLS_ctx.current.status)), dot: (true), }));
        const __VLS_7 = __VLS_6({ status: ((__VLS_ctx.current.status)), dot: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({ ...{ class: ("flex items-center gap-1 px-5 shrink-0") }, ...{ style: (({ height: '44px', borderBottom: '1px solid var(--border)', background: 'var(--background)' })) }, });
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
        const __VLS_11 = __VLS_resolvedLocalAndGlobalComponents.RouterLink;
        /** @type { [typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ] } */
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({ key: ((t.name)), to: (({ name: t.name, params: { id: __VLS_ctx.instanceId } })), ...{ class: ("inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition-colors") }, ...{ style: (({
                    color: __VLS_ctx.route.name === t.name ? 'var(--primary)' : 'var(--muted-foreground)',
                    fontWeight: __VLS_ctx.route.name === t.name ? 600 : 400,
                    background: __VLS_ctx.route.name === t.name ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                })) }, }));
        const __VLS_13 = __VLS_12({ key: ((t.name)), to: (({ name: t.name, params: { id: __VLS_ctx.instanceId } })), ...{ class: ("inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm transition-colors") }, ...{ style: (({
                    color: __VLS_ctx.route.name === t.name ? 'var(--primary)' : 'var(--muted-foreground)',
                    fontWeight: __VLS_ctx.route.name === t.name ? 600 : 400,
                    background: __VLS_ctx.route.name === t.name ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        const __VLS_17 = ((t.icon));
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({ size: ((14)), }));
        const __VLS_19 = __VLS_18({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        (t.label);
        __VLS_nonNullable(__VLS_16.slots).default;
        var __VLS_16;
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 overflow-hidden") }, ...{ style: (({ minWidth: 0, minHeight: 0 })) }, });
    const __VLS_23 = __VLS_resolvedLocalAndGlobalComponents.RouterView;
    /** @type { [typeof __VLS_components.RouterView, ] } */
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({}));
    const __VLS_25 = __VLS_24({}, ...__VLS_functionalComponentArgsRest(__VLS_24));
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['h-screen'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['px-5'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['hover:underline'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['px-5'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['overflow-hidden'];
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
            RouterView: RouterView,
            RouterLink: RouterLink,
            ArrowLeft: ArrowLeft,
            Badge: Badge,
            route: route,
            router: router,
            instanceId: instanceId,
            current: current,
            tabs: tabs,
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
