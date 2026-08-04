// @ts-nocheck -- Legacy v2.1 fixtures are isolated to explicit demo mode.
import type { User, Requirement, Clarification, Proposal, Repository, Branch, Pipeline, PipelineStage, AgentTask, Project, ProjectRepository } from '@/api/types'

// ============ 用户 ============
export const mockUsers: User[] = [
  { id: 1, username: 'zhangsan', email: 'zhangsan@example.com', role: 'pm' },
  { id: 2, username: 'lisi', email: 'lisi@example.com', role: 'developer' },
  { id: 3, username: 'wangwu', email: 'wangwu@example.com', role: 'qa' },
  { id: 4, username: 'admin', email: 'admin@example.com', role: 'admin' },
]

export const userNameMap: Record<number, string> = {
  1: '张三',
  2: '李四',
  3: '王五',
  4: '管理员',
}

// ============ 项目空间 ============
export const mockProjects: Project[] = [
  {
    id: 1,
    name: '用户服务平台',
    description: '包含用户注册、登录、权限管理等核心服务',
    repository_count: 2,
    requirement_count: 5,
    created_at: '2026-07-01T10:00:00Z',
  },
  {
    id: 2,
    name: '电商交易系统',
    description: '订单、支付、库存等交易核心模块',
    repository_count: 3,
    requirement_count: 3,
    created_at: '2026-07-05T08:00:00Z',
  },
  {
    id: 3,
    name: '数据分析平台',
    description: 'BI 报表、数据可视化、ETL 流水线',
    repository_count: 1,
    requirement_count: 2,
    created_at: '2026-07-10T14:00:00Z',
  },
]

// ============ 项目-仓库关联 ============
export const mockProjectRepositories: ProjectRepository[] = [
  { project_id: 1, repository_id: 1 },
  { project_id: 1, repository_id: 2 },
  { project_id: 2, repository_id: 3 },
  { project_id: 2, repository_id: 4 },
  { project_id: 2, repository_id: 5 },
  { project_id: 3, repository_id: 6 },
]

// ============ 仓库 ============
export const mockRepositories: Repository[] = [
  { id: 1, name: 'user-service', git_url: 'https://gitee.com/org/user-service', default_branch: 'main', is_active: true },
  { id: 2, name: 'auth-middleware', git_url: 'https://gitee.com/org/auth-middleware', default_branch: 'main', is_active: true },
  { id: 3, name: 'order-service', git_url: 'https://gitee.com/org/order-service', default_branch: 'main', is_active: true },
  { id: 4, name: 'payment-gateway', git_url: 'https://gitee.com/org/payment-gateway', default_branch: 'main', is_active: true },
  { id: 5, name: 'inventory-service', git_url: 'https://gitee.com/org/inventory-service', default_branch: 'master', is_active: false },
  { id: 6, name: 'data-pipeline', git_url: 'https://gitee.com/org/data-pipeline', default_branch: 'main', is_active: true },
]

// ============ 需求 ============
export const mockRequirements: Requirement[] = [
  {
    id: 1,
    project_id: 1,
    title: '用户认证模块重构 — 支持 OAuth2.0 + 多因素认证',
    description: `## 背景\n\n当前用户认证模块基于简单的 JWT 实现，无法满足日益增长的安全需求。\n\n## 目标\n\n1. 支持 OAuth2.0 第三方登录（微信、钉钉）\n2. 支持 TOTP 多因素认证\n3. 实现 Token 刷新机制（Refresh Token）\n4. 支持设备管理（查看/踢出已登录设备）\n\n## 验收标准\n\n- 用户可以通过微信扫码登录\n- 开启 MFA 后，登录需输入动态码\n- Token 过期后自动刷新，用户无感知\n- 管理后台可查看用户的所有在线设备`,
    team_issue_id: 'TEAM-1024',
    team_issue_url: 'https://team.example.com/issues/TEAM-1024',
    priority: 'P0',
    status: 'clarifying',
    created_by: 1,
    assigned_to: 2,
    ai_review_report: {
      report_id: 'FA-20260724-001',
      feasibility: 'feasible',
      summary: '基于现有代码架构分析，该需求技术上可行，现有模块化架构支持新增认证功能',
      analysis: [
        { aspect: '架构兼容性', result: 'compatible', detail: '现有模块化架构支持新增 OAuth2.0 和 MFA 功能，无需大规模重构' },
        { aspect: '影响范围', result: 'moderate', detail: '预计影响 3 个模块：user_service, auth_middleware, api_router' },
        { aspect: '技术风险', result: 'low', detail: '无明显技术风险，OAuth2.0 和 TOTP 均为成熟方案' },
      ],
      repositories_analyzed: ['user-service', 'auth-middleware'],
    },
    created_at: '2026-07-20T09:00:00Z',
    updated_at: '2026-07-23T14:30:00Z',
  },
  {
    id: 2,
    project_id: 2,
    title: '订单导出功能 — 支持自定义字段 + 大数据量异步导出',
    description: `## 背景\n\n运营团队需要定期导出订单数据进行分析，现有导出功能仅支持固定字段且数据量受限。\n\n## 目标\n\n1. 支持用户自定义选择导出字段\n2. 支持百万级数据量的异步导出\n3. 导出文件格式支持 CSV 和 Excel\n4. 导出任务完成后通知用户下载`,
    priority: 'P1',
    status: 'coding',
    created_by: 1,
    ai_review_report: { feasibility: 'feasible', summary: '技术上完全可行，建议使用 Celery 异步任务队列' },
    created_at: '2026-07-19T10:30:00Z',
    updated_at: '2026-07-22T16:00:00Z',
  },
  {
    id: 3,
    project_id: 2,
    title: '商品搜索优化 — Elasticsearch 集成 + 智能推荐',
    description: `## 背景\n\n当前商品搜索基于数据库 LIKE 查询，搜索体验差。\n\n## 目标\n\n1. 引入 Elasticsearch 替代数据库搜索\n2. 支持中文分词、拼音搜索\n3. 基于用户行为数据实现智能排序\n4. 搜索响应时间 < 200ms`,
    team_issue_id: 'TEAM-1030',
    team_issue_url: 'https://team.example.com/issues/TEAM-1030',
    priority: 'P1',
    status: 'testing',
    created_by: 1,
    assigned_to: 2,
    ai_review_report: { feasibility: 'feasible', summary: 'ES 集成方案成熟，需注意数据同步一致性' },
    created_at: '2026-07-18T08:00:00Z',
    updated_at: '2026-07-24T09:00:00Z',
  },
  {
    id: 4,
    project_id: 2,
    title: '消息通知中心 — 站内信 + 邮件 + 短信多渠道',
    description: `## 背景\n\n系统通知散落在各处，缺乏统一的消息管理中心。\n\n## 目标\n\n1. 建立统一消息通知中心\n2. 支持站内信、邮件、短信三种渠道\n3. 用户可自定义通知接收偏好`,
    priority: 'P2',
    status: 'delivered',
    created_by: 1,
    ai_review_report: null,
    created_at: '2026-07-10T11:00:00Z',
    updated_at: '2026-07-21T17:00:00Z',
  },
  {
    id: 5,
    project_id: 3,
    title: '数据报表 Dashboard — 实时数据可视化看板',
    description: `## 背景\n\n管理层需要一个实时数据看板来了解业务运营状况。\n\n## 目标\n\n1. 支持自定义 Dashboard 布局\n2. 集成图表组件\n3. 支持数据钻取`,
    priority: 'P2',
    status: 'reviewing',
    created_by: 1,
    ai_review_report: { feasibility: 'feasible', summary: '可基于现有数据仓库构建' },
    created_at: '2026-07-21T09:00:00Z',
    updated_at: '2026-07-23T10:00:00Z',
  },
  {
    id: 6,
    project_id: 1,
    title: '权限管理系统 — RBAC 模型 + 数据权限',
    description: `## 背景\n\n现有权限系统过于简单，无法满足多部门精细化管理需求。\n\n## 目标\n\n1. 实现 RBAC 权限模型\n2. 支持数据权限（行级/列级控制）\n3. 支持权限批量配置`,
    priority: 'P0',
    status: 'coding',
    created_by: 4,
    assigned_to: 2,
    ai_review_report: null,
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-24T08:00:00Z',
  },
  {
    id: 7,
    project_id: 1,
    title: 'API 网关限流优化 — 基于令牌桶算法',
    description: `## 背景\n\n当前 API 限流策略基于简单的计数器，存在突发流量问题。\n\n## 目标\n\n1. 采用令牌桶算法替代计数器\n2. 支持多维度限流\n3. 限流规则支持动态配置`,
    priority: 'P3',
    status: 'draft',
    created_by: 2,
    ai_review_report: null,
    created_at: '2026-07-23T15:00:00Z',
    updated_at: '2026-07-23T15:00:00Z',
  },
  {
    id: 8,
    project_id: 3,
    title: '文件存储服务迁移 — MinIO 到阿里云 OSS',
    description: `## 背景\n\nMinIO 运维成本高，计划迁移到阿里云 OSS。\n\n## 目标\n\n1. 实现文件存储从 MinIO 到 OSS 的平滑迁移\n2. 历史数据批量迁移工具\n3. 双写过渡期方案`,
    priority: 'P1',
    status: 'clarified',
    created_by: 4,
    ai_review_report: { feasibility: 'feasible', summary: '迁移方案成熟，建议采用双写过渡' },
    created_at: '2026-07-17T14:00:00Z',
    updated_at: '2026-07-22T11:00:00Z',
  },
  {
    id: 9,
    project_id: 1,
    title: '移动端适配 — H5 页面响应式改造',
    description: `## 背景\n\n用户反馈在移动端使用体验差，需要进行响应式适配。\n\n## 目标\n\n1. 核心页面响应式适配\n2. 移动端手势支持\n3. 图片懒加载优化`,
    priority: 'P2',
    status: 'clarifying',
    created_by: 1,
    ai_review_report: { feasibility: 'feasible', summary: '前端框架已支持响应式，需调整布局组件' },
    created_at: '2026-07-22T10:00:00Z',
    updated_at: '2026-07-24T11:00:00Z',
  },
  {
    id: 10,
    project_id: 1,
    title: '日志收集与告警系统 — ELK + Prometheus',
    description: `## 背景\n\n缺乏统一的日志收集和告警机制。\n\n## 目标\n\n1. 搭建 ELK 日志收集平台\n2. 集成 Prometheus + AlertManager\n3. 关键错误实时推送钉钉群`,
    priority: 'P3',
    status: 'analyzing',
    created_by: 2,
    ai_review_report: null,
    created_at: '2026-07-24T08:30:00Z',
    updated_at: '2026-07-24T08:30:00Z',
  },
]

// ============ 澄清问题（选项框） ============
export const mockClarificationOptions: Clarification[] = [
  {
    id: 1,
    requirement_id: 1,
    question: '用户认证方式选择？',
    type: 'single',
    options: [
      { id: 'a', label: 'OAuth2.0', description: '第三方登录标准协议' },
      { id: 'b', label: 'JWT Token', description: '无状态令牌认证' },
      { id: 'c', label: 'Session Cookie', description: '传统会话管理' },
      { id: 'd', label: '多因素认证', description: '结合多种认证方式' },
    ],
    selected: null,
    ai_recommendation: 'a',
    round: 1,
    created_at: '2026-07-21T10:00:00Z',
  },
  {
    id: 2,
    requirement_id: 1,
    question: 'Token 刷新机制选择哪种方案？',
    type: 'single',
    options: [
      { id: 'a', label: '双 Token 机制', description: 'Access Token + Refresh Token，安全性高' },
      { id: 'b', label: '单 Token 续期', description: '简单实现，每次请求续期' },
      { id: 'c', label: '滑动窗口', description: '固定时间窗口内自动续期' },
    ],
    selected: null,
    ai_recommendation: 'a',
    round: 1,
    created_at: '2026-07-21T10:00:00Z',
  },
  {
    id: 3,
    requirement_id: 1,
    question: '设备指纹识别方案选择？',
    type: 'single',
    options: [
      { id: 'a', label: 'fingerprint.js', description: '开源方案，准确率高' },
      { id: 'b', label: 'UA + IP 组合', description: '简单实现，准确率一般' },
      { id: 'c', label: '客户端 SDK', description: '需集成第三方 SDK' },
    ],
    selected: null,
    round: 2,
    created_at: '2026-07-23T14:30:00Z',
  },
  {
    id: 4,
    requirement_id: 9,
    question: '需要适配的最低移动端系统版本？',
    type: 'single',
    options: [
      { id: 'a', label: 'iOS 12+ / Android 8+', description: '覆盖 95% 用户' },
      { id: 'b', label: 'iOS 14+ / Android 10+', description: '覆盖 85% 用户，开发成本低' },
      { id: 'c', label: 'iOS 16+ / Android 12+', description: '仅最新系统，开发最快' },
    ],
    selected: null,
    ai_recommendation: 'a',
    round: 1,
    created_at: '2026-07-24T11:00:00Z',
  },
  {
    id: 5,
    requirement_id: 9,
    question: '需要优先适配的页面范围？',
    type: 'multiple',
    options: [
      { id: 'a', label: '首页/列表页', description: '用户使用频率最高' },
      { id: 'b', label: '详情页/表单页', description: '核心操作页面' },
      { id: 'c', label: '个人中心', description: '账户管理相关' },
      { id: 'd', label: '管理后台', description: '管理员使用' },
    ],
    selected: null,
    round: 1,
    created_at: '2026-07-24T11:00:00Z',
  },
]

// ============ 方案文档 ============
export const mockProposals: Proposal[] = [
  {
    id: 1,
    requirement_id: 2,
    title: '订单导出功能技术方案',
    content: `# 技术方案：订单导出功能\n\n## 1. 背景与目标\n基于需求 REQ-002，实现支持自定义字段、百万级数据量的异步订单导出功能。\n\n## 2. 架构设计\n- **前端**：导出配置面板（字段选择、格式选择）+ 导出任务列表\n- **后端**：异步任务队列（Celery）+ 文件存储（OSS）\n- **流程**：用户提交导出任务 → 入队 → Worker 分批查询 → 生成文件 → 上传 OSS → 通知用户\n\n## 3. 接口定义\n\n### POST /api/v1/exports\n创建导出任务\n\n| 参数 | 类型 | 说明 |\n|------|------|------|\n| fields | string[] | 导出字段列表 |\n| format | string | csv / xlsx |\n| filters | object | 筛选条件 |\n\n### GET /api/v1/exports/{id}\n查询导出任务状态\n\n### GET /api/v1/exports/{id}/download\n下载导出文件（签名 URL）\n\n## 4. 数据库变更\n\n新增 \`export_task\` 表\n\n## 5. 影响范围评估\n- 新增独立模块，不影响现有功能\n- 需要 Celery Worker 资源\n\n## 6. 风险与注意事项\n- 大数据量导出时需注意数据库连接超时\n- 文件生成后需设置过期时间（7 天自动清理）`,
    status: 'approved',
    reviewed_by: 2,
    review_comment: '方案合理，通过',
    selected_repos: [3, 4],
    created_at: '2026-07-20T14:00:00Z',
    updated_at: '2026-07-21T09:00:00Z',
  },
  {
    id: 2,
    requirement_id: 3,
    title: '商品搜索优化技术方案',
    content: `# 技术方案：商品搜索优化\n\n## 1. 背景与目标\n引入 Elasticsearch 替代数据库 LIKE 查询，提升搜索体验和性能。\n\n## 2. 架构设计\n- 数据同步：MySQL → Canal → ES（增量同步）\n- 搜索服务：封装 SearchService 统一管理\n- 分词器：IK Analysis + Pinyin 插件\n\n## 3. 接口定义\n\n### GET /api/v1/products/search\n\n| 参数 | 类型 | 说明 |\n|------|------|------|\n| q | string | 搜索关键词 |\n| category_id | int | 分类筛选 |\n| sort | string | 排序字段 |\n\n## 4. 影响范围\n- 商品列表页搜索逻辑替换\n- 新增 ES 集群运维`,
    status: 'reviewing',
    selected_repos: [3],
    created_at: '2026-07-22T10:00:00Z',
    updated_at: '2026-07-23T15:00:00Z',
  },
  {
    id: 3,
    requirement_id: 5,
    title: '数据报表 Dashboard 技术方案',
    content: `# 技术方案：数据报表 Dashboard\n\n## 1. 背景与目标\n为管理层提供实时数据可视化看板。\n\n## 2. 架构设计\n- 前端：ECharts + 可拖拽布局\n- 后端：数据聚合服务 + Redis 缓存\n- 数据源：ClickHouse OLAP 查询\n\n## 3. 功能模块\n- 自定义看板布局\n- 图表组件库\n- 数据钻取\n- 定时刷新`,
    status: 'reviewing',
    selected_repos: [6],
    created_at: '2026-07-23T10:00:00Z',
    updated_at: '2026-07-23T10:00:00Z',
  },
  {
    id: 4,
    requirement_id: 6,
    title: '权限管理系统技术方案',
    content: `# 技术方案：权限管理系统 — RBAC 模型\n\n## 1. 背景与目标\n实现基于 RBAC 的精细化权限管理，支持数据权限控制。\n\n## 2. 架构设计\n- **权限模型**：用户 → 角色 → 权限（菜单+按钮+数据）\n- **数据权限**：基于注解的行级/列级过滤\n- **缓存策略**：Redis 缓存用户权限树\n\n## 3. 接口定义\n\n### GET /api/v1/rbac/roles\n角色列表\n\n### POST /api/v1/rbac/roles\n创建角色\n\n### PUT /api/v1/rbac/roles/{id}/permissions\n分配权限\n\n## 4. 数据库变更\n\n| 表 | 说明 |\n|---|---|\n| rbac_role | 角色表 |\n| rbac_permission | 权限表 |\n| rbac_role_permission | 角色-权限关联表 |\n| rbac_user_role | 用户-角色关联表 |\n\n## 5. 影响范围\n- 所有现有接口需添加权限注解\n- 前端侧边栏菜单需根据权限动态渲染`,
    status: 'approved',
    reviewed_by: 2,
    review_comment: '方案完整，数据权限部分需后续补充细节',
    selected_repos: [1, 2],
    created_at: '2026-07-18T10:00:00Z',
    updated_at: '2026-07-19T14:00:00Z',
  },
  {
    id: 5,
    requirement_id: 1,
    title: '用户认证模块重构技术方案',
    content: `# 技术方案：用户认证模块重构\n\n## 1. 背景与目标\n重构认证模块，支持 OAuth2.0 + MFA + 设备管理。\n\n## 2. 架构设计\n- **OAuth2.0**：Authorization Code Flow + PKCE\n- **MFA**：基于 TOTP 算法（RFC 6238）\n- **Token 刷新**：双 Token 机制（Access 15min + Refresh 7d）\n- **设备管理**：基于 UA + IP 指纹的设备识别\n\n## 3. 接口定义\n\n### POST /api/v1/auth/oauth/{provider}\n第三方 OAuth 登录\n\n### POST /api/v1/auth/mfa/enable\n开启 MFA\n\n### POST /api/v1/auth/token/refresh\n刷新 Token\n\n### GET /api/v1/auth/devices\n获取在线设备列表\n\n### DELETE /api/v1/auth/devices/{id}\n踢出指定设备\n\n## 4. 影响范围\n- auth_middleware 全面重构\n- user_service 新增设备管理模块\n- 前端登录页面改造`,
    status: 'draft',
    selected_repos: [1, 2],
    created_at: '2026-07-23T16:00:00Z',
    updated_at: '2026-07-24T09:00:00Z',
  },
]

// ============ 分支 ============
export const mockBranches: Branch[] = [
  { id: 1, repository_id: 3, name: 'feature/REQ-2-order-export', base_branch: 'main', requirement_id: 2, status: 'active' },
  { id: 2, repository_id: 3, name: 'feature/REQ-3-search-es', base_branch: 'main', requirement_id: 3, status: 'active' },
  { id: 3, repository_id: 3, name: 'feature/REQ-4-notification', base_branch: 'main', requirement_id: 4, status: 'merged' },
  { id: 4, repository_id: 1, name: 'feature/REQ-6-rbac', base_branch: 'main', requirement_id: 6, status: 'active' },
]

// ============ 流水线 ============
export const mockPipelines: Pipeline[] = [
  { id: 1, requirement_id: 2, status: 'running', current_stage: 'development', started_at: '2026-07-22T09:00:00Z', created_at: '2026-07-22T09:00:00Z' },
  { id: 2, requirement_id: 3, status: 'running', current_stage: 'final_acceptance', started_at: '2026-07-23T10:00:00Z', created_at: '2026-07-23T10:00:00Z' },
  { id: 3, requirement_id: 4, status: 'completed', current_stage: 'completed', started_at: '2026-07-12T09:00:00Z', completed_at: '2026-07-21T17:00:00Z', created_at: '2026-07-12T09:00:00Z' },
  { id: 4, requirement_id: 6, status: 'running', current_stage: 'development_report_review', started_at: '2026-07-20T08:00:00Z', created_at: '2026-07-20T08:00:00Z' },
  { id: 5, requirement_id: 5, status: 'running', current_stage: 'development_document_review', started_at: '2026-07-23T10:00:00Z', created_at: '2026-07-23T10:00:00Z' },
]

// ============ 流水线阶段（8个阶段） ============
export const mockPipelineStages: PipelineStage[] = [
  // Pipeline #1 - running, at development (req 2)
  { id: 1, pipeline_id: 1, stage_name: 'requirement_description', stage_order: 1, status: 'completed', started_at: '2026-07-22T09:00:00Z', completed_at: '2026-07-22T09:05:00Z' },
  { id: 2, pipeline_id: 1, stage_name: 'clarification', stage_order: 2, status: 'completed', started_at: '2026-07-22T09:05:00Z', completed_at: '2026-07-22T09:30:00Z' },
  { id: 3, pipeline_id: 1, stage_name: 'development_document_generation', stage_order: 3, status: 'completed', started_at: '2026-07-22T09:30:00Z', completed_at: '2026-07-22T09:45:00Z' },
  { id: 4, pipeline_id: 1, stage_name: 'development_document_review', stage_order: 4, status: 'completed', started_at: '2026-07-22T09:45:00Z', completed_at: '2026-07-22T14:00:00Z' },
  { id: 6, pipeline_id: 1, stage_name: 'development', stage_order: 5, status: 'running', started_at: '2026-07-22T14:02:00Z' },
  { id: 7, pipeline_id: 1, stage_name: 'development_report_review', stage_order: 6, status: 'pending' },
  { id: 8, pipeline_id: 1, stage_name: 'final_acceptance', stage_order: 7, status: 'pending' },
  { id: 9, pipeline_id: 1, stage_name: 'completed', stage_order: 8, status: 'pending' },

  // Pipeline #2 - waiting for human testing and final acceptance (req 3)
  { id: 10, pipeline_id: 2, stage_name: 'requirement_description', stage_order: 1, status: 'completed', started_at: '2026-07-23T10:00:00Z', completed_at: '2026-07-23T10:08:00Z' },
  { id: 11, pipeline_id: 2, stage_name: 'clarification', stage_order: 2, status: 'completed', started_at: '2026-07-23T10:08:00Z', completed_at: '2026-07-23T10:20:00Z' },
  { id: 12, pipeline_id: 2, stage_name: 'development_document_generation', stage_order: 3, status: 'completed', started_at: '2026-07-23T10:20:00Z', completed_at: '2026-07-23T10:40:00Z' },
  { id: 13, pipeline_id: 2, stage_name: 'development_document_review', stage_order: 4, status: 'completed', started_at: '2026-07-23T10:40:00Z', completed_at: '2026-07-23T15:00:00Z' },
  { id: 15, pipeline_id: 2, stage_name: 'development', stage_order: 5, status: 'completed', started_at: '2026-07-23T15:02:00Z', completed_at: '2026-07-23T15:30:00Z' },
  { id: 16, pipeline_id: 2, stage_name: 'development_report_review', stage_order: 6, status: 'completed', started_at: '2026-07-23T15:30:00Z', completed_at: '2026-07-24T09:00:00Z' },
  { id: 17, pipeline_id: 2, stage_name: 'final_acceptance', stage_order: 7, status: 'running', started_at: '2026-07-24T09:00:00Z' },
  { id: 18, pipeline_id: 2, stage_name: 'completed', stage_order: 8, status: 'pending' },

  // Pipeline #3 — completed (req 4)
  { id: 19, pipeline_id: 3, stage_name: 'requirement_description', stage_order: 1, status: 'completed', started_at: '2026-07-12T09:00:00Z', completed_at: '2026-07-12T09:10:00Z' },
  { id: 20, pipeline_id: 3, stage_name: 'clarification', stage_order: 2, status: 'completed', started_at: '2026-07-12T09:10:00Z', completed_at: '2026-07-12T10:00:00Z' },
  { id: 21, pipeline_id: 3, stage_name: 'development_document_generation', stage_order: 3, status: 'completed', started_at: '2026-07-12T10:00:00Z', completed_at: '2026-07-12T10:30:00Z' },
  { id: 22, pipeline_id: 3, stage_name: 'development_document_review', stage_order: 4, status: 'completed', started_at: '2026-07-12T10:30:00Z', completed_at: '2026-07-13T09:00:00Z' },
  { id: 24, pipeline_id: 3, stage_name: 'development', stage_order: 5, status: 'completed', started_at: '2026-07-13T09:02:00Z', completed_at: '2026-07-13T09:40:00Z' },
  { id: 25, pipeline_id: 3, stage_name: 'development_report_review', stage_order: 6, status: 'completed', started_at: '2026-07-13T09:40:00Z', completed_at: '2026-07-14T10:00:00Z' },
  { id: 26, pipeline_id: 3, stage_name: 'final_acceptance', stage_order: 7, status: 'completed', started_at: '2026-07-14T10:00:00Z', completed_at: '2026-07-14T10:20:00Z' },
  { id: 27, pipeline_id: 3, stage_name: 'completed', stage_order: 8, status: 'completed', started_at: '2026-07-21T17:00:00Z', completed_at: '2026-07-21T17:00:00Z' },

  // Pipeline #4 — running, at code_review (req 6)
  { id: 28, pipeline_id: 4, stage_name: 'requirement_description', stage_order: 1, status: 'completed', started_at: '2026-07-20T08:00:00Z', completed_at: '2026-07-20T08:05:00Z' },
  { id: 29, pipeline_id: 4, stage_name: 'clarification', stage_order: 2, status: 'completed', started_at: '2026-07-20T08:05:00Z', completed_at: '2026-07-20T09:00:00Z' },
  { id: 30, pipeline_id: 4, stage_name: 'development_document_generation', stage_order: 3, status: 'completed', started_at: '2026-07-20T09:00:00Z', completed_at: '2026-07-20T09:20:00Z' },
  { id: 31, pipeline_id: 4, stage_name: 'development_document_review', stage_order: 4, status: 'completed', started_at: '2026-07-20T09:20:00Z', completed_at: '2026-07-20T14:00:00Z' },
  { id: 33, pipeline_id: 4, stage_name: 'development', stage_order: 5, status: 'completed', started_at: '2026-07-20T14:02:00Z', completed_at: '2026-07-20T14:30:00Z' },
  { id: 34, pipeline_id: 4, stage_name: 'development_report_review', stage_order: 6, status: 'waiting_review', started_at: '2026-07-20T14:30:00Z' },
  { id: 35, pipeline_id: 4, stage_name: 'final_acceptance', stage_order: 7, status: 'pending' },
  { id: 36, pipeline_id: 4, stage_name: 'completed', stage_order: 8, status: 'pending' },

  // Pipeline #5 — running, at proposal_approval (req 5)
  { id: 37, pipeline_id: 5, stage_name: 'requirement_description', stage_order: 1, status: 'completed', started_at: '2026-07-23T10:00:00Z', completed_at: '2026-07-23T10:05:00Z' },
  { id: 38, pipeline_id: 5, stage_name: 'clarification', stage_order: 2, status: 'completed', started_at: '2026-07-23T10:05:00Z', completed_at: '2026-07-23T10:15:00Z' },
  { id: 39, pipeline_id: 5, stage_name: 'development_document_generation', stage_order: 3, status: 'completed', started_at: '2026-07-23T10:15:00Z', completed_at: '2026-07-23T10:30:00Z' },
  { id: 40, pipeline_id: 5, stage_name: 'development_document_review', stage_order: 4, status: 'waiting_review', started_at: '2026-07-23T10:30:00Z' },
  { id: 42, pipeline_id: 5, stage_name: 'development', stage_order: 5, status: 'pending' },
  { id: 43, pipeline_id: 5, stage_name: 'development_report_review', stage_order: 6, status: 'pending' },
  { id: 44, pipeline_id: 5, stage_name: 'final_acceptance', stage_order: 7, status: 'pending' },
  { id: 45, pipeline_id: 5, stage_name: 'completed', stage_order: 8, status: 'pending' },
]

// ============ Agent 任务 ============
export const mockAgentTasks: AgentTask[] = [
  { id: 1, pipeline_stage_id: 6, agent_type: 'code_generator', status: 'running', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 12500, completion_tokens: 3200, total_tokens: 15700 }, duration_ms: 45000, retry_count: 0, created_at: '2026-07-22T14:02:00Z' },
  { id: 3, pipeline_stage_id: 34, agent_type: 'code_reviewer', status: 'completed', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 11200, completion_tokens: 3500, total_tokens: 14700 }, duration_ms: 22000, retry_count: 0, created_at: '2026-07-20T14:30:00Z' },
  { id: 4, pipeline_stage_id: 1, agent_type: 'requirement_analyst', status: 'completed', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 3200, completion_tokens: 1500, total_tokens: 4700 }, duration_ms: 12000, retry_count: 0, created_at: '2026-07-22T09:00:00Z' },
  { id: 5, pipeline_stage_id: 3, agent_type: 'proposal_generator', status: 'completed', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 9800, completion_tokens: 4200, total_tokens: 14000 }, duration_ms: 35000, retry_count: 0, created_at: '2026-07-22T09:30:00Z' },
  { id: 6, pipeline_stage_id: 33, agent_type: 'code_generator', status: 'completed', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 15000, completion_tokens: 5800, total_tokens: 20800 }, duration_ms: 52000, retry_count: 1, created_at: '2026-07-20T14:02:00Z' },
  { id: 7, pipeline_stage_id: 24, agent_type: 'code_generator', status: 'completed', model_name: 'deepseek-chat', token_usage: { prompt_tokens: 13500, completion_tokens: 5800, total_tokens: 19300 }, duration_ms: 52000, retry_count: 1, created_at: '2026-07-13T09:02:00Z' },
]

// ============ 模拟日志 ============
export const mockAgentLogs: Record<number, string[]> = {
  6: [
    '[14:02:00] 🚀 开始代码生成任务...',
    '[14:02:01] 📖 读取方案文档: 订单导出功能技术方案',
    '[14:02:03] 📖 分析仓库代码结构: order-service',
    '[14:02:05] 🔍 识别到 Spring Boot 项目, Maven 构建',
    '[14:02:08] 📋 生成代码计划:',
    '  - 新增 ExportTask 实体类',
    '  - 新增 ExportTaskRepository',
    '  - 新增 ExportService',
    '  - 新增 ExportController',
    '  - 新增 ExportTaskQueue (Celery Worker)',
    '[14:02:15] ✍️ 生成文件: src/main/java/com/mall/entity/ExportTask.java',
    '[14:02:20] ✍️ 生成文件: src/main/java/com/mall/repository/ExportTaskRepository.java',
    '[14:02:28] ✍️ 生成文件: src/main/java/com/mall/service/ExportService.java',
    '[14:02:35] ✍️ 生成文件: src/main/java/com/mall/controller/ExportController.java',
    '[14:02:40] ✍️ 生成文件: src/main/java/com/mall/worker/ExportWorker.java',
    '[14:02:45] 🔄 正在生成单元测试...',
  ],
  34: [
    '[14:30:00] 🚀 开始代码审核任务...',
    '[14:30:02] 📖 读取代码变更列表...',
    '[14:30:05] 📋 发现 6 个变更文件:',
    '  - [新增] src/main/java/com/mall/entity/RbacRole.java',
    '  - [新增] src/main/java/com/mall/entity/RbacPermission.java',
    '  - [修改] src/main/java/com/mall/service/AuthService.java',
    '  - [新增] src/main/java/com/mall/service/RbacService.java',
    '  - [新增] src/main/java/com/mall/controller/RbacController.java',
    '  - [修改] src/main/resources/application.yml',
    '[14:30:10] 🔍 分析代码质量...',
    '[14:30:15] ✅ 代码规范检查: 通过',
    '[14:30:18] ✅ 安全漏洞扫描: 未发现高危漏洞',
    '[14:30:20] ⚠️ 建议: RbacService.java 第 42 行缺少空指针检查',
    '[14:30:22] 📊 审核报告已生成，等待人工审核',
  ],
}

// ============ 8 个流水线阶段 ============
export const pipelineStages = [
  'requirement_description', // 需求描述
  'clarification',          // 需求澄清
  'development_document_generation', // 开发文档生成
  'development_document_review', // 开发文档审批
  'development',            // 开发与最小检查
  'development_report_review', // 开发报告审批
  'final_acceptance',       // 人工测试与最终验收
  'completed',              // 已完成
]

// ============ 阶段中文名映射 ============
export const stageNameMap: Record<string, string> = {
  requirement_description: '需求描述',
  clarification: '需求澄清',
  development_document_generation: '开发文档生成',
  development_document_review: '开发文档审批',
  development: '开发与最小检查',
  development_report_review: '开发报告审批',
  final_acceptance: '人工测试与最终验收',
  completed: '已完成',
}

// ============ 状态标签配置 ============
export const statusConfig: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  draft: { label: '草稿', type: 'info' },
  analyzing: { label: '分析中', type: 'warning' },
  clarifying: { label: '澄清中', type: 'warning' },
  clarified: { label: '已澄清', type: '' },
  proposing: { label: '方案生成中', type: 'warning' },
  reviewing: { label: '方案审批中', type: 'warning' },
  ready: { label: '就绪', type: 'success' },
  coding: { label: '编码中', type: '' },
  testing: { label: '测试中', type: 'warning' },
  delivering: { label: '提测中', type: 'warning' },
  delivered: { label: '已交付', type: 'success' },
}

export const pipelineStatusConfig: Record<string, { label: string; type: 'success' | 'warning' | 'info' | 'danger' | '' }> = {
  running: { label: '运行中', type: '' },
  paused_for_review: { label: '等待审核', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
}

export const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0 紧急', color: '#F56C6C' },
  P1: { label: 'P1 高', color: '#E6A23C' },
  P2: { label: 'P2 中', color: '#409EFF' },
  P3: { label: 'P3 低', color: '#909399' },
}

// ============ 测试结果 ============
export const mockTestResults: Record<number, any> = {
  17: {
    report_id: 'TEST-20260724-001',
    executed_at: '2026-07-24T09:00:00Z',
    duration_seconds: 120,
    summary: { total: 45, passed: 42, failed: 2, skipped: 1, pass_rate: '93.3%', coverage: '78.5%' },
    failed_cases: [
      { name: 'test_search_special_chars', error: 'AssertionError: expected 200 but got 500', ai_fix_attempted: true, ai_fix_success: false },
      { name: 'test_search_concurrent', error: 'TimeoutError: task exceeded 30s limit', ai_fix_attempted: true, ai_fix_success: true },
    ],
  },
  26: {
    report_id: 'TEST-20260714-001',
    executed_at: '2026-07-14T10:00:00Z',
    duration_seconds: 85,
    summary: { total: 38, passed: 38, failed: 0, skipped: 0, pass_rate: '100%', coverage: '82.1%' },
    failed_cases: [],
  },
}

// ============ 需求对应的流水线阶段映射 ============
// 将需求状态映射到当前流水线阶段索引（0-based）
export const statusToStageIndex: Record<string, number> = {
  draft: -1,
  analyzing: 0,
  clarifying: 1,
  clarified: 2,
  proposing: 2,
  reviewing: 3,
  ready: 4,
  coding: 5,
  testing: 7,
  delivering: 8,
  delivered: 8,
}
