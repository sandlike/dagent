import { watch } from 'vue';
import { X } from 'lucide-vue-next';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = withDefaults(defineProps(), { width: '440px', closeOnBackdrop: true });
const emit = defineEmits();
function close() {
    emit('update:modelValue', false);
}
function onBackdrop() {
    if (props.closeOnBackdrop)
        close();
}
watch(() => props.modelValue, (v) => {
    document.body.style.overflow = v ? 'hidden' : '';
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({ width: '440px', closeOnBackdrop: true });
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
    // CSS variable injection 
    // CSS variable injection end 
    let __VLS_resolvedLocalAndGlobalComponents;
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.Teleport;
    /** @type { [typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ to: ("body"), }));
    const __VLS_2 = __VLS_1({ to: ("body"), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    var __VLS_6 = {};
    const __VLS_7 = __VLS_resolvedLocalAndGlobalComponents.Transition;
    /** @type { [typeof __VLS_components.Transition, typeof __VLS_components.Transition, ] } */
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({ name: ("modal"), }));
    const __VLS_9 = __VLS_8({ name: ("modal"), }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    if (__VLS_ctx.modelValue) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ onClick: (__VLS_ctx.onBackdrop) }, ...{ class: ("fixed inset-0 z-[90] flex items-center justify-center p-4") }, ...{ style: (({ background: 'rgba(0,0,0,0.5)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-[16px] flex flex-col max-h-[90vh]") }, ...{ style: (({
                    width: __VLS_ctx.width,
                    maxWidth: 'calc(100vw - 32px)',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--card-foreground)',
                })) }, });
        if (__VLS_ctx.title || __VLS_ctx.$slots.header) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between px-5 py-4 border-b shrink-0") }, ...{ style: (({ borderColor: 'var(--border)' })) }, });
            var __VLS_13 = {};
            __VLS_elementAsFunction(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({ ...{ class: ("text-base font-semibold") }, });
            (__VLS_ctx.title);
            __VLS_nonNullable(__VLS_12.slots).default;
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (__VLS_ctx.close) }, ...{ class: ("cursor-pointer p-1 rounded-md transition-colors") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            const __VLS_14 = __VLS_resolvedLocalAndGlobalComponents.X;
            /** @type { [typeof __VLS_components.X, ] } */
            // @ts-ignore
            const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({ size: ((18)), }));
            const __VLS_16 = __VLS_15({ size: ((18)), }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("p-5 overflow-y-auto flex-1 min-h-0") }, });
        var __VLS_20 = {};
        if (__VLS_ctx.$slots.footer) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0") }, ...{ style: (({ borderColor: 'var(--border)' })) }, });
            var __VLS_21 = {};
        }
    }
    __VLS_nonNullable(__VLS_12.slots).default;
    var __VLS_12;
    __VLS_nonNullable(__VLS_5.slots).default;
    var __VLS_5;
    __VLS_styleScopedClasses['fixed'];
    __VLS_styleScopedClasses['inset-0'];
    __VLS_styleScopedClasses['z-[90]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['rounded-[16px]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['max-h-[90vh]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['px-5'];
    __VLS_styleScopedClasses['py-4'];
    __VLS_styleScopedClasses['border-b'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-base'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['rounded-md'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-h-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-end'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['px-5'];
    __VLS_styleScopedClasses['py-4'];
    __VLS_styleScopedClasses['border-t'];
    __VLS_styleScopedClasses['shrink-0'];
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
            X: X,
            close: close,
            onBackdrop: onBackdrop,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
    __typeEl: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
