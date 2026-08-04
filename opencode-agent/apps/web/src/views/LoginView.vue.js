import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Lock } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import Btn from '@/components/ui/Btn.vue';
import Input from '@/components/ui/Input.vue';
import { ApiRequestError } from '@/api/client';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
const mode = ref('login');
const username = ref('');
const password = ref('');
const confirm = ref('');
async function submit() {
    if (!username.value || !password.value) {
        toast.error('请输入用户名和密码');
        return;
    }
    if (mode.value === 'register' && password.value !== confirm.value) {
        toast.error('两次输入的密码不一致');
        return;
    }
    try {
        if (mode.value === 'login') {
            await auth.login(username.value, password.value);
        }
        else {
            await auth.register(username.value, password.value);
        }
        toast.success(mode.value === 'login' ? '登录成功' : '注册成功');
        const redirect = route.query.redirect || '/';
        router.replace(redirect);
    }
    catch (e) {
        const msg = e instanceof ApiRequestError ? e.message : '操作失败，请重试';
        toast.error(msg);
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({ ...{ class: ("flex items-center justify-center min-h-screen px-4") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("w-full max-w-[420px] rounded-[20px] p-8 sm:p-10") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-3 mb-8") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("flex items-center justify-center w-10 h-10 rounded-[10px] text-white font-bold") }, ...{ style: (({ background: 'var(--primary)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xl font-bold tracking-tight") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-1 mb-8 p-1 rounded-full") }, ...{ style: (({ background: 'var(--muted)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.mode = 'login';
            } }, ...{ class: ("flex-1 h-9 rounded-full text-sm font-semibold transition-colors duration-150 cursor-pointer") }, ...{ style: ((__VLS_ctx.mode === 'login'
                ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
                : { background: 'transparent', color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                __VLS_ctx.mode = 'register';
            } }, ...{ class: ("flex-1 h-9 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer") }, ...{ style: ((__VLS_ctx.mode === 'register'
                ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
                : { background: 'transparent', color: 'var(--muted-foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({ ...{ onSubmit: (__VLS_ctx.submit) }, ...{ class: ("flex flex-col gap-3") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    // @ts-ignore
    [Input,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Input, new Input({ modelValue: ((__VLS_ctx.username)), placeholder: ("请输入用户名"), }));
    const __VLS_1 = __VLS_0({ modelValue: ((__VLS_ctx.username)), placeholder: ("请输入用户名"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("relative") }, });
    // @ts-ignore
    [Input,];
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(Input, new Input({ modelValue: ((__VLS_ctx.password)), type: ("password"), placeholder: ("请输入密码"), }));
    const __VLS_6 = __VLS_5({ modelValue: ((__VLS_ctx.password)), type: ("password"), placeholder: ("请输入密码"), }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    const __VLS_10 = __VLS_resolvedLocalAndGlobalComponents.Lock;
    /** @type { [typeof __VLS_components.Lock, ] } */
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
    const __VLS_12 = __VLS_11({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    if (__VLS_ctx.mode === 'register') {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("relative") }, });
        // @ts-ignore
        [Input,];
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent(Input, new Input({ modelValue: ((__VLS_ctx.confirm)), type: ("password"), placeholder: ("请再次输入密码"), }));
        const __VLS_17 = __VLS_16({ modelValue: ((__VLS_ctx.confirm)), type: ("password"), placeholder: ("请再次输入密码"), }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        const __VLS_21 = __VLS_resolvedLocalAndGlobalComponents.Lock;
        /** @type { [typeof __VLS_components.Lock, ] } */
        // @ts-ignore
        const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }));
        const __VLS_23 = __VLS_22({ size: ((16)), ...{ class: ("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    }
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(Btn, new Btn({ type: ("submit"), rounded: ("full"), ...{ class: ("mt-2 w-full") }, }));
    const __VLS_28 = __VLS_27({ type: ("submit"), rounded: ("full"), ...{ class: ("mt-2 w-full") }, }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    (__VLS_ctx.mode === 'login' ? '登录' : '注册');
    __VLS_nonNullable(__VLS_31.slots).default;
    var __VLS_31;
    __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("mt-6 text-center text-sm") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['min-h-screen'];
    __VLS_styleScopedClasses['px-4'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['max-w-[420px]'];
    __VLS_styleScopedClasses['rounded-[20px]'];
    __VLS_styleScopedClasses['p-8'];
    __VLS_styleScopedClasses['sm:p-10'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['mb-8'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['w-10'];
    __VLS_styleScopedClasses['h-10'];
    __VLS_styleScopedClasses['rounded-[10px]'];
    __VLS_styleScopedClasses['text-white'];
    __VLS_styleScopedClasses['font-bold'];
    __VLS_styleScopedClasses['text-xl'];
    __VLS_styleScopedClasses['font-bold'];
    __VLS_styleScopedClasses['tracking-tight'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['mb-8'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['duration-150'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['h-9'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['transition-colors'];
    __VLS_styleScopedClasses['duration-150'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['relative'];
    __VLS_styleScopedClasses['absolute'];
    __VLS_styleScopedClasses['right-3'];
    __VLS_styleScopedClasses['top-1/2'];
    __VLS_styleScopedClasses['-translate-y-1/2'];
    __VLS_styleScopedClasses['pointer-events-none'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['relative'];
    __VLS_styleScopedClasses['absolute'];
    __VLS_styleScopedClasses['right-3'];
    __VLS_styleScopedClasses['top-1/2'];
    __VLS_styleScopedClasses['-translate-y-1/2'];
    __VLS_styleScopedClasses['pointer-events-none'];
    __VLS_styleScopedClasses['mt-2'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['mt-6'];
    __VLS_styleScopedClasses['text-center'];
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
            Lock: Lock,
            Btn: Btn,
            Input: Input,
            mode: mode,
            username: username,
            password: password,
            confirm: confirm,
            submit: submit,
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
