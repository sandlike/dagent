import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Upload, Info, Trash2 } from 'lucide-vue-next';
import { listSkills, uploadSkill, deleteSkill } from '@/api/proxy';
import { useToastStore } from '@/stores/toast';
import Badge from '@/components/ui/Badge.vue';
import Btn from '@/components/ui/Btn.vue';
import Modal from '@/components/ui/Modal.vue';
import { ApiRequestError } from '@/api/client';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const route = useRoute();
const toast = useToastStore();
const instanceId = String(route.params.id);
const skills = ref([]);
const loading = ref(false);
const showUpload = ref(false);
const newName = ref('');
const newFile = ref(null);
async function fetchSkills() {
    loading.value = true;
    try {
        skills.value = await listSkills(instanceId);
    }
    catch {
        // 后端/sidecar 未就绪时静默
    }
    finally {
        loading.value = false;
    }
}
function onFile(e) {
    const f = e.target.files?.[0];
    if (f)
        newFile.value = f;
}
async function doUpload() {
    if (!newFile.value) {
        toast.error('请选择 zip 文件');
        return;
    }
    const name = newName.value.trim() || newFile.value.name.replace(/\.zip$/i, '');
    try {
        await uploadSkill(instanceId, name, newFile.value);
        toast.success('Skill 已上传，立即生效');
        showUpload.value = false;
        newName.value = '';
        newFile.value = null;
        await fetchSkills();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '上传失败');
    }
}
async function remove(name) {
    if (!confirm(`确定卸载 Skill "${name}"？卸载后立即生效。`))
        return;
    try {
        await deleteSkill(instanceId, name);
        toast.success('已卸载');
        await fetchSkills();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '卸载失败');
    }
}
onMounted(fetchSkills); /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("h-full overflow-y-auto") }, ...{ style: (({ padding: '24px 32px', background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-start justify-between gap-4 mb-5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-[22px] font-semibold mb-1") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[13px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (...[$event]) => {
            __VLS_ctx.showUpload = true;
        }
    };
    let __VLS_2;
    let __VLS_3;
    const __VLS_7 = __VLS_resolvedLocalAndGlobalComponents.Upload;
    /** @type { [typeof __VLS_components.Upload, ] } */
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({ size: ((14)), }));
    const __VLS_9 = __VLS_8({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_nonNullable(__VLS_4.slots).default;
    var __VLS_4;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-start gap-2.5 rounded-[10px] px-4 py-3 mb-6") }, ...{ style: (({ background: 'var(--muted)' })) }, });
    const __VLS_13 = __VLS_resolvedLocalAndGlobalComponents.Info;
    /** @type { [typeof __VLS_components.Info, ] } */
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)', marginTop: '1px', flex: 'none' })) }, }));
    const __VLS_15 = __VLS_14({ size: ((16)), ...{ style: (({ color: 'var(--muted-foreground)', marginTop: '1px', flex: 'none' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[13px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid gap-4") }, ...{ style: (({ gridTemplateColumns: 'repeat(2, 1fr)' })) }, });
    for (const [s] of __VLS_getVForSourceType((__VLS_ctx.skills))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((s.name)), ...{ class: ("flex flex-col rounded-xl p-5") }, ...{ style: (({ border: '1px solid var(--border)', background: 'var(--card)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between mb-3") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({ ...{ class: ("text-[15px] font-medium") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (s.name);
        // @ts-ignore
        [Badge,];
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((s.status === 'running' ? 'running' : 'idle')), label: ((s.status === 'running' ? '运行中' : '更新中')), dot: (true), }));
        const __VLS_20 = __VLS_19({ status: ((s.status === 'running' ? 'running' : 'idle')), label: ((s.status === 'running' ? '运行中' : '更新中')), dot: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[13px] mb-3") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        (s.description || '—');
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 text-xs mb-4 whitespace-nowrap") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        if (s.version) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (s.version);
        }
        if (s.version && s.size) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ style: (({ width: '1px', height: '12px', background: 'var(--border)' })) }, });
        }
        if (s.size) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            ((s.size / 1024 / 1024).toFixed(1));
        }
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("mt-auto flex items-center gap-2") }, });
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(Btn, new Btn({ size: ("sm"), variant: ("ghost"), }));
        const __VLS_25 = __VLS_24({ size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        __VLS_nonNullable(__VLS_28.slots).default;
        var __VLS_28;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("destructive"), }));
        const __VLS_30 = __VLS_29({ ...{ 'onClick': {} }, size: ("sm"), variant: ("destructive"), }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        let __VLS_34;
        const __VLS_35 = {
            onClick: (...[$event]) => {
                __VLS_ctx.remove(s.name);
            }
        };
        let __VLS_31;
        let __VLS_32;
        const __VLS_36 = __VLS_resolvedLocalAndGlobalComponents.Trash2;
        /** @type { [typeof __VLS_components.Trash2, ] } */
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({ size: ((13)), }));
        const __VLS_38 = __VLS_37({ size: ((13)), }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_nonNullable(__VLS_33.slots).default;
        var __VLS_33;
    }
    if (__VLS_ctx.skills.length === 0 && !__VLS_ctx.loading) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-center text-sm py-16") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    // @ts-ignore
    [Modal, Modal,];
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(Modal, new Modal({ modelValue: ((__VLS_ctx.showUpload)), title: ("上传 Skill"), width: ("480px"), }));
    const __VLS_43 = __VLS_42({ modelValue: ((__VLS_ctx.showUpload)), title: ("上传 Skill"), width: ("480px"), }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-4") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("留空则用文件名"), ...{ class: ("w-full") }, ...{ style: (({ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' })) }, });
    (__VLS_ctx.newName);
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onChange: (__VLS_ctx.onFile) }, type: ("file"), accept: (".zip"), });
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { footer: __VLS_thisSlot } = __VLS_nonNullable(__VLS_46.slots);
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_47 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), }));
        const __VLS_48 = __VLS_47({ ...{ 'onClick': {} }, variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_47));
        let __VLS_52;
        const __VLS_53 = {
            onClick: (...[$event]) => {
                __VLS_ctx.showUpload = false;
            }
        };
        let __VLS_49;
        let __VLS_50;
        __VLS_nonNullable(__VLS_51.slots).default;
        var __VLS_51;
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_54 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, }));
        const __VLS_55 = __VLS_54({ ...{ 'onClick': {} }, }, ...__VLS_functionalComponentArgsRest(__VLS_54));
        let __VLS_59;
        const __VLS_60 = {
            onClick: (__VLS_ctx.doUpload)
        };
        let __VLS_56;
        let __VLS_57;
        __VLS_nonNullable(__VLS_58.slots).default;
        var __VLS_58;
    }
    var __VLS_46;
    __VLS_styleScopedClasses['h-full'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-start'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['mb-5'];
    __VLS_styleScopedClasses['text-[22px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['mb-1'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-start'];
    __VLS_styleScopedClasses['gap-2.5'];
    __VLS_styleScopedClasses['rounded-[10px]'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-3'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['mb-3'];
    __VLS_styleScopedClasses['text-[15px]'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['text-[13px]'];
    __VLS_styleScopedClasses['mb-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['mb-4'];
    __VLS_styleScopedClasses['whitespace-nowrap'];
    __VLS_styleScopedClasses['mt-auto'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-center'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['py-16'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
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
            Upload: Upload,
            Info: Info,
            Trash2: Trash2,
            Badge: Badge,
            Btn: Btn,
            Modal: Modal,
            skills: skills,
            loading: loading,
            showUpload: showUpload,
            newName: newName,
            onFile: onFile,
            doUpload: doUpload,
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
