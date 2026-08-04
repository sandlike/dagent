import { computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = withDefaults(defineProps(), {
    type: 'text',
    disabled: false,
    mono: false,
    size: 'md',
});
const emit = defineEmits();
const value = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v === undefined ? '' : String(v)),
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    type: 'text',
    disabled: false,
    mono: false,
    size: 'md',
});
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ type: ((__VLS_ctx.type)), placeholder: ((__VLS_ctx.placeholder)), disabled: ((__VLS_ctx.disabled)), ...{ class: ("w-full px-3 border outline-none transition-colors duration-150 focus:border-[var(--ring)] disabled:opacity-50") }, ...{ style: (({
                height: __VLS_ctx.size === 'sm' ? '32px' : '36px',
                borderRadius: '10px',
                background: 'var(--card)',
                borderColor: 'var(--input)',
                color: 'var(--foreground)',
                fontFamily: __VLS_ctx.mono ? 'var(--font-mono)' : 'var(--font-sans)',
                fontSize: __VLS_ctx.size === 'sm' ? '12px' : '13px',
            })) }, });
    (__VLS_ctx.value);
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['duration-150'];
    __VLS_styleScopedClasses['focus:border-[var(--ring)]'];
    __VLS_styleScopedClasses['disabled:opacity-50'];
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
            value: value,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
