import type { PriorityCode, ReviewGate, RunStatus, StageCode } from '@/api/types'

export const stageOrder: StageCode[] = [
  'requirement_draft',
  'requirement_clarification',
  'development_document_generation',
  'development_document_review',
  'development',
  'development_report_review',
  'test_plan_generation',
  'test_plan_review',
  'final_acceptance',
]

export const stageLabels: Record<StageCode, string> = {
  requirement_draft: '需求描述',
  requirement_clarification: '需求澄清',
  development_document_generation: '开发文档生成',
  development_document_review: '开发文档审批',
  development: '开发实现',
  development_report_review: '开发报告审批',
  test_plan_generation: '测试方案生成',
  test_plan_review: '测试方案审批',
  final_acceptance: '最终验收',
  completed: '已完成',
}

export const runStatusConfig: Record<
  RunStatus,
  { label: string; type: 'success' | 'warning' | 'info' | 'danger' | 'primary' }
> = {
  idle: { label: '空闲', type: 'info' },
  running: { label: '运行中', type: 'primary' },
  waiting_human: { label: '等待人工处理', type: 'warning' },
  paused: { label: '已暂停', type: 'warning' },
  failed: { label: '失败', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
}

export const priorityColors: Record<PriorityCode, string> = {
  P0: '#d64545',
  P1: '#d98118',
  P2: '#2678c9',
  P3: '#697386',
}

export const gateLabels: Record<ReviewGate, string> = {
  development_document: '开发文档',
  development_report: '开发报告',
  test_plan: '测试方案',
  final_acceptance: '最终验收',
}

export const artifactLabels: Record<string, string> = {
  requirement_document: '需求文档',
  development_document: '开发文档',
  development_report: '开发报告',
  test_plan: '测试方案',
  test_cases: '测试用例',
  test_report: '测试报告',
  acceptance_record: '验收记录',
}

export const taskSummaryByStage: Partial<Record<StageCode, string>> = {
  development_document_generation: '根据已确认的需求文档生成开发文档',
  development: '实施代码改动、运行最小单元与冒烟检查，并生成开发报告',
  test_plan_generation: '根据已审批的开发报告生成测试方案和人工测试用例',
}
