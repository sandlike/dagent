<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInstancesStore } from '@/stores/instances'
import { useWizardStore } from '@/stores/wizard'
import { useToastStore } from '@/stores/toast'
import { parseConfig } from '@opencode/shared'
import Badge from '@/components/ui/Badge.vue'
import Modal from '@/components/ui/Modal.vue'
import Btn from '@/components/ui/Btn.vue'
import { ApiRequestError } from '@/api/client'
import { Loader2, RotateCcw, CheckCircle2, History } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const instances = useInstancesStore()
const toast = useToastStore()
const wizard = useWizardStore()
const instanceId = String(route.params.id)

const showDelete = ref(false)
const deleteConfirm = ref('')
const updating = ref(false)
const showEditModal = ref(false)
const editDisplayName = ref('')
const rollbacking = ref<number | null>(null)

const versions = computed(() => instances.versions)

onMounted(async () => {
  await instances.fetchOne(instanceId)
  await instances.fetchVersions(instanceId)
  editDisplayName.value = instances.current?.displayName ?? ''
})

// 编辑配置：把当前 configJson 灌进向导，用户改完走 PUT（部署新版本）
function editConfig() {
  if (!instances.current?.configJson) return
  try {
    const obj = JSON.parse(instances.current.configJson)
    wizard.form = parseConfig(obj, {
      name: instances.current.displayName,
      namespace: instances.current.namespace,
    })
  } catch {
    // 解析失败用空表单
  }
  router.push({ name: 'wizard' }) // 复用向导，但提交时走 update
}

// 在向导模式下标记「编辑」提交：用 localStorage 传 instanceId 给 WizardView
// （WizardView 检测到 editingInstanceId 就走 PUT 而非 POST）
function editConfigInWizard() {
  if (instances.current) {
    localStorage.setItem('oma:editingInstanceId', String(instances.current.id))
    localStorage.setItem('oma:editingGroupId', instances.current.groupId)
  }
  editConfig()
}

async function updateDisplayName() {
  if (!editDisplayName.value.trim()) {
    toast.error('展示名称不能为空')
    return
  }
  updating.value = true
  try {
    // 用 PUT 部署新版本（仅改 displayName，configJson 沿用）
    await instances.update(instanceId, {
      displayName: editDisplayName.value,
      configJson: instances.current!.configJson,
      provider: instances.current!.provider ?? '',
      modelId: instances.current!.modelId ?? '',
      agentType: instances.current!.version ?? 'opencode',
    } as any)
    toast.success('展示名称已更新（已部署新版本）')
    showEditModal.value = false
    await instances.fetchVersions(instanceId)
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '更新失败')
  } finally {
    updating.value = false
  }
}

async function onRollback(versionNum: number) {
  if (!confirm(`确定回滚到 v${versionNum}？当前活跃版本将被停止。`)) return
  rollbacking.value = versionNum
  try {
    const res = await instances.rollback(instanceId, versionNum)
    toast.success(res.message ?? `已回滚到 v${versionNum}`)
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '回滚失败')
  } finally {
    rollbacking.value = null
  }
}

async function restart() {
  if (!confirm('确定重启实例？')) return
  try {
    await instances.restart(instanceId)
    toast.success('已发送重启请求')
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '重启失败')
  }
}

async function remove() {
  if (deleteConfirm.value !== instances.current?.displayName) {
    toast.error('展示名不匹配')
    return
  }
  try {
    await instances.remove(instanceId)
    toast.success('实例已删除')
    router.push('/')
  } catch (e) {
    toast.error(e instanceof ApiRequestError ? e.message : '删除失败')
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto" :style="{ padding: '24px 32px', background: 'var(--background)', maxWidth: '760px' }">
    <h1 class="text-xl font-semibold mb-6" :style="{ color: 'var(--foreground)' }">实例设置</h1>

    <!-- 基本信息 -->
    <section class="rounded-xl p-5 mb-5" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
      <h2 class="text-sm font-semibold mb-4" :style="{ color: 'var(--foreground)' }">基本信息</h2>
      <div class="flex flex-col gap-2.5 text-sm">
        <div class="flex items-center">
          <span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">展示名</span>
          <span class="flex-1" :style="{ color: 'var(--foreground)' }">{{ instances.current?.displayName }}</span>
          <Btn size="sm" variant="ghost" @click="editDisplayName = instances.current?.displayName ?? ''; showEditModal = true">改名</Btn>
        </div>
        <div class="flex"><span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">资源标识</span><span class="font-mono" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }">{{ instances.current?.groupId }}</span></div>
        <div class="flex"><span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">当前版本</span><span class="font-mono" :style="{ color: 'var(--foreground)' }">v{{ instances.current?.versionNum }}</span></div>
        <div class="flex"><span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">命名空间</span><span class="font-mono" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">{{ instances.current?.namespace }}</span></div>
        <div class="flex items-center"><span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">状态</span><Badge v-if="instances.current" :status="instances.current.status" dot /></div>
        <div class="flex"><span class="w-28 shrink-0" :style="{ color: 'var(--muted-foreground)' }">创建时间</span><span :style="{ color: 'var(--foreground)' }">{{ instances.current?.createdAt }}</span></div>
      </div>
    </section>

    <!-- 版本管理 -->
    <section class="rounded-xl p-5 mb-5" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
      <div class="flex items-center gap-2 mb-4">
        <History :size="15" :style="{ color: 'var(--foreground)' }" />
        <h2 class="text-sm font-semibold" :style="{ color: 'var(--foreground)' }">版本管理</h2>
      </div>
      <div v-if="versions.length === 0" class="text-xs" :style="{ color: 'var(--muted-foreground)' }">加载中...</div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="v in [...versions].reverse()"
          :key="v.id"
          class="flex items-center gap-3 rounded-lg p-3"
          :style="{
            border: '1px solid var(--border)',
            background: v.isActive ? 'color-mix(in srgb, var(--chart-2) 8%, transparent)' : 'transparent',
          }"
        >
          <div class="flex-1 flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono font-semibold" :style="{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }">v{{ v.versionNum }}</span>
              <CheckCircle2 v-if="v.isActive" :size="13" :style="{ color: 'var(--chart-2)' }" />
              <span v-if="v.isActive" class="text-[10px] px-1.5 py-0.5 rounded-full" :style="{ background: 'var(--chart-2)', color: 'white' }">活跃</span>
              <Badge :status="v.status" />
            </div>
            <span class="text-[11px]" :style="{ color: 'var(--muted-foreground)' }">{{ v.updatedAt }}</span>
          </div>
          <Btn
            v-if="!v.isActive"
            size="sm"
            variant="secondary"
            :disabled="rollbacking !== null"
            @click="onRollback(v.versionNum)"
          >
            <Loader2 v-if="rollbacking === v.versionNum" :size="13" class="animate-spin" />
            <RotateCcw v-else :size="13" />
            回滚
          </Btn>
        </div>
      </div>
      <p class="text-xs mt-3" :style="{ color: 'var(--muted-foreground)' }">
        编辑配置会自动部署新版本，旧版本保留可回滚。同一时间只有一个版本在运行（PVC 复用，切换有数秒中断）。
      </p>
    </section>

    <!-- 配置 -->
    <section class="rounded-xl p-5 mb-5" :style="{ border: '1px solid var(--border)', background: 'var(--card)' }">
      <h2 class="text-sm font-semibold mb-4" :style="{ color: 'var(--foreground)' }">配置</h2>
      <div class="flex gap-2">
        <Btn variant="secondary" @click="editConfigInWizard">编辑配置</Btn>
        <Btn variant="ghost" @click="restart">重启</Btn>
      </div>
      <p class="text-xs mt-2" :style="{ color: 'var(--muted-foreground)' }">编辑配置会部署新版本（含权限/Provider/MCP 改动）。重启仅滚动重启当前版本。</p>
    </section>

    <!-- 危险区 -->
    <section class="rounded-xl p-5" :style="{ border: '1px solid var(--destructive)', background: 'var(--card)' }">
      <h2 class="text-sm font-semibold mb-4" :style="{ color: 'var(--destructive)' }">危险区</h2>
      <Btn variant="destructive" @click="showDelete = true">删除实例</Btn>
      <p class="text-xs mt-2" :style="{ color: 'var(--muted-foreground)' }">删除后将级联回收所有版本 + PVC，数据不可恢复。</p>
    </section>

    <!-- 改名 Modal -->
    <Modal v-model="showEditModal" title="修改展示名" width="440px">
      <div class="flex flex-col gap-2 p-2">
        <label class="text-sm" :style="{ color: 'var(--foreground)' }">新的展示名</label>
        <input
          v-model="editDisplayName"
          class="w-full"
          :style="{ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' }"
        />
        <p class="text-[11px]" :style="{ color: 'var(--muted-foreground)' }">注意：改名会部署一个新版本（机制所限）。</p>
      </div>
      <template #footer>
        <Btn variant="ghost" @click="showEditModal = false">取消</Btn>
        <Btn :disabled="updating" @click="updateDisplayName">
          <Loader2 v-if="updating" :size="14" class="animate-spin" />
          {{ updating ? '保存中...' : '保存' }}
        </Btn>
      </template>
    </Modal>

    <!-- 删除确认 -->
    <Modal v-model="showDelete" title="删除实例" width="440px">
      <p class="text-sm mb-3" :style="{ color: 'var(--foreground)' }">
        此操作不可撤销。实例 <span class="font-mono" :style="{ fontFamily: 'var(--font-mono)' }">{{ instances.current?.displayName }}</span> 及其所有版本和 PVC 将被永久删除。
      </p>
      <p class="text-sm mb-2" :style="{ color: 'var(--foreground)' }">请输入展示名以确认：</p>
      <input
        v-model="deleteConfirm"
        :placeholder="instances.current?.displayName"
        class="w-full"
        :style="{ height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--input)', background: 'var(--card)', color: 'var(--foreground)', fontSize: '13px', outline: 'none' }"
      />
      <template #footer>
        <Btn variant="ghost" @click="showDelete = false">取消</Btn>
        <Btn variant="destructive" @click="remove">永久删除</Btn>
      </template>
    </Modal>
  </div>
</template>
