<script setup lang="ts">
import { computed } from 'vue'
import type { ClarificationRound } from '@/api/types'
import StructuredDataViewer from '@/components/StructuredDataViewer.vue'
import { artifactLabels } from '@/utils/status'

const props = withDefaults(defineProps<{
  artifactType: string
  content: unknown
  clarificationRounds?: ClarificationRound[]
  userNames?: Record<number, string>
}>(), {
  clarificationRounds: () => [],
  userNames: () => ({}),
})

type DataRecord = Record<string, unknown>

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): DataRecord {
  return isRecord(value) ? value : { summary: value }
}

function records(value: unknown): DataRecord[] {
  const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
  return values.map((item) => isRecord(item) ? item : { value: item })
}

function strings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
  return values.map((item) => display(item)).filter((item) => item !== '-')
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.map((item) => display(item)).join('、') || '-'
  if (isRecord(value)) return Object.values(value).map((item) => display(item)).filter((item) => item !== '-').join('；') || '-'
  return String(value)
}

function pick(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

const data = computed(() => asRecord(props.content))
const rawJson = computed(() => JSON.stringify(props.content, null, 2))
const summary = computed(() => display(pick(data.value.summary, data.value.clarification_summary)))

const confirmedAnswers = computed(() => records(data.value.confirmed_answers))
const developmentSections = computed(() => [
  { title: '需求目标', items: strings(pick(data.value.goals, data.value.scope)) },
  { title: '非目标', items: strings(data.value.non_goals) },
  { title: '前端改动', items: strings(data.value.frontend_changes) },
  { title: '后端改动', items: strings(data.value.backend_changes) },
  { title: 'Agent 改动', items: strings(data.value.agent_changes) },
  { title: '数据改动', items: strings(data.value.data_changes) },
  { title: '实施步骤', items: strings(data.value.implementation_steps) },
  { title: '回滚方案', items: strings(pick(data.value.rollback_plan, data.value.rollback)) },
  { title: '测试策略', items: strings(pick(data.value.test_strategy, data.value.tests)) },
].filter((section) => section.items.length))

const reportSections = computed(() => [
  { title: '未完成事项', items: strings(data.value.incomplete_items) },
  { title: '遗留风险', items: strings(pick(data.value.residual_risks, data.value.risks)) },
  { title: '人工操作项', items: strings(data.value.manual_actions) },
].filter((section) => section.items.length))

const modules = computed(() => records(pick(data.value.impacted_modules, data.value.modules)))
const apiChanges = computed(() => records(data.value.api_changes))
const risks = computed(() => records(data.value.risks))
const acceptanceChecklist = computed(() => records(pick(data.value.acceptance_checklist, data.value.acceptance)))
const changedFiles = computed(() => records(pick(data.value.changed_files, data.value.files)))
const requirementMapping = computed(() => records(data.value.requirement_mapping))
const checks = computed(() => records(pick(data.value.checks, data.value.tests)))
const commits = computed(() => records(pick(data.value.git_commits, data.value.commits)))
const implementationChecklist = computed(() => records(pick(data.value.implementation_checklist, data.value.checklist)))
const testCases = computed(() => records(data.value.cases ?? data.value.test_cases))
const manualTestCases = computed(() => records(data.value.manual_test_cases))
const testPlanSections = computed(() => [
  { title: '测试范围', items: strings(data.value.test_scope) },
  { title: '测试环境', items: strings(data.value.test_environment) },
  { title: '前置条件', items: strings(data.value.preconditions) },
  { title: '风险点', items: strings(data.value.risk_points) },
  { title: '进入条件', items: strings(data.value.entry_criteria) },
  { title: '退出条件', items: strings(data.value.exit_criteria) },
].filter((section) => section.items.length))
const totals = computed(() => {
  const value = asRecord(data.value.totals)
  return {
    passed: Number(pick(value.passed, data.value.passed, 0)),
    failed: Number(pick(value.failed, data.value.failed, 0)),
    skipped: Number(pick(value.skipped, data.value.skipped, 0)),
    blocked: Number(pick(value.blocked, data.value.blocked, 0)),
  }
})
const testStatus = computed(() => {
  const status = String(data.value.status || '')
  if (status === 'passed') return { label: '通过', type: 'success' as const }
  if (status === 'failed') return { label: '功能不通过', type: 'danger' as const }
  return { label: '无法测试', type: 'warning' as const }
})
const executions = computed(() => records(pick(data.value.executions, data.value.results)))
const commands = computed(() => records(data.value.commands))
const failures = computed(() => strings(data.value.failures))
const artifactVersions = computed(() => Object.entries(asRecord(data.value.artifact_versions)).map(([type, version]) => ({ type, version })))

function answerText(answer: DataRecord) {
  const labels = strings(answer.answer_labels)
  if (labels.length) return labels.join('、')
  const raw = pick(answer.answer, answer.answer_value)
  const values = Array.isArray(raw) ? raw : [raw]
  const questionId = Number(answer.question_id)
  const questionText = display(answer.question)
  const question = props.clarificationRounds
    .flatMap((round) => round.questions)
    .find((item) => item.id === questionId || item.question === questionText)
  if (!question) return display(raw)
  const optionLabels = new Map(question.options.map((option) => [option.id, option.label]))
  const resolved = values.map((value) => optionLabels.get(String(value)) || display(value))
  return resolved.join('、') || '-'
}

function rowValue(row: DataRecord, ...keys: string[]) {
  return display(pick(...keys.map((key) => row[key]), row.value))
}

function userName(value: unknown) {
  const id = Number(value)
  return props.userNames[id] || (Number.isFinite(id) ? `用户 #${id}` : '-')
}

function statusType(value: unknown): 'success' | 'danger' | 'warning' | 'info' {
  const status = String(value || '').toLowerCase()
  if (['passed', 'success', 'succeeded', 'done', 'completed', 'approved'].includes(status)) return 'success'
  if (['failed', 'failure', 'rejected', 'blocked'].includes(status)) return 'danger'
  if (['running', 'pending', 'queued'].includes(status)) return 'warning'
  return 'info'
}

function artifactLabel(value: unknown) {
  const type = String(value || '')
  return artifactLabels[type] || type
}
</script>

<template>
  <div class="artifact-viewer">
    <div v-if="summary !== '-'" class="artifact-summary">{{ summary }}</div>

    <template v-if="artifactType === 'requirement_document'">
      <dl class="fact-grid">
        <dt>需求标题</dt><dd>{{ display(data.title) }}</dd>
        <dt>优先级</dt><dd>{{ display(data.priority) }}</dd>
        <dt>关联仓库</dt><dd>{{ strings(data.repository_ids).join('、') || '-' }}</dd>
      </dl>
      <section v-if="display(data.description) !== '-'" class="artifact-section"><h3>需求描述</h3><p>{{ display(data.description) }}</p></section>
      <section v-if="display(data.clarification_summary) !== '-'" class="artifact-section"><h3>澄清结论</h3><p>{{ display(data.clarification_summary) }}</p></section>
      <section v-if="confirmedAnswers.length" class="artifact-section">
        <h3>确认问答</h3>
        <div class="qa-list">
          <div v-for="(answer, index) in confirmedAnswers" :key="String(answer.question_id || index)">
            <strong>{{ index + 1 }}. {{ display(answer.question) }}</strong>
            <p>{{ answerText(answer) }}</p>
          </div>
        </div>
      </section>
      <section v-if="strings(data.acceptance_criteria).length" class="artifact-section"><h3>验收标准</h3><ul><li v-for="item in strings(data.acceptance_criteria)" :key="item">{{ item }}</li></ul></section>
    </template>

    <template v-else-if="artifactType === 'development_document'">
      <section v-for="section in developmentSections" :key="section.title" class="artifact-section"><h3>{{ section.title }}</h3><ol v-if="section.title === '实施步骤'"><li v-for="item in section.items" :key="item">{{ item }}</li></ol><ul v-else><li v-for="item in section.items" :key="item">{{ item }}</li></ul></section>
      <section v-if="modules.length" class="artifact-section"><h3>影响模块</h3><el-table :data="modules" size="small"><el-table-column label="模块" min-width="130"><template #default="{ row }">{{ rowValue(row, 'name', 'module') }}</template></el-table-column><el-table-column label="路径" min-width="170"><template #default="{ row }"><code>{{ rowValue(row, 'path') }}</code></template></el-table-column><el-table-column label="改动" min-width="220"><template #default="{ row }">{{ rowValue(row, 'change', 'description') }}</template></el-table-column></el-table></section>
      <section v-if="apiChanges.length" class="artifact-section"><h3>接口改动</h3><el-table :data="apiChanges" size="small"><el-table-column label="方法" width="90"><template #default="{ row }">{{ rowValue(row, 'method') }}</template></el-table-column><el-table-column label="路径" min-width="190"><template #default="{ row }"><code>{{ rowValue(row, 'path') }}</code></template></el-table-column><el-table-column label="说明" min-width="220"><template #default="{ row }">{{ rowValue(row, 'description') }}</template></el-table-column></el-table></section>
      <section v-if="risks.length" class="artifact-section"><h3>风险与应对</h3><el-table :data="risks" size="small"><el-table-column label="风险" min-width="220"><template #default="{ row }">{{ rowValue(row, 'risk') }}</template></el-table-column><el-table-column label="应对措施" min-width="220"><template #default="{ row }">{{ rowValue(row, 'mitigation') }}</template></el-table-column></el-table></section>
      <section v-if="acceptanceChecklist.length" class="artifact-section"><h3>验收清单</h3><div class="check-list"><div v-for="(item, index) in acceptanceChecklist" :key="index"><span>□</span>{{ rowValue(item, 'item', 'title') }}</div></div></section>
    </template>

    <template v-else-if="artifactType === 'development_report'">
      <div v-if="data.tests_passed !== undefined" class="result-banner" :class="data.tests_passed ? 'success' : 'danger'">测试{{ data.tests_passed ? '已通过' : '未通过' }}</div>
      <section v-if="changedFiles.length" class="artifact-section"><h3>修改文件</h3><el-table :data="changedFiles" size="small"><el-table-column label="文件" min-width="220"><template #default="{ row }"><code>{{ rowValue(row, 'path', 'file') }}</code></template></el-table-column><el-table-column label="改动说明" min-width="260"><template #default="{ row }">{{ rowValue(row, 'change', 'description') }}</template></el-table-column></el-table></section>
      <section v-if="requirementMapping.length" class="artifact-section"><h3>需求与实现对应关系</h3><el-table :data="requirementMapping" size="small"><el-table-column label="需求条目" min-width="220"><template #default="{ row }">{{ rowValue(row, 'requirement') }}</template></el-table-column><el-table-column label="实现方式" min-width="260"><template #default="{ row }">{{ rowValue(row, 'implementation') }}</template></el-table-column></el-table></section>
      <section v-if="checks.length" class="artifact-section"><h3>构建与测试</h3><el-table :data="checks" size="small"><el-table-column label="命令" min-width="190"><template #default="{ row }"><code>{{ rowValue(row, 'command') }}</code></template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ rowValue(row, 'status') }}</el-tag></template></el-table-column><el-table-column label="结果" min-width="220"><template #default="{ row }">{{ rowValue(row, 'summary', 'result') }}</template></el-table-column></el-table></section>
      <section v-for="section in reportSections" :key="section.title" class="artifact-section"><h3>{{ section.title }}</h3><ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul></section>
      <section v-if="commits.length" class="artifact-section"><h3>代码提交</h3><el-table :data="commits" size="small"><el-table-column label="提交" min-width="170"><template #default="{ row }"><code>{{ rowValue(row, 'head_commit', 'commit') }}</code></template></el-table-column><el-table-column label="说明" min-width="220"><template #default="{ row }">{{ rowValue(row, 'message') }}</template></el-table-column></el-table></section>
      <section v-if="implementationChecklist.length" class="artifact-section"><h3>实现检查清单</h3><div class="check-list"><div v-for="(item, index) in implementationChecklist" :key="index"><span>□</span>{{ rowValue(item, 'item', 'title') }}</div></div></section>
    </template>

    <template v-else-if="artifactType === 'test_plan'">
      <section v-for="section in testPlanSections" :key="section.title" class="artifact-section"><h3>{{ section.title }}</h3><ul><li v-for="item in section.items" :key="item">{{ item }}</li></ul></section>
      <div class="artifact-count">人工测试用例共 {{ manualTestCases.length }} 条</div>
      <section v-for="(testCase, index) in manualTestCases" :key="rowValue(testCase, 'id') + index" class="test-case">
        <div class="test-case-heading"><strong>{{ rowValue(testCase, 'id') }} · {{ rowValue(testCase, 'title') }}</strong><div><el-tag size="small" type="info">{{ rowValue(testCase, 'priority') }}</el-tag><el-tag size="small" type="info">人工执行</el-tag></div></div>
        <dl class="case-detail"><dt>前置条件</dt><dd><ol><li v-for="item in strings(testCase.preconditions)" :key="item">{{ item }}</li></ol></dd><dt>操作步骤</dt><dd><ol><li v-for="item in strings(testCase.steps)" :key="item">{{ item }}</li></ol></dd><dt>预期结果</dt><dd>{{ rowValue(testCase, 'expected_result') }}</dd></dl>
      </section>
    </template>

    <template v-else-if="artifactType === 'test_cases'">
      <div class="artifact-count">共 {{ testCases.length }} 条测试用例</div>
      <section v-for="(testCase, index) in testCases" :key="rowValue(testCase, 'id') + index" class="test-case">
        <div class="test-case-heading"><strong>{{ rowValue(testCase, 'id') }} · {{ rowValue(testCase, 'title') }}</strong><div><el-tag size="small">{{ rowValue(testCase, 'type') }}</el-tag><el-tag size="small" type="info">{{ rowValue(testCase, 'priority') }}</el-tag><el-tag size="small" :type="testCase.automated ? 'success' : 'info'">{{ testCase.automated ? '可自动化' : '人工执行' }}</el-tag></div></div>
        <dl class="case-detail"><dt>关联需求</dt><dd>{{ rowValue(testCase, 'requirement', 'requirement_link') }}</dd><dt>前置条件</dt><dd><ol><li v-for="item in strings(testCase.preconditions)" :key="item">{{ item }}</li></ol></dd><dt>执行步骤</dt><dd><ol><li v-for="item in strings(testCase.steps)" :key="item">{{ item }}</li></ol></dd><dt>预期结果</dt><dd>{{ rowValue(testCase, 'expected_result', 'expected') }}</dd></dl>
      </section>
    </template>

    <template v-else-if="artifactType === 'test_report'">
      <div class="result-banner" :class="testStatus.type">测试结论：{{ testStatus.label }}</div>
      <dl class="fact-grid"><dt>被测提交</dt><dd><code>{{ display(data.tested_commit) }}</code></dd><dt>结论摘要</dt><dd>{{ display(data.summary) }}</dd></dl>
      <div class="metric-row"><div><strong>{{ totals.passed }}</strong><span>通过</span></div><div><strong>{{ totals.failed }}</strong><span>失败</span></div><div><strong>{{ totals.skipped }}</strong><span>跳过</span></div><div><strong>{{ totals.blocked }}</strong><span>阻塞</span></div></div>
      <section v-if="executions.length" class="artifact-section"><h3>用例执行明细</h3><el-table :data="executions" size="small"><el-table-column label="用例" min-width="130"><template #default="{ row }">{{ rowValue(row, 'case_id', 'id') }}</template></el-table-column><el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)">{{ rowValue(row, 'status') }}</el-tag></template></el-table-column><el-table-column label="耗时" width="100"><template #default="{ row }">{{ row.duration_ms ? `${row.duration_ms} ms` : '-' }}</template></el-table-column><el-table-column label="证据" min-width="220"><template #default="{ row }">{{ rowValue(row, 'evidence', 'summary') }}</template></el-table-column></el-table></section>
      <section v-if="commands.length" class="artifact-section"><h3>执行命令</h3><el-table :data="commands" size="small"><el-table-column label="命令" min-width="220"><template #default="{ row }"><code>{{ rowValue(row, 'command') }}</code></template></el-table-column><el-table-column label="退出码" width="90"><template #default="{ row }">{{ rowValue(row, 'exit_code') }}</template></el-table-column><el-table-column label="执行证据" min-width="220"><template #default="{ row }">{{ rowValue(row, 'evidence', 'summary') }}</template></el-table-column></el-table></section>
      <section v-if="failures.length" class="artifact-section danger-section"><h3>失败信息</h3><ul><li v-for="item in failures" :key="item">{{ item }}</li></ul></section>
      <section v-if="display(data.log_summary) !== '-'" class="artifact-section"><h3>日志摘要</h3><p>{{ display(data.log_summary) }}</p></section>
    </template>

    <template v-else-if="artifactType === 'acceptance_record'">
      <div class="result-banner" :class="data.accepted ? 'success' : 'danger'">{{ data.accepted ? '已通过最终验收' : '未通过最终验收' }}</div>
      <dl class="fact-grid"><dt>验收人</dt><dd>{{ userName(data.reviewer_id) }}</dd><dt>验收意见</dt><dd>{{ display(data.comment) }}</dd></dl>
      <section v-if="artifactVersions.length" class="artifact-section"><h3>确认的产物版本</h3><el-table :data="artifactVersions" size="small"><el-table-column label="产物" min-width="200"><template #default="{ row }">{{ artifactLabel(row.type) }}</template></el-table-column><el-table-column prop="version" label="版本" width="100" /></el-table></section>
    </template>

    <template v-else>
      <StructuredDataViewer :value="content" />
    </template>

    <el-collapse class="raw-data"><el-collapse-item title="查看原始数据"><pre>{{ rawJson }}</pre></el-collapse-item></el-collapse>
  </div>
</template>

<style scoped>
.artifact-viewer { color: #303844; font-size: 13px; line-height: 1.7; }
.artifact-summary { padding: 12px 14px; margin-bottom: 18px; background: #f7f8fa; border-left: 3px solid #d20a10; font-size: 14px; }
.artifact-section { padding: 0 0 18px; margin: 0 0 18px; border-bottom: 1px solid #ebeef2; }
.artifact-section h3 { margin: 0 0 10px; font-size: 14px; }
.artifact-section p, .artifact-section ul, .artifact-section ol { margin: 0; }
.artifact-section ul, .artifact-section ol { padding-left: 22px; }
.fact-grid, .case-detail { display: grid; grid-template-columns: 110px minmax(0, 1fr); margin: 0 0 18px; border-top: 1px solid #e5e8ec; }
.fact-grid dt, .fact-grid dd, .case-detail dt, .case-detail dd { margin: 0; padding: 9px 11px; border-bottom: 1px solid #e5e8ec; }
.fact-grid dt, .case-detail dt { color: #66707d; background: #f7f8fa; font-weight: 600; }
.qa-list > div { padding: 11px 0; border-bottom: 1px solid #ebeef2; }
.qa-list > div:last-child { border-bottom: 0; }
.qa-list p { margin: 6px 0 0; color: #4d5663; }
.check-list { display: grid; gap: 8px; }
.check-list > div { display: flex; gap: 8px; }
.check-list span { color: #d20a10; font-weight: 700; }
.result-banner { padding: 10px 13px; margin-bottom: 18px; border-left: 3px solid; font-weight: 600; }
.result-banner.success { color: #277248; background: #f0f8f3; border-color: #3b8a60; }
.result-banner.danger { color: #a52e32; background: #fff4f4; border-color: #d64545; }
.result-banner.warning { color: #8a5a00; background: #fff8e8; border-color: #d99a24; }
.artifact-count { margin-bottom: 12px; color: #68717d; }
.test-case { padding: 15px 0; border-top: 1px solid #e5e8ec; }
.test-case-heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.test-case-heading > div { display: flex; gap: 6px; flex-wrap: wrap; }
.case-detail { margin-bottom: 0; }
.case-detail ol { margin: 0; padding-left: 20px; }
.metric-row { display: grid; grid-template-columns: repeat(4, minmax(90px, 1fr)); margin-bottom: 18px; border: 1px solid #e1e5ea; }
.metric-row > div { min-height: 72px; padding: 12px; display: flex; flex-direction: column; justify-content: center; text-align: center; border-right: 1px solid #e1e5ea; }
.metric-row > div:last-child { border-right: 0; }
.metric-row strong { font-size: 22px; }
.metric-row span { color: #7a8491; }
.danger-section { color: #a52e32; }
.raw-data { margin-top: 6px; }
.raw-data pre { max-height: 420px; margin: 0; padding: 12px; overflow: auto; background: #f7f8fa; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.65 Consolas, monospace; }
code { color: #394150; font-family: Consolas, monospace; }
@media (max-width: 700px) { .fact-grid, .case-detail { grid-template-columns: 1fr; } .fact-grid dt, .case-detail dt { border-bottom: 0; } .metric-row { grid-template-columns: repeat(2, 1fr); } .test-case-heading { flex-direction: column; } }
</style>
