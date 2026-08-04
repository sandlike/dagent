import { onMounted, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Plus, Search, MessagesSquare, Key, Bot, Cpu, LogOut } from 'lucide-vue-next';
import { useInstancesStore } from '@/stores/instances';
import { useAuthStore } from '@/stores/auth';
import Btn from '@/components/ui/Btn.vue';
import Badge from '@/components/ui/Badge.vue';
import { useToastStore } from '@/stores/toast';
import { ApiRequestError } from '@/api/client';
import { deleteInstance } from '@/api/instances';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const route = useRoute();
const instances = useInstancesStore();
const auth = useAuthStore();
const toast = useToastStore();
const keyword = ref('');
const statusFilter = ref('all');
// ===== 左侧导航 =====
const navItems = [
    { key: 'agents', label: 'Agent 管理', icon: Bot, route: '/' },
    { key: 'llm', label: 'LLM 管理', icon: Key, route: '/providers' },
    { key: 'mcp', label: 'MCP 管理', icon: Cpu, route: '/mcp' },
];
const activeNav = computed(() => {
    const path = route.path;
    if (path === '/' || path.startsWith('/instances'))
        return 'agents';
    if (path === '/providers')
        return 'llm';
    if (path === '/mcp')
        return 'mcp';
    return 'agents';
});
const filtered = computed(() => {
    let list = instances.list;
    if (keyword.value.trim()) {
        const kw = keyword.value.toLowerCase();
        list = list.filter((i) => (i.displayName ?? i.name).toLowerCase().includes(kw) ||
            (i.modelId ?? '').toLowerCase().includes(kw));
    }
    if (statusFilter.value !== 'all') {
        list = list.filter((i) => i.status === statusFilter.value);
    }
    return list;
});
async function onDeploy() {
    router.push('/instances/new');
}
function openChat(id) {
    router.push({ name: 'chat', params: { id } });
}
function openSettings(id) {
    router.push({ name: 'settings', params: { id } });
}
async function onDelete(id) {
    if (!confirm('确定删除此实例？相关 K8s 资源将一并清理。'))
        return;
    try {
        await deleteInstance(id);
        toast.success('实例已删除');
        await instances.fetchList();
    }
    catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : '删除失败');
    }
}
onMounted(() => {
    instances.fetchList();
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid h-screen") }, ...{ style: (({ gridTemplateColumns: '200px minmax(0,1fr)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({ ...{ style: (({
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--sidebar)',
                borderRight: '1px solid var(--sidebar-border)',
            })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.router.push('/');
            } }, ...{ class: ("flex items-center gap-2 px-4 py-4 cursor-pointer") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-bold") }, ...{ style: (({ fontSize: '15px', color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({ ...{ class: ("flex-1 flex flex-col gap-0.5 px-2 pt-2") }, });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.navItems))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.router.push(item.route);
                } }, key: ((item.key)), ...{ class: ("flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors") }, ...{ style: (({
                    background: __VLS_ctx.activeNav === item.key ? 'var(--sidebar-accent)' : 'transparent',
                    color: __VLS_ctx.activeNav === item.key ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-foreground)',
                    fontWeight: __VLS_ctx.activeNav === item.key ? 600 : 400,
                })) }, });
        const __VLS_0 = ((item.icon));
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ size: ((16)), }));
        const __VLS_2 = __VLS_1({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        (item.label);
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("px-3 py-3 border-t") }, ...{ style: (({ borderColor: 'var(--sidebar-border)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-bold text-white") }, ...{ style: (({ background: 'var(--primary)' })) }, });
    (__VLS_ctx.auth.user?.username?.[0]?.toUpperCase() ?? '?');
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 min-w-0") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("text-xs font-medium truncate") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    (__VLS_ctx.auth.user?.username);
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.auth.logout();
                __VLS_ctx.router.push('/login');
            } }, ...{ class: ("cursor-pointer p-1 rounded") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, title: ("退出"), });
    const __VLS_6 = __VLS_resolvedLocalAndGlobalComponents.LogOut;
    /** @type { [typeof __VLS_components.LogOut, ] } */
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ size: ((14)), }));
    const __VLS_8 = __VLS_7({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: (({ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({ ...{ style: (({ height: '56px', flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div)({ ...{ class: ("flex-1") }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, variant: ("ghost"), size: ("sm"), }));
    const __VLS_13 = __VLS_12({ ...{ 'onClick': {} }, variant: ("ghost"), size: ("sm"), }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    let __VLS_17;
    const __VLS_18 = {
        onClick: (...[$event]) => {
            __VLS_ctx.auth.logout();
            __VLS_ctx.router.push('/login');
        }
    };
    let __VLS_14;
    let __VLS_15;
    __VLS_nonNullable(__VLS_16.slots).default;
    var __VLS_16;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex-1 overflow-y-auto") }, });
    if (__VLS_ctx.activeNav === 'agents') {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: (({ maxWidth: '1100px', margin: '0 auto', padding: '28px 28px 40px' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between mb-6") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({ ...{ class: ("text-[22px] font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        // @ts-ignore
        [Btn, Btn,];
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), }));
        const __VLS_20 = __VLS_19({ ...{ 'onClick': {} }, rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        let __VLS_24;
        const __VLS_25 = {
            onClick: (__VLS_ctx.onDeploy)
        };
        let __VLS_21;
        let __VLS_22;
        const __VLS_26 = __VLS_resolvedLocalAndGlobalComponents.Plus;
        /** @type { [typeof __VLS_components.Plus, ] } */
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({ size: ((15)), }));
        const __VLS_28 = __VLS_27({ size: ((15)), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        __VLS_nonNullable(__VLS_23.slots).default;
        var __VLS_23;
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-3 mb-6 flex-wrap") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("relative flex-1 min-w-[200px] max-w-[360px]") }, });
        const __VLS_32 = __VLS_resolvedLocalAndGlobalComponents.Search;
        /** @type { [typeof __VLS_components.Search, ] } */
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({ size: ((15)), ...{ class: ("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_34 = __VLS_33({ size: ((15)), ...{ class: ("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("搜索实例..."), ...{ class: ("w-full pl-9 pr-3 border outline-none") }, ...{ style: (({ height: '36px', borderRadius: '10px', background: 'var(--card)', borderColor: 'var(--input)', color: 'var(--foreground)', fontSize: '13px' })) }, });
        (__VLS_ctx.keyword);
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-1.5 flex-wrap") }, });
        for (const [s] of __VLS_getVForSourceType((['all', 'running', 'deploying', 'error', 'stopped']))) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!((__VLS_ctx.activeNav === 'agents')))
                            return;
                        __VLS_ctx.statusFilter = s;
                    } }, key: ((s)), ...{ class: ("px-3 py-1 rounded-full text-xs cursor-pointer") }, ...{ style: (({
                        background: __VLS_ctx.statusFilter === s ? 'var(--primary)' : 'var(--muted)',
                        color: __VLS_ctx.statusFilter === s ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    })) }, });
            (s === 'all' ? '全部' : s === 'running' ? '运行中' : s === 'deploying' ? '部署中' : s === 'error' ? '异常' : '已停止');
        }
        if (__VLS_ctx.filtered.length > 0) {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("grid gap-4") }, ...{ style: (({ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' })) }, });
            for (const [inst] of __VLS_getVForSourceType((__VLS_ctx.filtered))) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ onClick: (...[$event]) => {
                            if (!((__VLS_ctx.activeNav === 'agents')))
                                return;
                            if (!((__VLS_ctx.filtered.length > 0)))
                                return;
                            __VLS_ctx.openChat(inst.id);
                        } }, key: ((inst.id)), ...{ class: ("rounded-xl p-5 flex flex-col gap-3 cursor-pointer") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
                (inst.displayName || inst.name);
                // @ts-ignore
                [Badge,];
                // @ts-ignore
                const __VLS_38 = __VLS_asFunctionalComponent(Badge, new Badge({ status: ((inst.status)), }));
                const __VLS_39 = __VLS_38({ status: ((inst.status)), }, ...__VLS_functionalComponentArgsRest(__VLS_38));
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-3 text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
                if (inst.modelId) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("font-mono") }, });
                    (inst.modelId);
                }
                if (inst.provider) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.span)({ ...{ style: (({ width: '1px', height: '10px', background: 'var(--border)' })) }, });
                }
                if (inst.provider) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (inst.provider);
                }
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
                const __VLS_43 = __VLS_resolvedLocalAndGlobalComponents.MessagesSquare;
                /** @type { [typeof __VLS_components.MessagesSquare, ] } */
                // @ts-ignore
                const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({ size: ((12)), }));
                const __VLS_45 = __VLS_44({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_44));
                __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (inst.sessionCount ?? 0);
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2 mt-auto pt-2") }, });
                // @ts-ignore
                [Btn, Btn,];
                // @ts-ignore
                const __VLS_49 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
                const __VLS_50 = __VLS_49({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_49));
                let __VLS_54;
                const __VLS_55 = {
                    onClick: (...[$event]) => {
                        if (!((__VLS_ctx.activeNav === 'agents')))
                            return;
                        if (!((__VLS_ctx.filtered.length > 0)))
                            return;
                        __VLS_ctx.openChat(inst.id);
                    }
                };
                let __VLS_51;
                let __VLS_52;
                __VLS_nonNullable(__VLS_53.slots).default;
                var __VLS_53;
                // @ts-ignore
                [Btn, Btn,];
                // @ts-ignore
                const __VLS_56 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
                const __VLS_57 = __VLS_56({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
                let __VLS_61;
                const __VLS_62 = {
                    onClick: (...[$event]) => {
                        if (!((__VLS_ctx.activeNav === 'agents')))
                            return;
                        if (!((__VLS_ctx.filtered.length > 0)))
                            return;
                        __VLS_ctx.openSettings(inst.id);
                    }
                };
                let __VLS_58;
                let __VLS_59;
                __VLS_nonNullable(__VLS_60.slots).default;
                var __VLS_60;
            }
        }
        else {
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col items-center justify-center py-16 gap-3") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-sm") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            // @ts-ignore
            [Btn, Btn,];
            // @ts-ignore
            const __VLS_63 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, rounded: ("full"), }));
            const __VLS_64 = __VLS_63({ ...{ 'onClick': {} }, rounded: ("full"), }, ...__VLS_functionalComponentArgsRest(__VLS_63));
            let __VLS_68;
            const __VLS_69 = {
                onClick: (__VLS_ctx.onDeploy)
            };
            let __VLS_65;
            let __VLS_66;
            const __VLS_70 = __VLS_resolvedLocalAndGlobalComponents.Plus;
            /** @type { [typeof __VLS_components.Plus, ] } */
            // @ts-ignore
            const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({ size: ((15)), }));
            const __VLS_72 = __VLS_71({ size: ((15)), }, ...__VLS_functionalComponentArgsRest(__VLS_71));
            __VLS_nonNullable(__VLS_67.slots).default;
            var __VLS_67;
        }
    }
    else {
        const __VLS_76 = __VLS_resolvedLocalAndGlobalComponents.RouterView;
        /** @type { [typeof __VLS_components.RouterView, ] } */
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
        const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
    }
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['h-screen'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['py-4'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['font-bold'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-0.5'];
    __VLS_styleScopedClasses['px-2'];
    __VLS_styleScopedClasses['pt-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2.5'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['py-2.5'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['py-3'];
    __VLS_styleScopedClasses['border-t'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-8'];
    __VLS_styleScopedClasses['h-8'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-bold'];
    __VLS_styleScopedClasses['text-white'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-w-0'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['rounded'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['overflow-y-auto'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['text-[22px]'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['mb-6'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['relative'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['min-w-[200px]'];
    __VLS_styleScopedClasses['max-w-[360px]'];
    __VLS_styleScopedClasses['absolute'];
    __VLS_styleScopedClasses['left-3'];
    __VLS_styleScopedClasses['top-1/2'];
    __VLS_styleScopedClasses['-translate-y-1/2'];
    __VLS_styleScopedClasses['pointer-events-none'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['pl-9'];
    __VLS_styleScopedClasses['pr-3'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['outline-none'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex-wrap'];
    __VLS_styleScopedClasses['px-3'];
    __VLS_styleScopedClasses['py-1'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['grid'];
    __VLS_styleScopedClasses['gap-4'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['mt-auto'];
    __VLS_styleScopedClasses['pt-2'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['py-16'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['text-sm'];
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
            Search: Search,
            MessagesSquare: MessagesSquare,
            LogOut: LogOut,
            Btn: Btn,
            Badge: Badge,
            router: router,
            auth: auth,
            keyword: keyword,
            statusFilter: statusFilter,
            navItems: navItems,
            activeNav: activeNav,
            filtered: filtered,
            onDeploy: onDeploy,
            openChat: openChat,
            openSettings: openSettings,
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
