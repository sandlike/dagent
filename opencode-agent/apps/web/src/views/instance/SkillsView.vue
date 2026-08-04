<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Upload, Info, Trash2 } from 'lucide-vue-next'
import { listSkills, uploadSkill, deleteSkill } from '@/api/proxy'
import { useToastStore } from '@/stores/toast'
import { useInstancesStore } from '@/stores/instances'
import Badge from '@/components/ui/Badge.vue'
import Btn from '@/components/ui/Btn.vue'
import Modal from '@/components/ui/Modal.vue'
import { ApiRequestError } from '@/api/client'
import type { Skill } from '@opencode/shared'

const route = useRoute()
const toast = useToastStore()
const instanceId = String(route.params.id)

const skills = ref<Skill[]>([])
const loading = ref(false)
const showUpload = ref(false)
const newName = ref('')
const newFile = ref<File | null>(null)

async function fetchSkills() {
  loading.value = true
  try {
    skills.value = await listSkills(instanceId)
  } catch {
    // 后端/sidecar 未就绪时静默
  } finally {
    loading.value = false
  }
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) newFile.value = f
}

async function doUpload() {
  if (!newFile.value) {
    toast.error('请选择 zip 文件')
    return
  }
  const name = newName.value.trim() || newFile.value.name.replace(/\.zip$/i, '')
  try {
    await uploadSkill(instanceId, name, newFile.value)
    toast.success('Skill 已上传，立即生效')
    showUpload.value = false
    newName.value = ''
    newFile.value = null
    await fetchSkills()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '上传失败')
  }
}

async function remove(name: string) {
  if (!confirm(`确定卸载 Skill "${name}"？卸载后立即生效。`)) return
  try {
    await deleteSkill(instanceId, name)
    toast.success('已卸载')
    await fetchSkills()
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '卸载失败')
  }
}

onMounted(fetchSkills)
</script>

<template>
  <div class="h-full overflow-y-auto" :style="{ padding: '24px 32px', background: 'var(--background)' }">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 class="text-[22px] font-semibold mb-1" :style="{ color: 'var(--foreground)' }">Skills</h1>
        <p class="text-[13px]" :style="{ color: 'var(--muted-foreground)' }">管理实例 Skills，修改即时生效</p>
      </div>
      <Btn rounded="full" @click="showUpload = true"><Upload :size="14" /> 上传 Skill ZIP</Btn>
    </div>

    <!-- Info banner -->
    <div
      class="flex items-start gap-2.5 rounded-[10px] px-4 py-3 mb-6"
      :style="{ background: 'var(--muted)' }"
    >
      <Info :size="16" :style="{ color: 'var(--muted-foreground)', marginTop: '1px', flex: 'none' }" />
      <p class="text-[13px]" :style="{ color: 'var(--muted-foreground)' }">
        提示：上传 .zip 文件后，Skill 将立即生效（无需重启实例）。每个 Skill 占用独立的容器空间，请合理规划资源。
      </p>
    </div>

    <!-- Cards -->
    <div class="grid gap-4" :style="{ gridTemplateColumns: 'repeat(2, 1fr)' }">
      <div
        v-for="s in skills"
        :key="s.name"
        class="flex flex-col rounded-xl p-5"
        :style="{ border: '1px solid var(--border)', background: 'var(--card)' }"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[15px] font-medium" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">{{ s.name }}</h3>
          <Badge :status="s.status === 'running' ? 'running' : 'idle'" :label="s.status === 'running' ? '运行中' : '更新中'" dot />
        </div>
        <p class="text-[13px] mb-3" :style="{ color: 'var(--muted-foreground)' }">{{ s.description || '—' }}</p>
        <div class="flex items-center gap-2 text-xs mb-4 whitespace-nowrap" :style="{ color: 'var(--muted-foreground)' }">
          <span v-if="s.version">{{ s.version }}</span>
          <span v-if="s.version && s.size" :style="{ width: '1px', height: '12px', background: 'var(--border)' }" />
          <span v-if="s.size">{{ (s.size / 1024 / 1024).toFixed(1) }} MB</span>
        </div>
        <div class="mt-auto flex items-center gap-2">
          <Btn size="sm" variant="ghost">配置</Btn>
          <Btn size="sm" variant="destructive" @click="remove(s.name)"><Trash2 :size="13" /> 卸载</Btn>
        </div>
      </div>
    </div>

    <p v-if="skills.length === 0 && !loading" class="text-center text-sm py-16" :style="{ color: 'var(--muted-foreground)' }">
      暂无 Skill，点击右上角上传
    </p>

    <!-- Upload modal -->
    <Modal v-model="showUpload" title="上传 Skill" width="480px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">Skill 名称</label>
          <input
            v-model="newName"
            placeholder="留空则用文件名"
            class="w-full"
            :style="{ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' }"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">ZIP 文件</label>
          <input type="file" accept=".zip" @change="onFile" />
        </div>
      </div>
      <template #footer>
        <Btn variant="ghost" @click="showUpload = false">取消</Btn>
        <Btn @click="doUpload">上传</Btn>
      </template>
    </Modal>
  </div>
</template>
