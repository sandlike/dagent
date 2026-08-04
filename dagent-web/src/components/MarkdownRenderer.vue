<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const renderedHtml = computed(() => {
  let text = props.content
  // Escape HTML
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Headings
  text = text.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Bold & italic
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
  // Tables (basic)
  text = text.replace(/\|(.+)\|/g, (match) => {
    if (match.includes('---')) return ''
    const cells = match.split('|').filter(c => c.trim())
    const tds = cells.map(c => `<td>${c.trim()}</td>`).join('')
    return `<tr>${tds}</tr>`
  })
  text = text.replace(/(<tr>[\s\S]*?<\/tr>\s*)+/g, (m) => `<table class="md-table">${m}</table>`)
  // Lists
  text = text.replace(/^- (.+)$/gm, '<li>$1</li>')
  text = text.replace(/(<li>[\s\S]*?<\/li>\s*)+/g, (m) => `<ul>${m}</ul>`)
  text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  // Line breaks (skip already handled)
  text = text.replace(/\n\n/g, '<br/>')
  text = text.replace(/\n/g, '<br/>')
  return text
})
</script>

<template>
  <div class="markdown-body" v-html="renderedHtml" />
</template>

<style scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
  word-break: break-word;
}
.markdown-body :deep(h1) { font-size: 22px; margin: 20px 0 12px; font-weight: 600; border-bottom: 1px solid #eee; padding-bottom: 8px; }
.markdown-body :deep(h2) { font-size: 18px; margin: 18px 0 10px; font-weight: 600; }
.markdown-body :deep(h3) { font-size: 16px; margin: 14px 0 8px; font-weight: 600; }
.markdown-body :deep(h4) { font-size: 14px; margin: 12px 0 6px; font-weight: 600; }
.markdown-body :deep(code) { background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-size: 13px; color: #e83e8c; }
.markdown-body :deep(pre) { background: #f5f7fa; padding: 14px 18px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
.markdown-body :deep(pre code) { background: transparent; padding: 0; color: #303133; }
.markdown-body :deep(ul) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(strong) { font-weight: 600; }
.markdown-body :deep(.md-table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.markdown-body :deep(.md-table td) { border: 1px solid #e4e7ed; padding: 8px 12px; text-align: left; }
.markdown-body :deep(.md-table tr:first-child td) { background: #f5f7fa; font-weight: 600; }
</style>
