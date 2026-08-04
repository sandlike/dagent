import { ref, onMounted } from 'vue';
import { Plus, Trash2, Cpu, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-vue-next';
import { listMcpServers, createMcpServer, deleteMcpServer } from '@/api/proxy';
import { useToastStore } from '@/stores/toast';
import { ApiRequestError } from '@/api/client';
import Btn from '@/components/ui/Btn.vue';
import Modal from '@/components/ui/Modal.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const toast = useToastStore();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const servers = ref([]);
const loading = ref(false);
const showCreate = ref(false);
const creating = ref(false);
const form = ref({
    name: '',
    type: 'remote',
    url: '',
    authToken: '',
});
async function load() {
    loading.value = true;
    try {
        servers.value = await listMcpServers();
    }
    catch {
        // 静默
    }
    finally {
        loading.value = false;
    }
}
async function onCreate() {
    if (!form.value.name.trim()) {
        toast.error('请填写名称');
        return;
    }
    if (form.value.type === 'remote' && !form.value.url.trim()) {
        toast.error('请填写 URL');
        return;
    }
    creating.value = true;
    try {
        await createMcpServer({
            name: form.value.name,
            type: form.value.type,
            url: form.value.url || undefined,
            authToken: form.value.authToken || undefined,
        });
        toast.success('MCP Server 创建成功');
        showCreate.value = false;
        form.value = { name: '', type: 'remote', url: '', authToken: '' };
        await load();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '创建失败');
    }
    finally {
        creating.value = false;
    }
}
async function onDelete(id) {
    if (!confirm('确定删除此 MCP Server？'))
        return;
    try {
        await deleteMcpServer(id);
        toast.success('已删除');
        await load();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '删除失败');
    }
}
onMounted(() => {
    load();
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: (({ maxWidth: '900px', margin: '0 auto', padding: '28px 28px 40px' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between mb-6") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-[22px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showCreate = true;
        }
    };
    let __VLS_2;
    let __VLS_3;
    const __VLS_7 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({ size: ((15)), }));
    const __VLS_9 = __VLS_8({ size: ((15)), }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    if (__VLS_ctx.loading) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-center py-12") }, });
        const __VLS_13 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
        /** @type { [typeof __VLS_components.Loader2, ] } */
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({ size: ((24)), ...{ class: ("animate-spin") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_15 = __VLS_14({ size: ((24)), ...{ class: ("animate-spin") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    }
    else if (__VLS_ctx.servers.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col items-center justify-center py-12 gap-3") }, });
        const __VLS_19 = __VLS_resolvedLocalAndGlobalComponents.Cpu;
        /** @type { [typeof __VLS_components.Cpu, ] } */
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({ size: ((40)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_21 = __VLS_20({ size: ((40)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs text-center max-w-md") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.br)({});
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), }));
        const __VLS_26 = __VLS_25({ ...{ 'onClick': {} }, size: ("sm"), }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        let __VLS_30;
        const __VLS_31 = {
            onClick: (...[$event]) => {
                if (!(!((__VLS_ctx.loading))))
                    return;
                if (!((__VLS_ctx.servers.length === 0)))
                    return;
                __VLS_ctx.showCreate = true;
            }
        };
        let __VLS_27;
        let __VLS_28;
        const __VLS_32 = __VLS_resolvedLocalAndGlobalComponents.Plus;
        /** @type { [typeof __VLS_components.Plus, ] } */
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({ size: ((14)), }));
        const __VLS_34 = __VLS_33({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        __VLS_nonNullable(__VLS_29.slots).default;
        var __VLS_29;
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3") }, });
        for (const [s] of __VLS_getVForSourceType((__VLS_ctx.servers))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((s.id)), ...{ class: ("rounded-xl p-4 flex items-center gap-4") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
            const __VLS_38 = ((s.status === 'active' ? __VLS_ctx.CheckCircle2 : __VLS_ctx.AlertCircle));
            // @ts-ignore
            const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({ size: ((20)), ...{ style: (({ color: s.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' })) }, }));
            const __VLS_40 = __VLS_39({ size: ((20)), ...{ style: (({ color: s.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_39));
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-w-0 flex flex-col gap-1") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
            (s.name);
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[10px] px-1.5 py-0.5 rounded-full") }, ...{ style: (({ background: 'var(--muted)', color: 'var(--muted-foreground)' })) }, });
            (s.type);
            if (s.url) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs font-mono truncate") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
                (s.url);
            }
            if (s.gatewayUrl) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1 mt-0.5") }, });
                const __VLS_44 = __VLS_resolvedLocalAndGlobalComponents.Shield;
                /** @type { [typeof __VLS_components.Shield, ] } */
                // @ts-ignore
                const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({ size: ((11)), ...{ style: (({ color: 'var(--status-running)' })) }, }));
                const __VLS_46 = __VLS_45({ size: ((11)), ...{ style: (({ color: 'var(--status-running)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_45));
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[10px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            }
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!(!((__VLS_ctx.loading))))
                            return;
                        if (!(!((__VLS_ctx.servers.length === 0))))
                            return;
                        __VLS_ctx.onDelete(s.id);
                    } }, ...{ class: ("cursor-pointer p-2 rounded-lg shrink-0") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
            const __VLS_50 = __VLS_resolvedLocalAndGlobalComponents.Trash2;
            /** @type { [typeof __VLS_components.Trash2, ] } */
            // @ts-ignore
            const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({ size: ((16)), }));
            const __VLS_52 = __VLS_51({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        }
    }
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showCreate)), title: ("添加 MCP Server"), }));
    const __VLS_57 = __VLS_56({ modelValue: ((__VLS_ctx.showCreate)), title: ("添加 MCP Server"), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-4 p-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("如：jira-mcp"), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' })) }, });
    (__VLS_ctx.form.name);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({ value: ((__VLS_ctx.form.type)), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ value: ("remote"), });
    __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ value: ("local"), });
    if (__VLS_ctx.form.type === 'remote') {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("https://mcp.example.com/sse"), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (__VLS_ctx.form.url);
    }
    if (__VLS_ctx.form.type === 'remote') {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ type: ("password"), placeholder: ("Bearer token（存到 Higress）"), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (__VLS_ctx.form.authToken);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_60.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("secondary"), }));
        const __VLS_62 = __VLS_61({ ...{ 'onClick': {} }, variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        let __VLS_66;
        const __VLS_67 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showCreate = false;
            }
        };
        let __VLS_63;
        let __VLS_64;
        __VLS_nonNullable(__VLS_65.slots).default;
        var __VLS_65;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_68 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.creating)), }));
        const __VLS_69 = __VLS_68({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.creating)), }, ...__VLS_functionalComponentArgsRest(__VLS_68));
        let __VLS_73;
        const __VLS_74 = {
            onClick: (__VLS_ctx.onCreate)
        };
        let __VLS_70;
        let __VLS_71;
        if (__VLS_ctx.creating) {
            const __VLS_75 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
            /** @type { [typeof __VLS_components.Loader2, ] } */
            // @ts-ignore
            const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({ size: ((14)), ...{ class: ("animate-spin") }, }));
            const __VLS_77 = __VLS_76({ size: ((14)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_76));
        }
        (__VLS_ctx.creating ? '创建中...' : '创建');
        __VLS_nonNullable(__VLS_72.slots).default;
        var __VLS_72;
    }
    var __VLS_60;
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['text-[22px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['py-12'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['py-12'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['max-w-md'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-[10px]'];
    __VLS_styleScopedClasses['px-1.5'];
    __VLS_styleScopedClasses['py-0.5'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['mt-0.5'];
    __VLS_styleScopedClasses['text-[10px]'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['animate-spin'];
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
            Trash2: Trash2,
            Cpu: Cpu,
            Loader2: Loader2,
            CheckCircle2: CheckCircle2,
            AlertCircle: AlertCircle,
            Shield: Shield,
            Btn: Btn,
            Modal: Modal,
            servers: servers,
            loading: loading,
            showCreate: showCreate,
            creating: creating,
            form: form,
            onCreate: onCreate,
            onDelete: onDelete,
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
