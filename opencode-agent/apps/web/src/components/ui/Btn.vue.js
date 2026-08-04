import { computed } from 'vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = withDefaults(defineProps(), {
    variant: 'primary',
    size: 'md',
    rounded: 'md',
    disabled: false,
    type: 'button',
});
const height = computed(() => ({ sm: '32px', md: '36px', lg: '40px' })[props.size]);
const padding = computed(() => props.rounded === 'full'
    ? ({ sm: '0 13px', md: '0 16px', lg: '0 20px' })[props.size]
    : ({ sm: '0 13px', md: '0 14px', lg: '0 16px' })[props.size]);
const fontSize = computed(() => ({ sm: '12px', md: '13px', lg: '14px' })[props.size]);
const variantStyle = computed(() => {
    switch (props.variant) {
        case 'primary':
            return {
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: '1px solid var(--primary)',
            };
        case 'secondary':
            return {
                background: 'var(--muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
            };
        case 'ghost':
            return {
                background: 'transparent',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
            };
        case 'destructive':
            return {
                background: 'transparent',
                color: 'var(--destructive)',
                border: '1px solid var(--border)',
            };
    }
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    variant: 'primary',
    size: 'md',
    rounded: 'md',
    disabled: false,
    type: 'button',
});
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ type: ((__VLS_ctx.type)), disabled: ((__VLS_ctx.disabled)), ...{ class: ("inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap cursor-pointer transition-all duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0") }, ...{ style: (({
                height: __VLS_ctx.height,
                padding: __VLS_ctx.padding,
                fontSize: __VLS_ctx.fontSize,
                borderRadius: __VLS_ctx.rounded === 'full' ? '999px' : '10px',
                ...__VLS_ctx.variantStyle,
            })) }, });
    var __VLS_0 = {};
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-all'];
    __VLS_styleScopedClasses['duration-150'];
    __VLS_styleScopedClasses['hover:opacity-90'];
    __VLS_styleScopedClasses['active:translate-y-px'];
    __VLS_styleScopedClasses['disabled:opacity-50'];
    __VLS_styleScopedClasses['disabled:cursor-not-allowed'];
    __VLS_styleScopedClasses['disabled:active:translate-y-0'];
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
            height: height,
            padding: padding,
            fontSize: fontSize,
            variantStyle: variantStyle,
        };
    },
    __typeProps: {},
    props: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
    __typeEl: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
