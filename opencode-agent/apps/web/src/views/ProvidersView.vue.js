import { ref, onMounted } from 'vue';
import { Plus, Trash2, Key, Loader2, CheckCircle2, AlertCircle, Pencil, FlaskConical, X } from 'lucide-vue-next';
import { listProviders, createProvider, deleteProvider, updateProvider, testProvider } from '@/api/proxy';
import { useToastStore } from '@/stores/toast';
import { ApiRequestError } from '@/api/client';
import Btn from '@/components/ui/Btn.vue';
import Modal from '@/components/ui/Modal.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const toast = useToastStore();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers = ref([]);
const loading = ref(false);
const showCreate = ref(false);
// 创建表单
const form = ref({
    name: '',
    template: 'deepseek',
    apiKey: '',
    baseUrl: '',
});
// 创建时可编辑的模型列表（从模板预填，用户可改）
const formModels = ref([]);
const newModelInput = ref('');
const creating = ref(false);
const TEMPLATES = [
    { id: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-v4-flash'] },
    { id: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
    { id: 'moonshot', label: 'Moonshot (Kimi)', defaultUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
    { id: 'qwen', label: '通义千问', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus'] },
    { id: 'custom', label: '自定义 (OpenAI 兼容)', defaultUrl: '', models: [] },
];
// ===== 编辑模型 Modal =====
const showEdit = ref(false);
const editingId = ref(null);
const editingModels = ref([]);
const editNewInput = ref('');
const savingModels = ref(false);
// ===== 测试连接状态 =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testing = ref({});
async function load() {
    loading.value = true;
    try {
        providers.value = await listProviders();
    }
    catch {
        // 静默
    }
    finally {
        loading.value = false;
    }
}
function onTemplateChange() {
    const t = TEMPLATES.find((x) => x.id === form.value.template);
    if (t) {
        form.value.baseUrl = t.defaultUrl;
        formModels.value = [...t.models];
    }
}
function addFormModel() {
    const m = newModelInput.value.trim();
    if (m && !formModels.value.includes(m))
        formModels.value.push(m);
    newModelInput.value = '';
}
function removeFormModel(i) {
    formModels.value.splice(i, 1);
}
async function onCreate() {
    if (!form.value.name.trim() || !form.value.apiKey.trim()) {
        toast.error('请填写名称和 API Key');
        return;
    }
    if (formModels.value.length === 0) {
        toast.error('请至少添加一个模型');
        return;
    }
    creating.value = true;
    try {
        await createProvider({
            name: form.value.name,
            template: form.value.template,
            apiKey: form.value.apiKey,
            baseUrl: form.value.baseUrl || undefined,
            models: formModels.value,
        });
        toast.success('LLM Provider 创建成功');
        showCreate.value = false;
        form.value = { name: '', template: 'deepseek', apiKey: '', baseUrl: '' };
        formModels.value = [];
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
    if (!confirm('确定删除此 Provider？关联的 Higress 资源也会一并清理。'))
        return;
    try {
        await deleteProvider(id);
        toast.success('已删除');
        await load();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '删除失败');
    }
}
// ===== 编辑模型 =====
function openEdit(p) {
    editingId.value = p.id;
    editingModels.value = [...(p.models ?? [])];
    editNewInput.value = '';
    showEdit.value = true;
}
function addEditModel() {
    const m = editNewInput.value.trim();
    if (m && !editingModels.value.includes(m))
        editingModels.value.push(m);
    editNewInput.value = '';
}
function removeEditModel(i) {
    editingModels.value.splice(i, 1);
}
async function saveModels() {
    if (!editingId.value)
        return;
    if (editingModels.value.length === 0) {
        toast.error('请至少保留一个模型');
        return;
    }
    savingModels.value = true;
    try {
        await updateProvider(editingId.value, { models: editingModels.value });
        toast.success('模型列表已更新');
        showEdit.value = false;
        await load();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '更新失败');
    }
    finally {
        savingModels.value = false;
    }
}
// ===== 测试连接 =====
async function onTest(id) {
    testing.value[id] = { loading: true };
    try {
        const r = await testProvider(id);
        testing.value[id] = r;
        if (r.ok) {
            toast.success(`连通正常（${r.latencyMs}ms）`);
        }
        else {
            toast.error(`测试失败：${r.error ?? '未知错误'}`);
        }
    }
    catch (e) {
        testing.value[id] = { ok: false, error: e instanceof ApiRequestError ? e.message : '请求失败' };
        toast.error(e instanceof ApiRequestError ? e.message : '测试失败');
    }
}
function templateLabel(id) {
    return TEMPLATES.find((x) => x.id === id)?.label ?? id;
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
    else if (__VLS_ctx.providers.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col items-center justify-center py-12 gap-3") }, });
        const __VLS_19 = __VLS_resolvedLocalAndGlobalComponents.Key;
        /** @type { [typeof __VLS_components.Key, ] } */
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({ size: ((40)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_21 = __VLS_20({ size: ((40)), ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
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
                if (!((__VLS_ctx.providers.length === 0)))
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
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3 max-w-3xl") }, });
        for (const [p] of __VLS_getVForSourceType((__VLS_ctx.providers))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((p.id)), ...{ class: ("rounded-xl p-4 flex items-center gap-4") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
            const __VLS_38 = ((p.status === 'active' ? __VLS_ctx.CheckCircle2 : __VLS_ctx.AlertCircle));
            // @ts-ignore
            const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({ size: ((20)), ...{ style: (({ color: p.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' })) }, }));
            const __VLS_40 = __VLS_39({ size: ((20)), ...{ style: (({ color: p.status === 'active' ? 'var(--status-running)' : 'var(--destructive)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_39));
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-w-0 flex flex-col gap-1") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
            (p.name);
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[10px] px-1.5 py-0.5 rounded-full") }, ...{ style: (({ background: 'var(--accent)', color: 'var(--accent-foreground)' })) }, });
            (__VLS_ctx.templateLabel(p.template));
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs font-mono truncate") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
            (p.baseUrl);
            if (p.models && p.models.length > 0) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1 flex-wrap mt-0.5") }, });
                for (const [m] of __VLS_getVForSourceType((p.models))) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ key: ((m)), ...{ class: ("text-[10px] px-1.5 py-0.5 rounded") }, ...{ style: (({ background: 'var(--muted)', color: 'var(--muted-foreground)' })) }, });
                    (m);
                }
            }
            if (__VLS_ctx.testing[p.id]) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("text-[11px] mt-0.5 flex items-center gap-1.5") }, ...{ style: (({ color: __VLS_ctx.testing[p.id].ok ? 'var(--status-running)' : 'var(--destructive)' })) }, });
                if (__VLS_ctx.testing[p.id].loading) {
                    const __VLS_44 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
                    /** @type { [typeof __VLS_components.Loader2, ] } */
                    // @ts-ignore
                    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({ size: ((11)), ...{ class: ("animate-spin") }, }));
                    const __VLS_46 = __VLS_45({ size: ((11)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_45));
                }
                else if (__VLS_ctx.testing[p.id].ok) {
                    const __VLS_50 = __VLS_resolvedLocalAndGlobalComponents.CheckCircle2;
                    /** @type { [typeof __VLS_components.CheckCircle2, ] } */
                    // @ts-ignore
                    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({ size: ((11)), }));
                    const __VLS_52 = __VLS_51({ size: ((11)), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                    (__VLS_ctx.testing[p.id].latencyMs);
                    if (__VLS_ctx.testing[p.id].sampleModels?.length) {
                        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
                        (__VLS_ctx.testing[p.id].sampleModels.join(', '));
                    }
                }
                else {
                    const __VLS_56 = __VLS_resolvedLocalAndGlobalComponents.AlertCircle;
                    /** @type { [typeof __VLS_components.AlertCircle, ] } */
                    // @ts-ignore
                    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({ size: ((11)), }));
                    const __VLS_58 = __VLS_57({ size: ((11)), }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                    (__VLS_ctx.testing[p.id].error ?? '失败');
                }
            }
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1 shrink-0") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!(!((__VLS_ctx.loading))))
                            return;
                        if (!(!((__VLS_ctx.providers.length === 0))))
                            return;
                        __VLS_ctx.onTest(p.id);
                    } }, ...{ class: ("cursor-pointer p-2 rounded-lg") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, disabled: ((__VLS_ctx.testing[p.id]?.loading)), title: ("测试连接"), });
            if (__VLS_ctx.testing[p.id]?.loading) {
                const __VLS_62 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
                /** @type { [typeof __VLS_components.Loader2, ] } */
                // @ts-ignore
                const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({ size: ((16)), ...{ class: ("animate-spin") }, }));
                const __VLS_64 = __VLS_63({ size: ((16)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_63));
            }
            else {
                const __VLS_68 = __VLS_resolvedLocalAndGlobalComponents.FlaskConical;
                /** @type { [typeof __VLS_components.FlaskConical, ] } */
                // @ts-ignore
                const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({ size: ((16)), }));
                const __VLS_70 = __VLS_69({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
            }
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!(!((__VLS_ctx.loading))))
                            return;
                        if (!(!((__VLS_ctx.providers.length === 0))))
                            return;
                        __VLS_ctx.openEdit(p);
                    } }, ...{ class: ("cursor-pointer p-2 rounded-lg") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, title: ("编辑模型"), });
            const __VLS_74 = __VLS_resolvedLocalAndGlobalComponents.Pencil;
            /** @type { [typeof __VLS_components.Pencil, ] } */
            // @ts-ignore
            const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({ size: ((16)), }));
            const __VLS_76 = __VLS_75({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_75));
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!(!((__VLS_ctx.loading))))
                            return;
                        if (!(!((__VLS_ctx.providers.length === 0))))
                            return;
                        __VLS_ctx.onDelete(p.id);
                    } }, ...{ class: ("cursor-pointer p-2 rounded-lg shrink-0") }, ...{ style: (({ color: 'var(--destructive)' })) }, title: ("删除"), });
            const __VLS_80 = __VLS_resolvedLocalAndGlobalComponents.Trash2;
            /** @type { [typeof __VLS_components.Trash2, ] } */
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({ size: ((16)), }));
            const __VLS_82 = __VLS_81({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        }
    }
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showCreate)), title: ("添加 LLM Provider"), width: ("540px"), }));
    const __VLS_87 = __VLS_86({ modelValue: ((__VLS_ctx.showCreate)), title: ("添加 LLM Provider"), width: ("540px"), }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-4 p-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("例如：DeepSeek"), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' })) }, });
    (__VLS_ctx.form.name);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({ ...{ onChange: (__VLS_ctx.onTemplateChange) }, value: ((__VLS_ctx.form.template)), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)' })) }, });
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.TEMPLATES))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({ key: ((t.id)), value: ((t.id)), });
        (t.label);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--destructive)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ type: ("password"), placeholder: ("sk-..."), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.form.apiKey);
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[11px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("https://api.deepseek.com/v1"), ...{ class: ("h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.form.baseUrl);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--destructive)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onKeydown: (__VLS_ctx.addFormModel) }, placeholder: ("输入模型名后回车，如 deepseek-chat"), ...{ class: ("flex-1 h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.newModelInput);
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), }));
    const __VLS_92 = __VLS_91({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_96;
    const __VLS_97 = {
        onClick: (__VLS_ctx.addFormModel)
    };
    let __VLS_93;
    let __VLS_94;
    const __VLS_98 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({ size: ((14)), }));
    const __VLS_100 = __VLS_99({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    __VLS_nonNullable(__VLS_95.slots).default;
    var __VLS_95;
    if (__VLS_ctx.formModels.length > 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1.5 flex-wrap mt-1") }, });
        for (const [m, i] of __VLS_getVForSourceType((__VLS_ctx.formModels))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ key: ((m)), ...{ class: ("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded") }, ...{ style: (({ background: 'var(--muted)', color: 'var(--foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, });
            (m);
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!((__VLS_ctx.formModels.length > 0)))
                            return;
                        __VLS_ctx.removeFormModel(i);
                    } }, ...{ class: ("cursor-pointer") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            const __VLS_104 = __VLS_resolvedLocalAndGlobalComponents.X;
            /** @type { [typeof __VLS_components.X, ] } */
            // @ts-ignore
            const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({ size: ((11)), }));
            const __VLS_106 = __VLS_105({ size: ((11)), }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        }
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[11px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_90.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_110 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("secondary"), }));
        const __VLS_111 = __VLS_110({ ...{ 'onClick': {} }, variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_110));
        let __VLS_115;
        const __VLS_116 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showCreate = false;
            }
        };
        let __VLS_112;
        let __VLS_113;
        __VLS_nonNullable(__VLS_114.slots).default;
        var __VLS_114;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.creating)), }));
        const __VLS_118 = __VLS_117({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.creating)), }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        let __VLS_122;
        const __VLS_123 = {
            onClick: (__VLS_ctx.onCreate)
        };
        let __VLS_119;
        let __VLS_120;
        if (__VLS_ctx.creating) {
            const __VLS_124 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
            /** @type { [typeof __VLS_components.Loader2, ] } */
            // @ts-ignore
            const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({ size: ((14)), ...{ class: ("animate-spin") }, }));
            const __VLS_126 = __VLS_125({ size: ((14)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        }
        (__VLS_ctx.creating ? '创建中...' : '创建');
        __VLS_nonNullable(__VLS_121.slots).default;
        var __VLS_121;
    }
    var __VLS_90;
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_130 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showEdit)), title: ("编辑模型列表"), width: ("480px"), }));
    const __VLS_131 = __VLS_130({ modelValue: ((__VLS_ctx.showEdit)), title: ("编辑模型列表"), width: ("480px"), }, ...__VLS_functionalComponentArgsRest(__VLS_130));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3 p-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onKeydown: (__VLS_ctx.addEditModel) }, placeholder: ("输入模型名后回车添加"), ...{ class: ("flex-1 h-9 px-3 rounded-lg text-sm border outline-none font-mono") }, ...{ style: (({ background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.editNewInput);
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_135 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), }));
    const __VLS_136 = __VLS_135({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_135));
    let __VLS_140;
    const __VLS_141 = {
        onClick: (__VLS_ctx.addEditModel)
    };
    let __VLS_137;
    let __VLS_138;
    const __VLS_142 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_143 = __VLS_asFunctionalComponent(__VLS_142, new __VLS_142({ size: ((14)), }));
    const __VLS_144 = __VLS_143({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_143));
    __VLS_nonNullable(__VLS_139.slots).default;
    var __VLS_139;
    if (__VLS_ctx.editingModels.length > 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1.5 flex-wrap") }, });
        for (const [m, i] of __VLS_getVForSourceType((__VLS_ctx.editingModels))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ key: ((m)), ...{ class: ("inline-flex items-center gap-1 text-xs px-2 py-1 rounded") }, ...{ style: (({ background: 'var(--muted)', color: 'var(--foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, });
            (m);
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!((__VLS_ctx.editingModels.length > 0)))
                            return;
                        __VLS_ctx.removeEditModel(i);
                    } }, ...{ class: ("cursor-pointer") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            const __VLS_148 = __VLS_resolvedLocalAndGlobalComponents.X;
            /** @type { [typeof __VLS_components.X, ] } */
            // @ts-ignore
            const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({ size: ((12)), }));
            const __VLS_150 = __VLS_149({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        }
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_134.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_154 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("secondary"), }));
        const __VLS_155 = __VLS_154({ ...{ 'onClick': {} }, variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_154));
        let __VLS_159;
        const __VLS_160 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showEdit = false;
            }
        };
        let __VLS_156;
        let __VLS_157;
        __VLS_nonNullable(__VLS_158.slots).default;
        var __VLS_158;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.savingModels)), }));
        const __VLS_162 = __VLS_161({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.savingModels)), }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        let __VLS_166;
        const __VLS_167 = {
            onClick: (__VLS_ctx.saveModels)
        };
        let __VLS_163;
        let __VLS_164;
        if (__VLS_ctx.savingModels) {
            const __VLS_168 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
            /** @type { [typeof __VLS_components.Loader2, ] } */
            // @ts-ignore
            const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({ size: ((14)), ...{ class: ("animate-spin") }, }));
            const __VLS_170 = __VLS_169({ size: ((14)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_169));
        }
        (__VLS_ctx.savingModels ? '保存中...' : '保存');
        __VLS_nonNullable(__VLS_165.slots).default;
        var __VLS_165;
    }
    var __VLS_134;
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
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['max-w-3xl'];
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
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['mt-0.5'];
    __VLS_styleScopedClasses['text-[10px]'];
    __VLS_styleScopedClasses['px-1.5'];
    __VLS_styleScopedClasses['py-0.5'];
    __VLS_styleScopedClasses['rounded'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['mt-0.5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['rounded-lg'];
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
    __VLS_styleScopedClasses['text-[11px]'];
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
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['mt-1'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['px-2'];
    __VLS_styleScopedClasses['py-0.5'];
    __VLS_styleScopedClasses['rounded'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['inline-flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['px-2'];
    __VLS_styleScopedClasses['py-1'];
    __VLS_styleScopedClasses['rounded'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['text-xs'];
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
            Key: Key,
            Loader2: Loader2,
            CheckCircle2: CheckCircle2,
            AlertCircle: AlertCircle,
            Pencil: Pencil,
            FlaskConical: FlaskConical,
            X: X,
            Btn: Btn,
            Modal: Modal,
            providers: providers,
            loading: loading,
            showCreate: showCreate,
            form: form,
            formModels: formModels,
            newModelInput: newModelInput,
            creating: creating,
            TEMPLATES: TEMPLATES,
            showEdit: showEdit,
            editingModels: editingModels,
            editNewInput: editNewInput,
            savingModels: savingModels,
            testing: testing,
            onTemplateChange: onTemplateChange,
            addFormModel: addFormModel,
            removeFormModel: removeFormModel,
            onCreate: onCreate,
            onDelete: onDelete,
            openEdit: openEdit,
            addEditModel: addEditModel,
            removeEditModel: removeEditModel,
            saveModels: saveModels,
            onTest: onTest,
            templateLabel: templateLabel,
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
