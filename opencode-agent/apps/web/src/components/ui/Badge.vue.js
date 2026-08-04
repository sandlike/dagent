import { computed } from 'vue';
import { INSTANCE_STATUS_META, SESSION_STATUS_META } from '@opencode/shared';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const props = defineProps();
const meta = computed(() => {
    if (props.status) {
        const isInstance = props.status in INSTANCE_STATUS_META;
        return isInstance
            ? INSTANCE_STATUS_META[props.status]
            : SESSION_STATUS_META[props.status];
    }
    return null;
});
const text = computed(() => props.label ?? meta.value?.label ?? '');
const dotColor = computed(() => props.color ?? meta.value?.color ?? 'var(--status-running)');
const textColor = computed(() => props.color ?? meta.value?.color ?? 'var(--foreground)'); /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("inline-flex items-center gap-1.5 whitespace-nowrap text-xs") }, ...{ style: (({ color: __VLS_ctx.textColor })) }, });
    if (__VLS_ctx.dot) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ class: ("rounded-full") }, ...{ style: (({ width: '7px', height: '7px', background: __VLS_ctx.dotColor })) }, });
    }
    (__VLS_ctx.text);
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['rounded-full'];
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
            text: text,
            dotColor: dotColor,
            textColor: textColor,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
