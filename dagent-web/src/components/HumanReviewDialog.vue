<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  title?: string
  stageName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'approve'): void
  (e: 'reject', comment: string): void
}>()

const comment = ref('')

watch(() => props.modelValue, (val) => {
  if (!val) comment.value = ''
})

function handleApprove() {
  emit('approve')
  emit('update:modelValue', false)
  ElMessage.success('审核已通过（演示模式）')
}

function handleReject() {
  if (!comment.value.trim()) {
    ElMessage.warning('请填写驳回理由')
    return
  }
  emit('reject', comment.value)
  emit('update:modelValue', false)
  ElMessage.success('已驳回（演示模式）')
}
</script>

<template>
  <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="title || '审核操作'" width="500px" :close-on-click-modal="false">
    <div style="margin-bottom: 16px; color: #606266; font-size: 14px">
      <template v-if="stageName">
        当前阶段 <strong>{{ stageName }}</strong> 等待您的审核，请选择操作：
      </template>
      <template v-else>
        请选择审核操作：
      </template>
    </div>
    <el-input v-model="comment" type="textarea" :rows="4" placeholder="审核评论（驳回时必填，通过时可选）" style="margin-bottom: 16px" />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="danger" @click="handleReject">驳回</el-button>
      <el-button type="success" @click="handleApprove">通过</el-button>
    </template>
  </el-dialog>
</template>
