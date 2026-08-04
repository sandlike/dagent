import { computed } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = withDefaults(defineProps(), { disabled: false, mono: false, size: 'md' });
const emit = defineEmits();
const value = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v ?? ''),
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({ disabled: false, mono: false, size: 'md' });
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("relative w-full") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({ value: ((__VLS_ctx.value)), disabled: ((__VLS_ctx.disabled)), ...{ class: ("w-full appearance-none px-3 border outline-none cursor-pointer disabled:opacity-50 pr-9") }, ...{ style: (({
                height: __VLS_ctx.size === 'sm' ? '32px' : '36px',
                borderRadius: '10px',
                background: 'var(--card)',
                borderColor: 'var(--input)',
                color: 'var(--foreground)',
                fontFamily: __VLS_ctx.mono ? 'var(--font-mono)' : 'var(--font-sans)',
                fontSize: __VLS_ctx.size === 'sm' ? '12px' : '13px',
            })) }, });
    var __VLS_0 = {};
    const __VLS_1 = __VLS_resolvedLocalAndGlobalComponents.ChevronDown;
    /** @type { [typeof __VLS_components.ChevronDown, ] } */
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent(__VLS_1, new __VLS_1({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
    const __VLS_3 = __VLS_2({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    __VLS_styleScopedClasses['relative'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['appearance-none'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['disabled:opacity-50'];
    __VLS_styleScopedClasses['pr-9'];
    __VLS_styleScopedClasses['absolute'];
    __VLS_styleScopedClasses['right-3'];
    __VLS_styleScopedClasses['top-1/2'];
    __VLS_styleScopedClasses['-translate-y-1/2'];
    __VLS_styleScopedClasses['pointer-events-none'];
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
            ChevronDown: ChevronDown,
            value: value,
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
