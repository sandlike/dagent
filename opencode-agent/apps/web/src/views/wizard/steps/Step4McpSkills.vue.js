import { ref } from 'vue';
import { Plus, Trash2, Upload, X } from 'lucide-vue-next';
import { useWizardStore } from '@/stores/wizard';
import Btn from '@/components/ui/Btn.vue';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const wizard = useWizardStore();
// ===== MCP =====
function addMcpLocal() {
    const name = prompt('MCP 名称（小写字母/数字/中划线）');
    if (!name)
        return;
    wizard.form.mcpServers[name] = { type: 'local', command: [''] };
}
function addMcpRemote() {
    const name = prompt('MCP 名称（小写字母/数字/中划线）');
    if (!name)
        return;
    wizard.form.mcpServers[name] = { type: 'remote', url: '' };
}
function removeMcp(name) {
    delete wizard.form.mcpServers[name];
}
// local 命令以数组存储，这里给一个字符串输入框简化
function commandText(s, v) {
    s.command = v.split(' ');
}
// ===== headers / environment 键值对编辑器 =====
// 确保对象存在（Vue 响应式需要先声明）
function ensureHeaders(s) {
    if (!s.headers)
        s.headers = {};
    return s.headers;
}
function addHeader(s) {
    const h = ensureHeaders(s);
    h['Authorization'] = 'Bearer {env:MCP_TOKEN}';
}
function removeHeader(s, key) {
    if (s.headers)
        delete s.headers[key];
}
function ensureEnv(s) {
    if (!s.env)
        s.env = {};
    return s.env;
}
function addEnv(s) {
    const k = prompt('环境变量名（如 MY_VAR）');
    if (!k)
        return;
    ensureEnv(s)[k] = '';
}
function removeEnv(s, key) {
    if (s.env)
        delete s.env[key];
}
// ===== Skills =====
const skillPathInput = ref('');
function addSkillPath() {
    if (skillPathInput.value.trim()) {
        wizard.form.skillPaths.push(skillPathInput.value.trim());
        skillPathInput.value = '';
    }
}
const files = ref([]);
function onFile(e) {
    const target = e.target;
    if (target.files) {
        for (const f of Array.from(target.files)) {
            files.value.push(f);
            wizard.form.presetSkills.push({ type: 'upload', value: f.name });
        }
    }
}
function removeFile(i) {
    files.value.splice(i, 1);
    wizard.form.presetSkills.splice(i, 1);
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-2") }, });
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
    const __VLS_1 = __VLS_0({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_5;
    const __VLS_6 = {
        onClick: (__VLS_ctx.addMcpLocal)
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
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }));
    const __VLS_14 = __VLS_13({ ...{ 'onClick': {} }, size: ("sm"), variant: ("ghost"), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_18;
    const __VLS_19 = {
        onClick: (__VLS_ctx.addMcpRemote)
    };
    let __VLS_15;
    let __VLS_16;
    const __VLS_20 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({ size: ((14)), }));
    const __VLS_22 = __VLS_21({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_nonNullable(__VLS_17.slots).default;
    var __VLS_17;
    for (const [s, name] of __VLS_getVForSourceType((__VLS_ctx.wizard.form.mcpServers))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: name, ...{ class: ("rounded-xl p-4 flex flex-col gap-3") }, ...{ style: (({ background: 'var(--card)', border: '1px solid var(--border)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-sm font-semibold font-mono") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
        (name);
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs px-2 py-0.5 rounded-full") }, ...{ style: (({ background: 'var(--muted)', color: 'var(--muted-foreground)' })) }, });
        (s.type);
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.removeMcp(name);
                } }, ...{ class: ("cursor-pointer p-1") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
        const __VLS_26 = __VLS_resolvedLocalAndGlobalComponents.Trash2;
        /** @type { [typeof __VLS_components.Trash2, ] } */
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({ size: ((14)), }));
        const __VLS_28 = __VLS_27({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        if (s.type === 'local') {
            __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onInput: (...[$event]) => {
                        if (!((s.type === 'local')))
                            return;
                        __VLS_ctx.commandText(s, $event.target.value);
                    } }, value: ((s.command.join(' '))), placeholder: ("npx -y @modelcontextprotocol/server-filesystem /data"), ...{ class: ("w-full") }, ...{ style: (({ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!((s.type === 'local')))
                            return;
                        __VLS_ctx.addEnv(s);
                    } }, ...{ class: ("text-xs cursor-pointer flex items-center gap-1") }, ...{ style: (({ color: 'var(--primary)' })) }, });
            const __VLS_32 = __VLS_resolvedLocalAndGlobalComponents.Plus;
            /** @type { [typeof __VLS_components.Plus, ] } */
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({ size: ((12)), }));
            const __VLS_34 = __VLS_33({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_33));
            if (s.env && Object.keys(s.env).length > 0) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
                for (const [v, k] of __VLS_getVForSourceType((s.env))) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((k)), ...{ class: ("flex items-center gap-2") }, });
                    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("text-xs font-mono shrink-0 w-32 truncate") }, ...{ style: (({ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' })) }, });
                    (k);
                    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ class: ("flex-1") }, ...{ style: (({ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' })) }, });
                    (s.env[k]);
                    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                                if (!((s.type === 'local')))
                                    return;
                                if (!((s.env && Object.keys(s.env).length > 0)))
                                    return;
                                __VLS_ctx.removeEnv(s, k);
                            } }, ...{ class: ("cursor-pointer p-1 shrink-0") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
                    const __VLS_38 = __VLS_resolvedLocalAndGlobalComponents.X;
                    /** @type { [typeof __VLS_components.X, ] } */
                    // @ts-ignore
                    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({ size: ((12)), }));
                    const __VLS_40 = __VLS_39({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
                }
            }
        }
        else {
            __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("https://api.github.com/mcp"), ...{ class: ("w-full") }, ...{ style: (({ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' })) }, });
            (s.url);
            __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center justify-between") }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                        if (!(!((s.type === 'local'))))
                            return;
                        __VLS_ctx.addHeader(s);
                    } }, ...{ class: ("text-xs cursor-pointer flex items-center gap-1") }, ...{ style: (({ color: 'var(--primary)' })) }, });
            const __VLS_44 = __VLS_resolvedLocalAndGlobalComponents.Plus;
            /** @type { [typeof __VLS_components.Plus, ] } */
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({ size: ((12)), }));
            const __VLS_46 = __VLS_45({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            if (s.headers && Object.keys(s.headers).length > 0) {
                __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-1.5") }, });
                for (const [v, k] of __VLS_getVForSourceType((s.headers))) {
                    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((k)), ...{ class: ("flex flex-col gap-1") }, });
                    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex items-center gap-2") }, });
                    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onChange: ((e) => {
                                const newKey = e.target.value;
                                const headers = s.headers;
                                const oldVal = headers[k];
                                delete headers[k];
                                headers[newKey] = oldVal;
                            }) }, value: k, placeholder: ("Header 名（如 Authorization）"), ...{ class: ("flex-1") }, ...{ style: (({ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' })) }, });
                    __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                                if (!(!((s.type === 'local'))))
                                    return;
                                if (!((s.headers && Object.keys(s.headers).length > 0)))
                                    return;
                                __VLS_ctx.removeHeader(s, k);
                            } }, ...{ class: ("cursor-pointer p-1 shrink-0") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
                    const __VLS_50 = __VLS_resolvedLocalAndGlobalComponents.X;
                    /** @type { [typeof __VLS_components.X, ] } */
                    // @ts-ignore
                    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({ size: ((12)), }));
                    const __VLS_52 = __VLS_51({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_51));
                    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ placeholder: ("值（如 Bearer {env:MCP_TOKEN}）"), ...{ class: ("w-full") }, ...{ style: (({ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none' })) }, });
                    (s.headers[k]);
                }
            }
            else {
                __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-[11px]") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
            }
        }
    }
    if (Object.keys(__VLS_ctx.wizard.form.mcpServers).length === 0) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({ ...{ class: ("text-xs") }, ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-3") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onKeyup: (__VLS_ctx.addSkillPath) }, placeholder: ("如 ~/.opencode/skills/my-skill"), ...{ class: ("flex-1") }, ...{ style: (({ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontSize: '12px', outline: 'none' })) }, });
    (__VLS_ctx.skillPathInput);
    // @ts-ignore
    [Btn, Btn,];
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(Btn, new Btn({ ...{ 'onClick': {} }, size: ("sm"), }));
    const __VLS_57 = __VLS_56({ ...{ 'onClick': {} }, size: ("sm"), }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_61;
    const __VLS_62 = {
        onClick: (__VLS_ctx.addSkillPath)
    };
    let __VLS_58;
    let __VLS_59;
    const __VLS_63 = __VLS_resolvedLocalAndGlobalComponents.Plus;
    /** @type { [typeof __VLS_components.Plus, ] } */
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({ size: ((14)), }));
    const __VLS_65 = __VLS_64({ size: ((14)), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    __VLS_nonNullable(__VLS_60.slots).default;
    var __VLS_60;
    for (const [p, i] of __VLS_getVForSourceType((__VLS_ctx.wizard.form.skillPaths))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((i)), ...{ class: ("flex items-center gap-2 text-xs font-mono") }, ...{ style: (({ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("flex-1 truncate") }, });
        (p);
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.wizard.form.skillPaths.splice(i, 1);
                } }, ...{ class: ("cursor-pointer p-1") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
        const __VLS_69 = __VLS_resolvedLocalAndGlobalComponents.X;
        /** @type { [typeof __VLS_components.X, ] } */
        // @ts-ignore
        const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({ size: ((12)), }));
        const __VLS_71 = __VLS_70({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("flex flex-col gap-2") }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("text-sm font-medium") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({ ...{ class: ("flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-6 text-sm") }, ...{ style: (({ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' })) }, });
    const __VLS_75 = __VLS_resolvedLocalAndGlobalComponents.Upload;
    /** @type { [typeof __VLS_components.Upload, ] } */
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({ size: ((16)), }));
    const __VLS_77 = __VLS_76({ size: ((16)), }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    __VLS_elementAsFunction(__VLS_intrinsicElements.input)({ ...{ onChange: (__VLS_ctx.onFile) }, type: ("file"), accept: (".zip"), multiple: (true), ...{ class: ("hidden") }, });
    for (const [f, i] of __VLS_getVForSourceType((__VLS_ctx.files))) {
        __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ key: ((i)), ...{ class: ("flex items-center gap-2 text-xs") }, ...{ style: (({ color: 'var(--foreground)' })) }, });
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ class: ("flex-1 truncate font-mono") }, ...{ style: (({ fontFamily: 'var(--font-mono)' })) }, });
        (f.name);
        __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: (({ color: 'var(--muted-foreground)' })) }, });
        ((f.size / 1024).toFixed(1));
        __VLS_elementAsFunction(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({ ...{ onClick: (...[$event]) => {
                    __VLS_ctx.removeFile(i);
                } }, ...{ class: ("cursor-pointer p-1") }, ...{ style: (({ color: 'var(--destructive)' })) }, });
        const __VLS_81 = __VLS_resolvedLocalAndGlobalComponents.X;
        /** @type { [typeof __VLS_components.X, ] } */
        // @ts-ignore
        const __VLS_82 = __VLS_asFunctionalComponent(__VLS_81, new __VLS_81({ size: ((12)), }));
        const __VLS_83 = __VLS_82({ size: ((12)), }, ...__VLS_functionalComponentArgsRest(__VLS_82));
    }
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['rounded-xl'];
    __VLS_styleScopedClasses['p-4'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-semibold'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['px-2'];
    __VLS_styleScopedClasses['py-0.5'];
    __VLS_styleScopedClasses['rounded-full'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['w-32'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-between'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1.5'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['shrink-0'];
    __VLS_styleScopedClasses['w-full'];
    __VLS_styleScopedClasses['text-[11px]'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-3'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['flex-col'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['font-medium'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['justify-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['rounded-lg'];
    __VLS_styleScopedClasses['border'];
    __VLS_styleScopedClasses['border-dashed'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['py-6'];
    __VLS_styleScopedClasses['text-sm'];
    __VLS_styleScopedClasses['hidden'];
    __VLS_styleScopedClasses['flex'];
    __VLS_styleScopedClasses['items-center'];
    __VLS_styleScopedClasses['gap-2'];
    __VLS_styleScopedClasses['text-xs'];
    __VLS_styleScopedClasses['flex-1'];
    __VLS_styleScopedClasses['truncate'];
    __VLS_styleScopedClasses['font-mono'];
    __VLS_styleScopedClasses['cursor-pointer'];
    __VLS_styleScopedClasses['p-1'];
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
            Upload: Upload,
            X: X,
            Btn: Btn,
            wizard: wizard,
            addMcpLocal: addMcpLocal,
            addMcpRemote: addMcpRemote,
            removeMcp: removeMcp,
            commandText: commandText,
            addHeader: addHeader,
            removeHeader: removeHeader,
            addEnv: addEnv,
            removeEnv: removeEnv,
            skillPathInput: skillPathInput,
            addSkillPath: addSkillPath,
            files: files,
            onFile: onFile,
            removeFile: removeFile,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
