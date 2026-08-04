import { defineStore } from 'pinia';
import { ref } from 'vue';
let _id = 0;
export const useToastStore = defineStore('toast', () => {
    const items = ref([]);
    function show(message, variant = 'info', timeout = 3000) {
        const id = ++_id;
        items.value.push({ id, message, variant });
        if (timeout > 0)
            setTimeout(() => dismiss(id), timeout);
        return id;
    }
    const success = (m) => show(m, 'success');
    const error = (m) => show(m, 'error');
    const info = (m) => show(m, 'info');
    function dismiss(id) {
        items.value = items.value.filter((t) => t.id !== id);
    }
    return { items, show, success, error, info, dismiss };
});
