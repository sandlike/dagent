import { useToastStore } from '@/stores/toast';
import { CheckCircle2, XCircle, Info } from 'lucide-vue-next';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const toast = useToastStore(); /* PartiallyEnd: #3632/scriptSetup.vue */
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
    // CSS variable injection 
    // CSS variable injection end 
    let __VLS_resolvedLocalAndGlobalComponents;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("fixed bottom-6 right-6 z-[100] flex flex-col gap-2") }, ...{ style: ({}) }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.TransitionGroup;
    /** @type { [typeof __VLS_components.TransitionGroup, typeof __VLS_components.TransitionGroup, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ name: ("toast"), }));
    const __VLS_2 = __VLS_1({ name: ("toast"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.toast.items))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((t.id)), ...{ class: ("flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-sm shadow-lg") }, ...{ style: (({
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    color: 'var(--popover-foreground)',
                    pointerEvents: 'auto',
                })) }, });
        if (t.variant === 'success') {
            const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.CheckCircle2;
            /** @type { [typeof __VLS_components.CheckCircle2, ] } */
            // @ts-ignore
            const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((16)), ...{ style: (({ color: 'var(--status-running)' })) }, }));
            const __VLS_8 = __VLS_7({ size: ((16)), ...{ style: (({ color: 'var(--status-running)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        }
        else if (t.variant === 'error') {
            const __VLS_12 = __VLS_resolvedLocalAndGlobalComponents.XCircle;
            /** @type { [typeof __VLS_components.XCircle, ] } */
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({ size: ((16)), ...{ style: (({ color: 'var(--destructive)' })) }, }));
            const __VLS_14 = __VLS_13({ size: ((16)), ...{ style: (({ color: 'var(--destructive)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        }
        else {
            const __VLS_18 = __VLS_resolvedLocalAndGlobalComponents.Info;
            /** @type { [typeof __VLS_components.Info, ] } */
            // @ts-ignore
            const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
            const __VLS_20 = __VLS_19({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (t.message);
    }
    __VLS_nonNullable(__VLS_5.slots).default;
    var __VLS_5;
    __VLS_styleScopedClasses['fixed'];
    __VLS_styleScopedClasses['bottom-6'];
    __VLS_styleScopedClasses['right-6'];
    __VLS_styleScopedClasses['z-[100]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2.5'];
    __VLS_styleScopedClasses['rounded-[10px]'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['shadow-lg'];
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
            CheckCircle2: CheckCircle2,
            XCircle: XCircle,
            Info: Info,
            toast: toast,
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
