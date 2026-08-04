import { computed } from 'vue';
import { useWizardStore } from '@/stores/wizard';
import { AGENT_TEMPLATES, findTemplate } from '@opencode/shared';
import { Check } from 'lucide-vue-next';
import Field from '@/components/ui/Field.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const wizard = useWizardStore();
const currentAgent = computed(() => wizard.form.agentType);
function selectAgent(id) {
    const t = findTemplate(id);
    if (!t || !t.available)
        return;
    // 注入该模板的推荐配置（保留用户已填的 name/namespace）
    const { name, namespace } = wizard.form;
    wizard.form = { ...t.configTemplate, name, namespace, agentType: t.id };
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
    let __VLS_resolvedLocalAndGlobalComponents;
    // @ts-ignore
    [Field, Field,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Field, new Field({ label: ("展示名称"), required: (true), }));
    const __VLS_1 = __VLS_0({ label: ("展示名称"), required: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    // @ts-ignore
    [Input,];
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(Input, new Input({ modelValue: ((__VLS_ctx.wizard.form.name)), placeholder: ("例如：日常编码助手"), }));
    const __VLS_6 = __VLS_5({ modelValue: ((__VLS_ctx.wizard.form.name)), placeholder: ("例如：日常编码助手"), }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    // @ts-ignore
    [Field, Field,];
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(Field, new Field({ label: ("显示描述"), }));
    const __VLS_11 = __VLS_10({ label: ("显示描述"), }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    // @ts-ignore
    [Input,];
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(Input, new Input({ modelValue: ((__VLS_ctx.wizard.form.description)), placeholder: ("例如：用于日常代码编写与审查"), }));
    const __VLS_16 = __VLS_15({ modelValue: ((__VLS_ctx.wizard.form.description)), placeholder: ("例如：用于日常代码编写与审查"), }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_nonNullable(__VLS_14.slots).default;
    var __VLS_14;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid gap-3") }, ...{ style: (({ gridTemplateColumns: 'repeat(3, 1fr)' })) }, });
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.AGENT_TEMPLATES))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.selectAgent(t.id);
                } }, key: ((t.id)), ...{ class: ("text-left rounded-xl p-4 cursor-pointer transition-colors flex flex-col gap-1.5") }, ...{ style: (({
                    border: __VLS_ctx.currentAgent === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: __VLS_ctx.currentAgent === t.id
                        ? 'color-mix(in srgb, var(--primary) 8%, var(--card))'
                        : 'var(--card)',
                    opacity: t.available ? 1 : 0.5,
                    cursor: t.available ? 'pointer' : 'not-allowed',
                })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0") }, ...{ style: (({
                    background: __VLS_ctx.currentAgent === t.id ? 'var(--primary)' : 'var(--muted)',
                    color: 'var(--primary-foreground)',
                })) }, });
        if (__VLS_ctx.currentAgent === t.id) {
            const __VLS_20 = __VLS_resolvedLocalAndGlobalComponents.Check;
            /** @type { [typeof __VLS_components.Check, ] } */
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({ size: ((10)), }));
            const __VLS_22 = __VLS_21({ size: ((10)), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: __VLS_ctx.currentAgent === t.id ? 'var(--primary)' : 'var(--foreground)' })) }, });
        (t.label);
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        (t.available ? t.description : '敬请期待');
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    // @ts-ignore
    [Field, Field,];
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(Field, new Field({ label: ("默认 Agent"), }));
    const __VLS_27 = __VLS_26({ label: ("默认 Agent"), }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    // @ts-ignore
    [Select, Select,];
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(Select, new Select({ modelValue: ((__VLS_ctx.wizard.form.defaultAgent)), }));
    const __VLS_32 = __VLS_31({ modelValue: ((__VLS_ctx.wizard.form.defaultAgent)), }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ value: ("build"), });
    __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ value: ("plan"), });
    __VLS_nonNullable(__VLS_35.slots).default;
    var __VLS_35;
    __VLS_nonNullable(__VLS_30.slots).default;
    var __VLS_30;
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-4'];
    __VLS_styleScopedClasses['h-4'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-xs'];
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
            AGENT_TEMPLATES: AGENT_TEMPLATES,
            Check: Check,
            Field: Field,
            Input: Input,
            Select: Select,
            wizard: wizard,
            currentAgent: currentAgent,
            selectAgent: selectAgent,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
