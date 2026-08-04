import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWizardStore } from '@/stores/wizard';
import { listProviders } from '@/api/proxy';
import { Plus, Shield, AlertCircle } from 'lucide-vue-next';
import Field from '@/components/ui/Field.vue';
import Btn from '@/components/ui/Btn.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const wizard = useWizardStore();
const router = useRouter();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers = ref([]);
const selectedProviderId = ref(null);
async function loadProviders() {
    try {
        providers.value = await listProviders();
        // 默认选第一个
        if (providers.value.length > 0 && !selectedProviderId.value) {
            selectedProviderId.value = providers.value[0].id;
        }
    }
    catch {
        // 静默
    }
}
const selectedProvider = computed(() => providers.value.find((p) => p.id === selectedProviderId.value));
const availableModels = computed(() => selectedProvider.value?.models ?? []);
// 选 provider 时，更新 wizard form 的 model
watch(selectedProviderId, (id) => {
    if (!id)
        return;
    wizard.form.providerId = id;
    const p = providers.value.find((x) => x.id === id);
    if (p) {
        // 更新 provider 信息（生成 configJson 用）
        wizard.form.provider.template = p.template;
        wizard.form.provider.baseUrl = p.baseUrl;
        wizard.form.provider.apiKey = ''; // 不需要填，走 Higress
        // 默认选第一个模型
        if (p.models?.length > 0) {
            wizard.form.model = `${p.template}/${p.models[0]}`;
            wizard.form.smallModel = `${p.template}/${p.models[0]}`;
        }
    }
});
onMounted(() => {
    loadProviders();
}); /* PartiallyEnd: #3632/scriptSetup.vue */
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
    if (__VLS_ctx.providers.length > 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3") }, });
        // @ts-ignore
        [Field, Field,];
        // @ts-ignore
        const __VLS_0 = __VLS_asFunctionalComponent(Field, new Field({ label: ("选择 LLM Provider"), }));
        const __VLS_1 = __VLS_0({ label: ("选择 LLM Provider"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        __VLS_elementAsFunction(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({ ...{ onChange: ((e) => __VLS_ctx.selectedProviderId = Number(e.target.value)) }, value: ((__VLS_ctx.selectedProviderId)), ...{ class: ("w-full appearance-none px-3 border outline-none cursor-pointer") }, ...{ style: (({ height: '36px', borderRadius: '10px', background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontSize: '13px' })) }, });
        for (const [p] of __VLS_getVForSourceType((__VLS_ctx.providers))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ key: ((p.id)), value: ((p.id)), });
            (p.name);
            (p.template);
        }
        __VLS_nonNullable(__VLS_4.slots).default;
        var __VLS_4;
        if (__VLS_ctx.selectedProvider) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("rounded-xl p-4 flex flex-col gap-2") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
            const __VLS_5 = __VLS_resolvedLocalAndGlobalComponents.Shield;
            /** @type { [typeof __VLS_components.Shield, ] } */
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({ size: ((14)), ...{ style: (({ color: 'var(--status-running)' })) }, }));
            const __VLS_7 = __VLS_6({ size: ((14)), ...{ style: (({ color: 'var(--status-running)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("text-xs font-mono") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
            (__VLS_ctx.selectedProvider.baseUrl);
        }
        if (__VLS_ctx.availableModels.length > 0) {
            // @ts-ignore
            [Field, Field,];
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent(Field, new Field({ label: ("主模型"), }));
            const __VLS_12 = __VLS_11({ label: ("主模型"), }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            const __VLS_16 = __VLS_resolvedLocalAndGlobalComponents.Select;
            /** @type { [typeof __VLS_components.Select, typeof __VLS_components.Select, ] } */
            // @ts-ignore
            const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({ modelValue: ((__VLS_ctx.wizard.form.model)), mono: (true), }));
            const __VLS_18 = __VLS_17({ modelValue: ((__VLS_ctx.wizard.form.model)), mono: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_17));
            for (const [m] of __VLS_getVForSourceType((__VLS_ctx.availableModels))) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ key: ((m)), value: ((`${__VLS_ctx.selectedProvider?.template}/${m}`)), });
                (m);
            }
            __VLS_nonNullable(__VLS_21.slots).default;
            var __VLS_21;
            __VLS_nonNullable(__VLS_15.slots).default;
            var __VLS_15;
        }
        if (__VLS_ctx.availableModels.length > 0) {
            // @ts-ignore
            [Field, Field,];
            // @ts-ignore
            const __VLS_22 = __VLS_asFunctionalComponent(Field, new Field({ label: ("小模型（标题生成等轻量任务）"), }));
            const __VLS_23 = __VLS_22({ label: ("小模型（标题生成等轻量任务）"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
            const __VLS_27 = __VLS_resolvedLocalAndGlobalComponents.Select;
            /** @type { [typeof __VLS_components.Select, typeof __VLS_components.Select, ] } */
            // @ts-ignore
            const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({ modelValue: ((__VLS_ctx.wizard.form.smallModel)), mono: (true), }));
            const __VLS_29 = __VLS_28({ modelValue: ((__VLS_ctx.wizard.form.smallModel)), mono: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_28));
            for (const [m] of __VLS_getVForSourceType((__VLS_ctx.availableModels))) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ key: ((m)), value: ((`${__VLS_ctx.selectedProvider?.template}/${m}`)), });
                (m);
            }
            __VLS_nonNullable(__VLS_32.slots).default;
            var __VLS_32;
            __VLS_nonNullable(__VLS_26.slots).default;
            var __VLS_26;
        }
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col items-center justify-center gap-3 py-8") }, });
        const __VLS_33 = __VLS_resolvedLocalAndGlobalComponents.AlertCircle;
        /** @type { [typeof __VLS_components.AlertCircle, ] } */
        // @ts-ignore
        const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({ size: ((32)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_35 = __VLS_34({ size: ((32)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_34));
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs text-center") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.br)({});
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_39 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), }));
        const __VLS_40 = __VLS_39({ ...{ 'onClick': {} }, size: ("sm"), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
        let __VLS_44;
        const __VLS_45 = {
            onClick: (...[$event]) => {
                if (!(!((__VLS_ctx.providers.length > 0))))
                    return;
                __VLS_ctx.router.push('/providers');
            }
        };
        let __VLS_41;
        let __VLS_42;
        const __VLS_46 = __VLS_resolvedLocalAndGlobalComponents.Plus;
        /** @type { [typeof __VLS_components.Plus, ] } */
        // @ts-ignore
        const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({ size: ((14)), }));
        const __VLS_48 = __VLS_47({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
        __VLS_nonNullable(__VLS_43.slots).default;
        var __VLS_43;
    }
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['appearance-none'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['py-8'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['text-center'];
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
            Plus: Plus,
            Shield: Shield,
            AlertCircle: AlertCircle,
            Field: Field,
            Btn: Btn,
            wizard: wizard,
            router: router,
            providers: providers,
            selectedProviderId: selectedProviderId,
            selectedProvider: selectedProvider,
            availableModels: availableModels,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
