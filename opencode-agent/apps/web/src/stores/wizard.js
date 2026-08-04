import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { emptyWizardForm, generateConfig } from '@opencode/shared';
export const useWizardStore = defineStore('wizard', () => {
    const step = ref(1);
    const totalSteps = 4;
    const form = ref(emptyWizardForm());
    // 右侧实时预览：表单 → opencode.json
    const configObject = computed(() => generateConfig(form.value));
    const configJson = computed(() => JSON.stringify(configObject.value, null, 2));
    function next() {
        if (step.value < totalSteps)
            step.value++;
    }
    function prev() {
        if (step.value > 1)
            step.value--;
    }
    function goTo(n) {
        step.value = Math.min(Math.max(1, n), totalSteps);
    }
    function reset() {
        step.value = 1;
        form.value = emptyWizardForm();
    }
    return { step, totalSteps, form, configObject, configJson, next, prev, goTo, reset };
});
