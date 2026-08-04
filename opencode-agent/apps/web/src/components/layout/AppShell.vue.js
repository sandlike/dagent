import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessageCircleMore, Folder, CircleCheck, PenLine, Box, ChevronDown } from 'lucide-vue-next';
import { useInstancesStore } from '@/stores/instances';
import { useAuthStore } from '@/stores/auth';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const instances = useInstancesStore();
const auth = useAuthStore();
const navItems = [
    { key: 'chat', label: '对话', icon: MessageCircleMore },
    { key: 'skills', label: 'Skills', icon: Folder },
    { key: 'monitor', label: '监控', icon: CircleCheck },
    { key: 'settings', label: '设置', icon: PenLine },
];
const activeKey = computed(() => {
    const name = route.name;
    return navItems.find((n) => n.key === name)?.key ?? '';
});
const instanceName = computed(() => instances.current?.name ?? '实例');
const initial = computed(() => (auth.user?.username ?? 'U')[0].toUpperCase());
function go(key) {
    const id = route.params.id;
    router.push({ name: key, params: { id } });
}
; /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_styleScopedClasses['shell-nav-item'];
    // CSS variable injection 
    // CSS variable injection end 
    let __VLS_resolvedLocalAndGlobalComponents;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("app-shell") }, ...{ style: (({
                display: 'grid',
                gridTemplateColumns: '200px minmax(0,1fr)',
                height: '100vh',
                background: 'var(--background)',
                overflow: 'hidden',
            })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({ ...{ style: (({
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--sidebar)',
                borderRight: '1px solid var(--sidebar-border)',
                minHeight: 0,
            })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({ ...{ style: (({
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '8px 8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
            })) }, });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.navItems))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.go(item.key);
                } }, key: ((item.key)), ...{ class: ("shell-nav-item") }, "data-active": ((__VLS_ctx.activeKey === item.key)), ...{ style: (({
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--sidebar-foreground)',
                    borderRadius: '10px',
                    padding: '9px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'background 140ms ease, color 140ms ease',
                })) }, });
        const __VLS_0 = ((item.icon));
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((18)), ...{ style: (({ flex: 'none', color: __VLS_ctx.activeKey === item.key ? 'var(--primary)' : undefined })) }, }));
        const __VLS_2 = __VLS_1({ size: ((18)), ...{ style: (({ flex: 'none', color: __VLS_ctx.activeKey === item.key ? 'var(--primary)' : undefined })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("truncate flex-1 min-w-0") }, });
        (item.label);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: (({ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({ ...{ style: (({
                height: '56px',
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
            })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.router.push('/');
            } }, ...{ class: ("flex items-center gap-2 cursor-pointer") }, ...{ style: ({}) }, });
    const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.Box;
    /** @type { [typeof __VLS_components.Box, ] } */
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((22)), ...{ style: (({ color: 'var(--primary)' })) }, }));
    const __VLS_8 = __VLS_7({ size: ((22)), ...{ style: (({ color: 'var(--primary)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-semibold whitespace-nowrap") }, ...{ style: (({ fontSize: '15px', color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 flex justify-center min-w-0") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.router.push('/');
            } }, ...{ class: ("inline-flex items-center gap-1.5 cursor-pointer transition-colors") }, ...{ style: (({
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: '13px',
            })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("truncate max-w-[200px]") }, });
    (__VLS_ctx.instanceName);
    const __VLS_12 = __VLS_resolvedLocalAndGlobalComponents.ChevronDown;
    /** @type { [typeof __VLS_components.ChevronDown, ] } */
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({ size: ((14)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
    const __VLS_14 = __VLS_13({ size: ((14)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, ...{ style: ({}) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-full grid place-items-center font-semibold") }, ...{ style: (({
                width: '30px',
                height: '30px',
                background: 'linear-gradient(135deg,var(--chart-1),var(--chart-4))',
                color: 'var(--primary-foreground)',
                fontSize: '12px',
            })) }, });
    (__VLS_ctx.initial);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-h-0 overflow-hidden") }, });
    var __VLS_18 = {};
    __VLS_styleScopedClasses['app-shell'];
    __VLS_styleScopedClasses['shell-nav-item'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['max-w-[200px]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['place-items-center'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-h-0'];
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
            Box: Box,
            ChevronDown: ChevronDown,
            router: router,
            navItems: navItems,
            activeKey: activeKey,
            instanceName: instanceName,
            initial: initial,
            go: go,
        };
    },
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEl: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
