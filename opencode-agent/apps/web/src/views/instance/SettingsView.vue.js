import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInstancesStore } from '@/stores/instances';
import { useWizardStore } from '@/stores/wizard';
import { useToastStore } from '@/stores/toast';
import { parseConfig } from '@opencode/shared';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Btn from '@/components/ui/Btn.vue';
import { ApiRequestError } from '@/api/client';
import { Loader2, RotateCcw, CheckCircle2, History } from 'lucide-vue-next';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const router = useRouter();
const instances = useInstancesStore();
const toast = useToastStore();
const wizard = useWizardStore();
const instanceId = String(route.params.id);
const showDelete = ref(false);
const deleteConfirm = ref('');
const updating = ref(false);
const showEditModal = ref(false);
const editDisplayName = ref('');
const rollbacking = ref(null);
const versions = computed(() => instances.versions);
onMounted(async () => {
    await instances.fetchOne(instanceId);
    await instances.fetchVersions(instanceId);
    editDisplayName.value = instances.current?.displayName ?? '';
});
// 编辑配置：把当前 configJson 灌进向导，用户改完走 PUT（部署新版本）
function editConfig() {
    if (!instances.current?.configJson)
        return;
    try {
        const obj = JSON.parse(instances.current.configJson);
        wizard.form = parseConfig(obj, {
            name: instances.current.displayName,
            namespace: instances.current.namespace,
        });
    }
    catch {
        // 解析失败用空表单
    }
    router.push({ name: 'wizard' }); // 复用向导，但提交时走 update
}
// 在向导模式下标记「编辑」提交：用 localStorage 传 instanceId 给 WizardView
// （WizardView 检测到 editingInstanceId 就走 PUT 而非 POST）
function editConfigInWizard() {
    if (instances.current) {
        localStorage.setItem('oma:editingInstanceId', String(instances.current.id));
        localStorage.setItem('oma:editingGroupId', instances.current.groupId);
    }
    editConfig();
}
async function updateDisplayName() {
    if (!editDisplayName.value.trim()) {
        toast.error('展示名称不能为空');
        return;
    }
    updating.value = true;
    try {
        // 用 PUT 部署新版本（仅改 displayName，configJson 沿用）
        await instances.update(instanceId, {
            displayName: editDisplayName.value,
            configJson: instances.current.configJson,
            provider: instances.current.provider ?? '',
            modelId: instances.current.modelId ?? '',
            agentType: instances.current.version ?? 'opencode',
        });
        toast.success('展示名称已更新（已部署新版本）');
        showEditModal.value = false;
        await instances.fetchVersions(instanceId);
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '更新失败');
    }
    finally {
        updating.value = false;
    }
}
async function onRollback(versionNum) {
    if (!confirm(`确定回滚到 v${versionNum}？当前活跃版本将被停止。`))
        return;
    rollbacking.value = versionNum;
    try {
        const res = await instances.rollback(instanceId, versionNum);
        toast.success(res.message ?? `已回滚到 v${versionNum}`);
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '回滚失败');
    }
    finally {
        rollbacking.value = null;
    }
}
async function restart() {
    if (!confirm('确定重启实例？'))
        return;
    try {
        await instances.restart(instanceId);
        toast.success('已发送重启请求');
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '重启失败');
    }
}
async function remove() {
    if (deleteConfirm.value !== instances.current?.displayName) {
        toast.error('展示名不匹配');
        return;
    }
    try {
        await instances.remove(instanceId);
        toast.success('实例已删除');
        router.push('/');
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '删除失败');
    }
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("h-full overflow-y-auto") }, ...{ style: (({ padding: '24px 32px', background: 'var(--background)', maxWidth: '760px' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-xl font-semibold mb-6") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({ ...{ class: ("rounded-xl p-5 mb-5") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-sm font-semibold mb-4") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2.5 text-sm") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("flex-1") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.instances.current?.displayName);
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (...[$event]) => {
            __VLS_ctx.editDisplayName = __VLS_ctx.instances.current?.displayName ?? '';
            __VLS_ctx.showEditModal = true;
        }
    };
    let __VLS_2;
    let __VLS_3;
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.instances.current?.groupId);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.instances.current?.versionNum);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.instances.current?.namespace);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    if (__VLS_ctx.instances.current) {
        // @ts-ignore
        [Badge,];
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((__VLS_ctx.instances.current.status)), dot: (true), }));
        const __VLS_8 = __VLS_7({ status: ((__VLS_ctx.instances.current.status)), dot: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("w-28 shrink-0") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.instances.current?.createdAt);
    __VLS_elementAsFunction(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({ ...{ class: ("rounded-xl p-5 mb-5") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 mb-4") }, });
    const __VLS_12 = __VLS_resolvedLocalAndGlobalComponents.History;
    /** @type { [typeof __VLS_components.History, ] } */
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({ size: ((15)), ...{ style: (({ color: 'var(--foreground)' })) }, }));
    const __VLS_14 = __VLS_13({ size: ((15)), ...{ style: (({ color: 'var(--foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    if (__VLS_ctx.versions.length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    else {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
        for (const [v] of __VLS_getVForSourceType(([...__VLS_ctx.versions].reverse()))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((v.id)), ...{ class: ("flex items-center gap-3 rounded-lg p-3") }, ...{ style: (({
                        border: '1px solid var(--border)',
                        background: v.isActive ? 'color-mix(in srgb, var(--chart-2) 8%, transparent)' : 'transparent',
                    })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 flex flex-col gap-1") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-mono font-semibold") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
            (v.versionNum);
            if (v.isActive) {
                const __VLS_18 = __VLS_resolvedLocalAndGlobalComponents.CheckCircle2;
                /** @type { [typeof __VLS_components.CheckCircle2, ] } */
                // @ts-ignore
                const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({ size: ((13)), ...{ style: (({ color: 'var(--chart-2)' })) }, }));
                const __VLS_20 = __VLS_19({ size: ((13)), ...{ style: (({ color: 'var(--chart-2)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_19));
            }
            if (v.isActive) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[10px] px-1.5 py-0.5 rounded-full") }, ...{ style: (({ background: 'var(--chart-2)', color: 'white' })) }, });
            }
            // @ts-ignore
            [Badge,];
            // @ts-ignore
            const __VLS_24 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((v.status)), }));
            const __VLS_25 = __VLS_24({ status: ((v.status)), }, ...__VLS_functionalComponentArgsRest(__VLS_24));
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-[11px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            (v.updatedAt);
            if (!v.isActive) {
                // @ts-ignore
                [Btn, Btn,];
                // @ts-ignore
                const __VLS_29 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), disabled: ((__VLS_ctx.rollbacking !== null)), }));
                const __VLS_30 = __VLS_29({ ...{ 'onClick': {} }, size: ("sm"), variant: ("secondary"), disabled: ((__VLS_ctx.rollbacking !== null)), }, ...__VLS_functionalComponentArgsRest(__VLS_29));
                let __VLS_34;
                const __VLS_35 = {
                    onClick: (...[$event]) => {
                        if (!(!((__VLS_ctx.versions.length === 0))))
                            return;
                        if (!((!v.isActive)))
                            return;
                        __VLS_ctx.onRollback(v.versionNum);
                    }
                };
                let __VLS_31;
                let __VLS_32;
                if (__VLS_ctx.rollbacking === v.versionNum) {
                    const __VLS_36 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
                    /** @type { [typeof __VLS_components.Loader2, ] } */
                    // @ts-ignore
                    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({ size: ((13)), ...{ class: ("animate-spin") }, }));
                    const __VLS_38 = __VLS_37({ size: ((13)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                }
                else {
                    const __VLS_42 = __VLS_resolvedLocalAndGlobalComponents.RotateCcw;
                    /** @type { [typeof __VLS_components.RotateCcw, ] } */
                    // @ts-ignore
                    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({ size: ((13)), }));
                    const __VLS_44 = __VLS_43({ size: ((13)), }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                }
                __VLS_nonNullable(__VLS_33.slots).default;
                var __VLS_33;
            }
        }
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mt-3") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({ ...{ class: ("rounded-xl p-5 mb-5") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-sm font-semibold mb-4") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-2") }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("secondary"), }));
    const __VLS_49 = __VLS_48({ ...{ 'onClick': {} }, variant: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    let __VLS_53;
    const __VLS_54 = {
        onClick: (__VLS_ctx.editConfigInWizard)
    };
    let __VLS_50;
    let __VLS_51;
    __VLS_nonNullable(__VLS_52.slots).default;
    var __VLS_52;
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), }));
    const __VLS_56 = __VLS_55({ ...{ 'onClick': {} }, variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    let __VLS_60;
    const __VLS_61 = {
        onClick: (__VLS_ctx.restart)
    };
    let __VLS_57;
    let __VLS_58;
    __VLS_nonNullable(__VLS_59.slots).default;
    var __VLS_59;
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mt-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({ ...{ class: ("rounded-xl p-5") }, ...{ style: (({ border: '1px solid var(--destructive)', background: 'var(--card)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({ ...{ class: ("text-sm font-semibold mb-4") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("destructive"), }));
    const __VLS_63 = __VLS_62({ ...{ 'onClick': {} }, variant: ("destructive"), }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_67;
    const __VLS_68 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showDelete = true;
        }
    };
    let __VLS_64;
    let __VLS_65;
    __VLS_nonNullable(__VLS_66.slots).default;
    var __VLS_66;
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs mt-2") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showEditModal)), title: ("修改展示名"), width: ("440px"), }));
    const __VLS_70 = __VLS_69({ modelValue: ((__VLS_ctx.showEditModal)), title: ("修改展示名"), width: ("440px"), }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2 p-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ class: ("w-full") }, ...{ style: (({ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' })) }, });
    (__VLS_ctx.editDisplayName);
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[11px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_73.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_74 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), }));
        const __VLS_75 = __VLS_74({ ...{ 'onClick': {} }, variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_74));
        let __VLS_79;
        const __VLS_80 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showEditModal = false;
            }
        };
        let __VLS_76;
        let __VLS_77;
        __VLS_nonNullable(__VLS_78.slots).default;
        var __VLS_78;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.updating)), }));
        const __VLS_82 = __VLS_81({ ...{ 'onClick': {} }, disabled: ((__VLS_ctx.updating)), }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        let __VLS_86;
        const __VLS_87 = {
            onClick: (__VLS_ctx.updateDisplayName)
        };
        let __VLS_83;
        let __VLS_84;
        if (__VLS_ctx.updating) {
            const __VLS_88 = __VLS_resolvedLocalAndGlobalComponents.Loader2;
            /** @type { [typeof __VLS_components.Loader2, ] } */
            // @ts-ignore
            const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({ size: ((14)), ...{ class: ("animate-spin") }, }));
            const __VLS_90 = __VLS_89({ size: ((14)), ...{ class: ("animate-spin") }, }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        }
        (__VLS_ctx.updating ? '保存中...' : '保存');
        __VLS_nonNullable(__VLS_85.slots).default;
        var __VLS_85;
    }
    var __VLS_73;
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_94 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showDelete)), title: ("删除实例"), width: ("440px"), }));
    const __VLS_95 = __VLS_94({ modelValue: ((__VLS_ctx.showDelete)), title: ("删除实例"), width: ("440px"), }, ...__VLS_functionalComponentArgsRest(__VLS_94));
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm mb-3") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, ...{ style: (({ fontFamily: 'var(--font-mono)' })) }, });
    (__VLS_ctx.instances.current?.displayName);
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm mb-2") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ((__VLS_ctx.instances.current?.displayName)), ...{ class: ("w-full") }, ...{ style: (({ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' })) }, });
    (__VLS_ctx.deleteConfirm);
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_98.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_99 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), }));
        const __VLS_100 = __VLS_99({ ...{ 'onClick': {} }, variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
        let __VLS_104;
        const __VLS_105 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showDelete = false;
            }
        };
        let __VLS_101;
        let __VLS_102;
        __VLS_nonNullable(__VLS_103.slots).default;
        var __VLS_103;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_106 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("destructive"), }));
        const __VLS_107 = __VLS_106({ ...{ 'onClick': {} }, variant: ("destructive"), }, ...__VLS_functionalComponentArgsRest(__VLS_106));
        let __VLS_111;
        const __VLS_112 = {
            onClick: (__VLS_ctx.remove)
        };
        let __VLS_108;
        let __VLS_109;
        __VLS_nonNullable(__VLS_110.slots).default;
        var __VLS_110;
    }
    var __VLS_98;
    __VLS_styleScopedClasses['h-full'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['text-xl'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['mb-5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['w-28'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['mb-5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['mb-4'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['p-3'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['text-[10px]'];
    __VLS_styleScopedClasses['px-1.5'];
    __VLS_styleScopedClasses['py-0.5'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mt-3'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['mb-5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mt-2'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-4'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mt-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['p-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['animate-spin'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['mb-3'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['mb-2'];
    __VLS_styleScopedClasses['w-full'];
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
            Badge: Badge,
            Modal: Modal,
            Btn: Btn,
            Loader2: Loader2,
            RotateCcw: RotateCcw,
            CheckCircle2: CheckCircle2,
            History: History,
            instances: instances,
            showDelete: showDelete,
            deleteConfirm: deleteConfirm,
            updating: updating,
            showEditModal: showEditModal,
            editDisplayName: editDisplayName,
            rollbacking: rollbacking,
            versions: versions,
            editConfigInWizard: editConfigInWizard,
            updateDisplayName: updateDisplayName,
            onRollback: onRollback,
            restart: restart,
            remove: remove,
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
