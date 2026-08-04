import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as instancesApi from '@/api/instances';
export const useInstancesStore = defineStore('instances', () => {
    const list = ref([]);
    const loading = ref(false);
    const current = ref(null);
    const versions = ref([]);
    async function fetchList() {
        loading.value = true;
        try {
            list.value = await instancesApi.listInstances();
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchOne(id) {
        current.value = await instancesApi.getInstance(id);
        return current.value;
    }
    async function fetchVersions(id) {
        versions.value = await instancesApi.listVersions(id);
        return versions.value;
    }
    async function update(id, body) {
        const res = await instancesApi.updateInstance(id, body);
        current.value = res.instance;
        return res;
    }
    async function rollback(id, versionNum) {
        const res = await instancesApi.rollbackInstance(id, versionNum);
        await fetchOne(id);
        await fetchVersions(id);
        return res;
    }
    async function remove(id) {
        await instancesApi.deleteInstance(id);
        await fetchList();
    }
    async function restart(id) {
        await instancesApi.restartInstance(id);
    }
    function setCurrent(inst) {
        current.value = inst;
    }
    return {
        list, loading, current, versions,
        fetchList, fetchOne, fetchVersions, update, rollback, remove, restart, setCurrent,
    };
});
