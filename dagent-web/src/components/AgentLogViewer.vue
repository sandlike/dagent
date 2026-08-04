<script setup lang="ts">
const props = withDefaults(defineProps<{
  logs: string[]
  stageName?: string
  isRunning?: boolean
  maxHeight?: string
}>(), {
  maxHeight: '360px',
  isRunning: false,
  stageName: '',
})
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span style="font-weight: bold">Agent 实时日志</span>
        <el-tag v-if="stageName" size="small" type="info">{{ stageName }}</el-tag>
      </div>
    </template>
    <div class="log-panel" :style="{ maxHeight }">
      <div v-for="(log, i) in logs" :key="i" class="log-line">{{ log }}</div>
      <div v-if="isRunning" class="log-line log-cursor">▌</div>
      <div v-if="!logs.length && !isRunning" class="log-line" style="color: #6a737d">[暂无日志]</div>
    </div>
  </el-card>
</template>

<style scoped>
.log-panel {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.8;
  padding: 12px 16px;
  border-radius: 6px;
  overflow-y: auto;
}
.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
.log-cursor {
  color: #67C23A;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
