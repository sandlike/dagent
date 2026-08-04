import { ref } from 'vue';
import { File, Check } from 'lucide-vue-next';
import Btn from '@/components/ui/Btn.vue';
import Modal from '@/components/ui/Modal.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const __VLS_props = defineProps();
const emit = defineEmits();
const showImport = ref(false);
const importText = ref('');
const rawMode = ref(false);
function doImport() {
    if (importText.value.trim()) {
        emit('import', importText.value);
    }
    showImport.value = false;
    importText.value = '';
}
; /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col overflow-hidden") }, ...{ style: (({ width: '45%', minWidth: 0, background: 'var(--muted)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between h-11 px-4 border-b shrink-0") }, ...{ style: (({ borderColor: 'var(--border)', background: 'var(--muted)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.File;
    /** @type { [typeof __VLS_components.File, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
    const __VLS_2 = __VLS_1({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.rawMode = !__VLS_ctx.rawMode;
            } }, ...{ class: ("inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-xs whitespace-nowrap border cursor-pointer") }, ...{ style: (({ background: __VLS_ctx.rawMode ? 'var(--primary)' : 'var(--background)', borderColor: 'var(--border)', color: __VLS_ctx.rawMode ? 'var(--primary-foreground)' : 'var(--muted-foreground)' })) }, });
    (__VLS_ctx.rawMode ? '返回预览' : '切换原始编辑');
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.showImport = true;
            } }, ...{ class: ("inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-xs whitespace-nowrap border cursor-pointer") }, ...{ style: (({ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 overflow-y-auto p-4") }, });
    if (__VLS_ctx.rawMode) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.textarea)({ value: ((__VLS_ctx.configJson)), readonly: (true), ...{ class: ("w-full h-full resize-none outline-none border-0") }, ...{ style: (({ background: 'transparent', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' })) }, });
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({ ...{ class: ("text-sm leading-6 whitespace-pre-wrap break-all") }, ...{ style: (({ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--foreground)', margin: 0 })) }, });
        (__VLS_ctx.configJson);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-3 px-4 py-3 border-t shrink-0 flex-wrap") }, ...{ style: (({ borderColor: 'var(--border)', background: 'var(--muted)' })) }, });
    for (const [item] of __VLS_getVForSourceType((['ConfigMap', 'Secret', 'Deployment', 'PVC']))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ key: ((item)), ...{ class: ("inline-flex items-center gap-1.5 text-xs") }, ...{ style: (({ color: 'var(--chart-2)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("inline-flex items-center justify-center w-6 h-6 rounded-md") }, ...{ style: (({ background: 'color-mix(in srgb, var(--chart-2) 15%, transparent)' })) }, });
        const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.Check;
        /** @type { [typeof __VLS_components.Check, ] } */
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((14)), }));
        const __VLS_8 = __VLS_7({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        (item);
    }
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showImport)), title: ("导入 opencode.json"), width: ("560px"), }));
    const __VLS_13 = __VLS_12({ modelValue: ((__VLS_ctx.showImport)), title: ("导入 opencode.json"), width: ("560px"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm mb-3") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.textarea)({ value: ((__VLS_ctx.importText)), placeholder: ('{ "provider": {...}, "model": "..." }'), rows: ("14"), ...{ class: ("w-full resize-none outline-none border p-3 rounded-lg") }, ...{ style: (({ background: 'var(--background)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '13px' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_16.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), }));
        const __VLS_18 = __VLS_17({ ...{ 'onClick': {} }, variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        let __VLS_22;
        const __VLS_23 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showImport = false;
            }
        };
        let __VLS_19;
        let __VLS_20;
        __VLS_nonNullable(__VLS_21.slots).default;
        var __VLS_21;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, }));
        const __VLS_25 = __VLS_24({ ...{ 'onClick': {} }, }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        let __VLS_29;
        const __VLS_30 = {
            onClick: (__VLS_ctx.doImport)
        };
        let __VLS_26;
        let __VLS_27;
        __VLS_nonNullable(__VLS_28.slots).default;
        var __VLS_28;
    }
    var __VLS_16;
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['h-11'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['border-b'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['h-7'];
    __VLS_styleScopedClasses['px-2.5'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['h-7'];
    __VLS_styleScopedClasses['px-2.5'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['h-full'];
    __VLS_styleScopedClasses['resize-none'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['border-0'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['leading-6'];
    __VLS_styleScopedClasses['whitespace-pre-wrap'];
    __VLS_styleScopedClasses['break-all'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-3'];
    __VLS_styleScopedClasses['border-t'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-6'];
    __VLS_styleScopedClasses['h-6'];
    __VLS_styleScopedClasses['rounded-md'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['mb-3'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['resize-none'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['p-3'];
    __VLS_styleScopedClasses['rounded-lg'];
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
            File: File,
            Check: Check,
            Btn: Btn,
            Modal: Modal,
            showImport: showImport,
            importText: importText,
            rawMode: rawMode,
            doImport: doImport,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
