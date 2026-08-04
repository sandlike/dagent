import { useWizardStore } from '@/stores/wizard';
import { PERMISSION_PRESETS, PERMISSION_TOOLS, PERMISSION_ACTIONS } from '@opencode/shared';
import { Plus, Trash2 } from 'lucide-vue-next';
import Btn from '@/components/ui/Btn.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const wizard = useWizardStore();
const modeOptions = [
    { value: 'readonly', label: '只读', desc: 'edit/bash = deny' },
    { value: 'ask', label: '审批制', desc: '所有操作 ask' },
    { value: 'full', label: '全开', desc: '默认 allow' },
    { value: 'custom', label: '自定义', desc: '下方表格配置' },
];
function onModeChange(v) {
    wizard.form.permissionMode = v;
    if (v !== 'custom') {
        wizard.form.toolPermissions = { ...PERMISSION_PRESETS[v] };
    }
}
function isCustom() {
    return wizard.form.permissionMode === 'custom';
}
function addBashRule() {
    wizard.form.bashRules.push({ pattern: '', action: 'deny' });
}
function removeBashRule(i) {
    wizard.form.bashRules.splice(i, 1);
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid gap-2") }, ...{ style: (({ gridTemplateColumns: 'repeat(2, 1fr)' })) }, });
    for (const [opt] of __VLS_getVForSourceType((__VLS_ctx.modeOptions))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.onModeChange(opt.value);
                } }, key: ((opt.value)), ...{ class: ("text-left rounded-lg p-3 border cursor-pointer transition-colors") }, ...{ style: (({
                    borderColor: __VLS_ctx.wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'var(--border)',
                    background: __VLS_ctx.wizard.form.permissionMode === opt.value ? 'color-mix(in srgb, var(--primary) 10%, var(--card))' : 'var(--card)',
                })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ class: ("inline-block w-3.5 h-3.5 rounded-full border-2") }, ...{ style: (({ borderColor: __VLS_ctx.wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'var(--border)', background: __VLS_ctx.wizard.form.permissionMode === opt.value ? 'var(--primary)' : 'transparent' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        (opt.label);
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mt-1 ml-5.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        (opt.desc);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-xl overflow-hidden border") }, ...{ style: (({ borderColor: 'var(--border)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({ ...{ class: ("w-full text-sm") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({ ...{ style: (({ background: 'var(--muted)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({ ...{ class: ("text-left font-medium px-4 py-2.5") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    for (const [a] of __VLS_getVForSourceType((__VLS_ctx.PERMISSION_ACTIONS))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({ key: ((a)), ...{ class: ("px-4 py-2.5 font-medium text-center") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        (a);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.PERMISSION_TOOLS))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({ key: ((t.tool)), ...{ style: (({ borderTop: '1px solid var(--border)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ ...{ class: ("px-4 py-2.5") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' })) }, });
        (t.label);
        for (const [a] of __VLS_getVForSourceType((__VLS_ctx.PERMISSION_ACTIONS))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({ key: ((a)), ...{ class: ("px-4 py-2.5 text-center") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onChange: (...[$event]) => {
                        __VLS_ctx.wizard.form.toolPermissions[t.tool] = a;
                    } }, type: ("radio"), name: ((`tool-${t.tool}`)), checked: ((__VLS_ctx.wizard.form.toolPermissions[t.tool] === a)), disabled: ((!__VLS_ctx.isCustom())), ...{ class: ("cursor-pointer accent-[var(--primary)]") }, });
        }
    }
    if (!__VLS_ctx.isCustom()) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (__VLS_ctx.addBashRule)
    };
    let __VLS_2;
    let __VLS_3;
    const __VLS_7 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({ size: ((14)), }));
    const __VLS_9 = __VLS_8({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    for (const [rule, i] of __VLS_getVForSourceType((__VLS_ctx.wizard.form.bashRules))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((i)), ...{ class: ("flex items-center gap-2") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("命令模式，如 rm -rf *"), ...{ class: ("flex-1") }, ...{ style: (({ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' })) }, });
        (rule.pattern);
        __VLS_elementAsFunction(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({ value: ((rule.action)), ...{ class: ("cursor-pointer") }, ...{ style: (({ height: '32px', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '12px' })) }, });
        for (const [a] of __VLS_getVForSourceType((__VLS_ctx.PERMISSION_ACTIONS))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ key: ((a)), value: ((a)), });
            (a);
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.removeBashRule(i);
                } }, ...{ class: ("cursor-pointer p-1.5") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
        const __VLS_13 = __VLS_resolvedLocalAndGlobalComponents.Trash2;
        /** @type { [typeof __VLS_components.Trash2, ] } */
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({ size: ((14)), }));
        const __VLS_15 = __VLS_14({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    }
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['p-3'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['inline-block'];
    __VLS_styleScopedClasses['w-3.5'];
    __VLS_styleScopedClasses['h-3.5'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['border-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mt-1'];
    __VLS_styleScopedClasses['ml-5.5'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['text-left'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['accent-[var(--primary)]'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1.5'];
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
            PERMISSION_TOOLS: PERMISSION_TOOLS,
            PERMISSION_ACTIONS: PERMISSION_ACTIONS,
            Plus: Plus,
            Trash2: Trash2,
            Btn: Btn,
            wizard: wizard,
            modeOptions: modeOptions,
            onModeChange: onModeChange,
            isCustom: isCustom,
            addBashRule: addBashRule,
            removeBashRule: removeBashRule,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
