import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { parseConfig } from '@opencode/shared';
import { useWizardStore } from '@/stores/wizard';
import { useToastStore } from '@/stores/toast';
import { useInstancesStore } from '@/stores/instances';
import { deployInstance, updateInstance } from '@/api/instances';
import { ApiRequestError } from '@/api/client';
import Btn from '@/components/ui/Btn.vue';
import JsonPreview from './JsonPreview.vue';
import Step1Basic from './steps/Step1Basic.vue';
import Step2Provider from './steps/Step2Provider.vue';
import Step3Permission from './steps/Step3Permission.vue';
import Step4McpSkills from './steps/Step4McpSkills.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const wizard = useWizardStore();
const toast = useToastStore();
const instances = useInstancesStore();
const deploying = ref(false);
// 4 步向导（去掉了原「版本选择」，改为基本信息里的 Agent 类型卡片）
const steps = [
    { n: 1, label: '基本信息' },
    { n: 2, label: '模型与 Provider' },
    { n: 3, label: '权限策略' },
    { n: 4, label: 'MCP + Skills' },
];
function onImport(jsonStr) {
    try {
        const obj = JSON.parse(jsonStr);
        wizard.form = parseConfig(obj, { name: wizard.form.name, namespace: wizard.form.namespace });
        toast.success('配置已导入，请检查各步骤');
    }
    catch {
        toast.error('JSON 解析失败，请检查格式');
    }
}
async function deploy() {
    if (!wizard.form.name.trim()) {
        toast.error('请先填写展示名称');
        wizard.goTo(1);
        return;
    }
    // 编辑模式：检测 localStorage 里的 editingInstanceId，走 PUT（部署新版本）
    const editingId = localStorage.getItem('oma:editingInstanceId');
    deploying.value = true;
    try {
        if (editingId) {
            const res = await updateInstance(editingId, {
                displayName: wizard.form.name,
                configJson: wizard.configJson,
                provider: wizard.form.provider.template,
                modelId: wizard.form.model,
                agentType: wizard.form.agentType,
                providerId: wizard.form.providerId,
            });
            localStorage.removeItem('oma:editingInstanceId');
            localStorage.removeItem('oma:editingGroupId');
            toast.success('已部署新版本');
            await instances.fetchList();
            router.push({ name: 'settings', params: { id: res.instance.id } });
        }
        else {
            const res = await deployInstance({
                displayName: wizard.form.name,
                configJson: wizard.configJson,
                provider: wizard.form.provider.template,
                modelId: wizard.form.model,
                agentType: wizard.form.agentType,
                providerId: wizard.form.providerId,
            });
            toast.success('部署请求已提交');
            await instances.fetchList();
            router.push({ name: 'settings', params: { id: res.instance.id } });
        }
    }
    catch (e) {
        const msg = e instanceof ApiRequestError ? e.message : '部署失败，请重试';
        toast.error(msg);
    }
    finally {
        deploying.value = false;
    }
}
// 顶部标题反映模式
const isEditing = ref(false);
function cancelEdit() {
    localStorage.removeItem('oma:editingInstanceId');
    localStorage.removeItem('oma:editingGroupId');
    router.push('/');
}
onMounted(() => {
    isEditing.value = !!localStorage.getItem('oma:editingInstanceId');
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({ ...{ class: ("flex flex-col h-screen overflow-hidden") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({ ...{ class: ("flex items-center justify-between h-14 px-6 border-b shrink-0") }, ...{ style: (({ borderColor: 'var(--border)', background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (__VLS_ctx.cancelEdit) }, ...{ class: ("inline-flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer hover:underline") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.ArrowLeft;
    /** @type { [typeof __VLS_components.ArrowLeft, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((16)), }));
    const __VLS_2 = __VLS_1({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-base font-semibold truncate") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.isEditing ? '编辑配置（部署新版本）' : '新建实例');
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-xs whitespace-nowrap") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("输入展示名称"), ...{ class: ("w-48") }, ...{ style: (({ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' })) }, });
    (__VLS_ctx.wizard.form.name);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-1 overflow-hidden") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col overflow-y-auto") }, ...{ style: (({ width: '55%', minWidth: 0, background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1 px-8 pt-6 pb-4 shrink-0 flex-wrap") }, });
    for (const [s, idx] of __VLS_getVForSourceType((__VLS_ctx.steps))) {
        (s.n);
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold") }, ...{ style: ((__VLS_ctx.wizard.step > s.n
                    ? { background: 'color-mix(in srgb, var(--chart-2) 20%, transparent)', color: 'var(--chart-2)' }
                    : __VLS_ctx.wizard.step === s.n
                        ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
                        : { background: 'var(--muted)', color: 'var(--muted-foreground)' })) }, });
        if (__VLS_ctx.wizard.step > s.n) {
            const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.Check;
            /** @type { [typeof __VLS_components.Check, ] } */
            // @ts-ignore
            const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((14)), }));
            const __VLS_8 = __VLS_7({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        }
        else {
            (s.n);
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm") }, ...{ style: (({
                    color: __VLS_ctx.wizard.step === s.n ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: __VLS_ctx.wizard.step === s.n ? 600 : 400,
                })) }, });
        (s.label);
        if (idx < __VLS_ctx.steps.length - 1) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("mx-2 text-xs") }, ...{ style: (({ color: 'var(--border)' })) }, });
        }
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("px-8 pb-8 flex flex-col gap-6") }, });
    if (__VLS_ctx.wizard.step === 1) {
        // @ts-ignore
        [Step1Basic,];
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent(Step1Basic, new Step1Basic({}));
        const __VLS_13 = __VLS_12({}, ...__VLS_functionalComponentArgsRest(__VLS_12));
    }
    else if (__VLS_ctx.wizard.step === 2) {
        // @ts-ignore
        [Step2Provider,];
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(Step2Provider, new Step2Provider({}));
        const __VLS_18 = __VLS_17({}, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    else if (__VLS_ctx.wizard.step === 3) {
        // @ts-ignore
        [Step3Permission,];
        // @ts-ignore
        const __VLS_22 = __VLS_asFunctionalComponent(Step3Permission, new Step3Permission({}));
        const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
    }
    else if (__VLS_ctx.wizard.step === 4) {
        // @ts-ignore
        [Step4McpSkills,];
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(Step4McpSkills, new Step4McpSkills({}));
        const __VLS_28 = __VLS_27({}, ...__VLS_functionalComponentArgsRest(__VLS_27));
    }
    // @ts-ignore
    [JsonPreview,];
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(JsonPreview, new JsonPreview({ ...{ 'onImport': {} }, configJson: ((__VLS_ctx.wizard.configJson)), }));
    const __VLS_33 = __VLS_32({ ...{ 'onImport': {} }, configJson: ((__VLS_ctx.wizard.configJson)), }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    let __VLS_37;
    const __VLS_38 = {
        onImport: (__VLS_ctx.onImport)
    };
    let __VLS_34;
    let __VLS_35;
    var __VLS_36;
    __VLS_elementAsFunction(__VLS_intrinsicElements.footer, __VLS_intrinsicElements.footer)({ ...{ class: ("flex items-center justify-between h-14 px-6 border-t shrink-0") }, ...{ style: (({ borderColor: 'var(--border)', background: 'var(--background)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("secondary"), rounded: ("full"), disabled: ((__VLS_ctx.wizard.step === 1)), }));
    const __VLS_40 = __VLS_39({ ...{ 'onClick': {} }, variant: ("secondary"), rounded: ("full"), disabled: ((__VLS_ctx.wizard.step === 1)), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    let __VLS_44;
    const __VLS_45 = {
        onClick: (...[$event]) => {
            __VLS_ctx.wizard.prev();
        }
    };
    let __VLS_41;
    let __VLS_42;
    const __VLS_46 = __VLS_resolvedLocalAndGlobalComponents.ChevronLeft;
    /** @type { [typeof __VLS_components.ChevronLeft, ] } */
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({ size: ((16)), }));
    const __VLS_48 = __VLS_47({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    __VLS_nonNullable(__VLS_43.slots).default;
    var __VLS_43;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-3") }, });
    if (__VLS_ctx.wizard.step === __VLS_ctx.wizard.totalSteps) {
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_52 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), disabled: ((__VLS_ctx.deploying)), }));
        const __VLS_53 = __VLS_52({ ...{ 'onClick': {} }, rounded: ("full"), disabled: ((__VLS_ctx.deploying)), }, ...__VLS_functionalComponentArgsRest(__VLS_52));
        let __VLS_57;
        const __VLS_58 = {
            onClick: (__VLS_ctx.deploy)
        };
        let __VLS_54;
        let __VLS_55;
        (__VLS_ctx.deploying ? '部署中...' : (__VLS_ctx.isEditing ? '部署新版本' : '一键部署'));
        __VLS_nonNullable(__VLS_56.slots).default;
        var __VLS_56;
    }
    else {
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_59 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), }));
        const __VLS_60 = __VLS_59({ ...{ 'onClick': {} }, rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
        let __VLS_64;
        const __VLS_65 = {
            onClick: (...[$event]) => {
                if (!(!((__VLS_ctx.wizard.step === __VLS_ctx.wizard.totalSteps))))
                    return;
                __VLS_ctx.wizard.next();
            }
        };
        let __VLS_61;
        let __VLS_62;
        const __VLS_66 = __VLS_resolvedLocalAndGlobalComponents.ChevronRight;
        /** @type { [typeof __VLS_components.ChevronRight, ] } */
        // @ts-ignore
        const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({ size: ((16)), }));
        const __VLS_68 = __VLS_67({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
        __VLS_nonNullable(__VLS_63.slots).default;
        var __VLS_63;
    }
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['h-screen'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['h-14'];
    __VLS_styleScopedClasses['px-6'];
    __VLS_styleScopedClasses['border-b'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['hover:underline'];
    __VLS_styleScopedClasses['text-base'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['w-48'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['overflow-hidden'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['px-8'];
    __VLS_styleScopedClasses['pt-6'];
    __VLS_styleScopedClasses['pb-4'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-6'];
    __VLS_styleScopedClasses['h-6'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['mx-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['px-8'];
    __VLS_styleScopedClasses['pb-8'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-6'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['h-14'];
    __VLS_styleScopedClasses['px-6'];
    __VLS_styleScopedClasses['border-t'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
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
            ArrowLeft: ArrowLeft,
            Check: Check,
            ChevronLeft: ChevronLeft,
            ChevronRight: ChevronRight,
            Btn: Btn,
            JsonPreview: JsonPreview,
            Step1Basic: Step1Basic,
            Step2Provider: Step2Provider,
            Step3Permission: Step3Permission,
            Step4McpSkills: Step4McpSkills,
            wizard: wizard,
            deploying: deploying,
            steps: steps,
            onImport: onImport,
            deploy: deploy,
            isEditing: isEditing,
            cancelEdit: cancelEdit,
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
