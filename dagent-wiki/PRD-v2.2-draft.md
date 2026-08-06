# Dagent AI 驱动研发自动化平台 PRD v2.2（草案）

> 文档状态：评审草案  
> 编写日期：2026-08-02
> 基线文档：`PRD.md` v2.1  
> 适用范围：`dagent-web`、`dagent-backend`、`dagent-agent`、`dagent-wiki`  
> 说明：本文档为独立新版本，不替换、不覆盖原 `PRD.md`。

---

## 0. 文档说明

### 0.1 编写目标

本文档在原 PRD v2.1 的基础上，结合当前前端演示页面和最新需求评审结果，形成一份可供产品、前端、后端、Agent、测试共同实施的完整产品需求文档。

本文档重点解决以下问题：

1. 明确项目空间、需求、两个主 Agent、长期 Session、AgentTask 和代码工作区之间的关系。
2. 将研发流程调整为“需求澄清、开发文档审批、开发与最小检查、开发报告审批、测试方案审批、人工测试与最终验收”。
3. 明确需求澄清、开发两个默认主 Agent 及其 Skills、MCP 和权限边界。
4. 明确后端通过 OpenCode Server HTTP API 调用两个独立的长期 OpenCode 服务，不为每个需求动态创建 K8S Pod。
5. 明确多需求并行开发、同文件冲突处理和合并队列机制。
6. 补充 API 网关的模型优先级、Token 配额、故障切换和审计要求。
7. 给出与当前前端页面对应的后端接口、数据模型和验收标准。
8. 固化中信证券品牌视觉、结构化产物展示、审批意见回传 Agent 和当前 K8S 部署约束。

### 0.2 需求来源

- 原完整 PRD：`PRD.md` v2.1。
- 当前 `dagent-web` 路由、页面、表单、状态和 Mock 数据。
- 2026-07-30 至 2026-07-31 的需求评审记录和流程图讨论。
- OpenCode 官方 Agent、Skills、MCP 和 Server 能力说明。

### 0.3 v2.2 相对 v2.1 的主要变化

| 主题 | v2.1/当前演示 | v2.2 目标 |
| --- | --- | --- |
| 主流程 | 9 步：需求分析至提测交付 | 9 个系统阶段；前端将最终验收与完成终态合并展示 |
| Agent | 泛化 Agent 任务 | 两个默认主 Agent：需求描述与澄清、开发 |
| Agent 结构 | 多个开发角色和子 Agent | 只保留需求澄清、开发两个主 Agent，不存在子 Agent |
| 容器 | 容易理解为每 Agent/需求一个容器 | 两个职责各有独立长期 OpenCode Deployment，不动态创建需求 Pod |
| OpenCode | 泛化 AI 能力 | 后端通过 OpenCode Server API/SDK 直接调用 |
| 模型调用 | 未定义优先级与额度切换 | API 网关支持优先级、配额、回退和审计 |
| 多需求并行 | 分支和任务概念已有 | 每需求两个长期 Session、独立分支、工作区、产物和日志 |
| 测试 | Agent 仅输出文字结论 | 开发 Agent 运行最小单元/冒烟检查并生成测试用例，QA 按用例人工验证 |
| 回退 | 审批回退路径不统一 | 每个人工门禁均有明确回退目标和意见记录 |
| 管理页面 | 无 Agent/API 网关管理页面 | 增加 Agent 管理、API 网关和审计日志页面 |
| 前端展示 | 原始 JSON 与通用主题 | 中信证券品牌配色，业务产物结构化展示并保留原始数据入口 |

---

## 1. 产品概述

### 1.1 产品定位

Dagent 是面向企业研发团队的 AI 驱动研发自动化平台。平台以“项目空间”和“需求”为业务载体，以 Agent 为执行能力，通过人工审批门禁控制关键决策，完成从需求描述、需求澄清、开发文档、代码开发、测试到最终验收的闭环。

### 1.2 产品目标

1. 将非结构化需求整理为可确认、可开发、可测试的结构化内容。
2. 自动完成代码理解、开发计划、代码修改、审查建议和测试执行等重复工作。
3. 在开发文档、开发报告和最终验收处保留人工决定权。
4. 让多个需求可以并行执行，同时保证代码隔离、审计完整和合并可控。
5. 统一管理模型 API 的可用性、调用顺序、Token 预算和使用记录。
6. 对接 Git 仓库，减少分支、提交和合并过程中的重复操作。

### 1.3 成功指标

首期上线后统计以下指标，基线值在试运行期间建立：

| 指标 | 定义 | 首期目标 |
| --- | --- | --- |
| 需求澄清完成率 | 提交澄清后进入开发文档阶段的需求占比 | >= 90% |
| Agent 任务成功率 | 无需人工修复基础设施即可完成的任务占比 | >= 95% |
| 人工门禁可追溯率 | 审批人、时间、意见、版本均完整的记录占比 | 100% |
| 测试结果可追溯率 | 测试用例与执行结果可关联的需求占比 | 100% |
| 最终验收误完成数 | 未经用户确认即进入完成态的需求数 | 0 |
| 模型调用可审计率 | 可关联路由、模型、用量、结果的调用占比 | 100% |

### 1.4 首期范围

首期包含：

- 用户登录、角色权限和租户隔离。
- 项目空间、代码仓库绑定和需求管理。
- 需求描述与需求澄清 Agent。
- 开发 Agent；负责开发文档、实现和业务功能失败修复。
- 开发 Agent 在实现阶段执行与改动直接相关的最小单元测试和冒烟检查，在开发报告审批后单独生成测试方案和人工测试用例。
- 开发文档、开发报告、测试方案、人工测试用例和验收记录。
- Git 分支、需求工作区、冲突检测和合并队列。
- OpenCode 接入和 API 网关优先级切换。
- 全流程日志、通知和审计。
- 中信证券品牌主题、Logo、结构化产物和审批意见展示。

### 1.5 暂不包含

- 通用项目管理、迭代排期、工时和绩效管理。
- 为每个需求或每个 Agent 动态创建 K8S Pod。
- 自动绕过代码保护分支、审批规则或安全扫描。
- 测试通过后自动把需求标记为最终完成。
- 首期内无限扩展任意类型的产品级主 Agent。
- OpenCode 子 Agent、`task` 子任务工具和任何子会话同步。
- 替代 Git 平台原有的 Pull Request/Merge Request 能力。

---

## 2. 用户、角色与权限

### 2.1 用户角色

| 角色 | 主要职责 | 核心权限 |
| --- | --- | --- |
| 管理员 Admin | 租户、用户、Agent、平台模型供应商配置 | 管理平台 Base URL/API Key 和用户总配额；不能覆盖用户个人 Agent 绑定 |
| 产品经理 PM | 创建需求、澄清需求、审批开发文档、最终验收 | 项目和需求业务权限；无密钥查看权限 |
| 开发人员 Developer | 参与开发、处理冲突、审批开发报告 | 查看代码产物、触发/重试开发任务、处理合并 |
| 测试人员 QA | 根据测试用例人工验证并反馈验收结论 | 查看需求、代码摘要、开发检查结果和测试用例 |

一个用户可以拥有多个角色。权限采用 RBAC，并额外受租户、项目成员和资源归属限制。

### 2.2 权限原则

1. 默认最小权限。
2. API 密钥只允许管理员创建、更新和停用；前端不返回完整密钥。
3. Agent 只能使用其配置中明确允许的 Skills、MCP 和工具。
4. 需求 Agent 默认只读代码仓库；开发 Agent 才可以修改需求工作区。
5. 人工审批动作必须由登录用户发起，Agent 不得代替用户点击确认。
6. 跨租户资源访问必须在后端拒绝，不能只依赖前端隐藏。

### 2.3 登录与会话

- 登录字段：用户名、密码。
- 登录成功返回访问令牌和用户信息。
- 支持查询当前用户和退出登录。
- 演示环境可保留角色快捷登录，生产环境必须关闭。
- 访问令牌过期、失效或权限不足时，前端统一跳转登录页或展示无权限提示。

---

## 3. 核心业务概念

### 3.1 项目空间

项目空间是一个逻辑业务空间，用来绑定：

- 一个或多个 Git 代码仓库。
- 多个业务需求。
- 项目成员与权限。
- 默认 Agent 配置和 API 网关策略。
- 与该项目相关的产物、日志和审计记录。

项目空间不是迭代管理系统，不负责 Sprint、工时和人员排期。

### 3.2 需求

需求是平台内最小的端到端交付单元。每个需求拥有独立的：

- 业务流程状态。
- 需求澄清主 Session、开发主 Session 和多条 AgentTask 记录。
- Git 分支及代码工作区。
- 过程产物与版本。
- 审批、日志和通知。

### 3.3 两个主 Agent

首期提供两个默认主 Agent：

1. **需求描述与需求澄清 Agent（`requirement_clarification`）**：分析需求和关联仓库、识别缺失信息、提出问题、整理用户回答并生成或更新需求文档。该 Agent 可读取代码，但不能修改代码或执行危险命令。
2. **开发 Agent（`development`）**：生成开发文档、编写代码、形成开发报告、执行最小单元/冒烟检查；开发报告审批通过后继续使用同一 Session 生成测试方案和人工测试用例，并根据审批或验收意见修改代码和文档。

系统不配置、不调用、不展示任何子 Agent。原 `development_planning`、`development_review`、`development_testing`、`development_problem_fix`、`development_readonly` 和 `testing` 等角色全部停用；自动化研发职责统一由 `development` 主 Agent 完成。

一个需求的目标关系为：一个需求澄清主 Session、一个开发主 Session，以及多条分别归属上述 Session 的 AgentTask。审批驳回、最终验收驳回和失败重试继续复用对应主 Session。

### 3.4 Agent 配置风格

“需求澄清”和“开发”是职责类型，不是只有一个固定提示词。每类主 Agent 可以有多个配置风格，例如：

- 需求澄清：默认、严格验收标准、快速澄清。
- 开发：默认、稳健改动、测试优先。

用户可在允许范围内选择配置；未选择时使用项目默认配置。需求澄清 Agent 不用于编写代码，开发 Agent 不代替需求方作业务确认。

### 3.5 产物

需求流程至少形成以下产物：

1. 需求文档。
2. 澄清记录。
3. 开发文档。
4. 代码变更与 Pull Request/Merge Request。
5. 开发报告及实现检查清单。
6. 测试方案及人工测试用例，包含范围、环境、前置条件、风险、进入/退出条件以及用例步骤和预期结果。
7. 最终验收记录。

所有产物必须有版本号、生成来源、创建时间和关联需求。被审批的内容必须固定到具体版本。

---

## 4. 信息架构与页面需求

### 4.1 导航结构

目标一级导航：

| 菜单 | 可见角色 | 说明 |
| --- | --- | --- |
| 工作台 | 全部登录用户 | 统计、待办、最近需求和运行状态 |
| 项目空间 | 全部登录用户 | 项目及其仓库、成员、需求 |
| 需求 | 全部登录用户 | 需求列表、创建、筛选和详情 |
| Agent 管理 | 管理员；普通用户只读可选配置 | 主 Agent、配置风格、Skills、MCP、版本 |
| API 网关 | 全部登录用户 | 个人模型池、个人额度、Agent 模型顺序、连接状态和个人调用日志 |
| 审计日志 | 管理员 | 关键配置和业务动作审计 |

当前前端已经实现工作台、项目空间、需求和登录页面的演示；Agent 管理、API 网关和审计日志为 v2.2 新增页面。

### 4.2 登录页

当前页面已有用户名、密码、表单校验、登录按钮和演示角色快捷入口。

目标要求：

- 生产环境不显示演示账号。
- 登录失败显示后端返回的可读错误，不泄露账户是否存在。
- 连续失败达到阈值后执行限流或临时锁定。
- 登录成功后回到用户原本访问的页面；没有来源页时进入工作台。

### 4.3 工作台

当前页面已有：需求总数、项目数、进行中需求、待审批数量、最近需求和活跃需求表格。

目标补充：

- “待我处理”按开发文档审批、开发报告审批、测试异常处理、最终验收分组。
- 展示运行中、失败、等待人工、等待合并的需求数量。
- 表格字段包含需求、项目、优先级、当前阶段、负责人、更新时间。
- 点击统计数字进入带相应筛选条件的需求列表。
- 普通用户只看到有权限的项目数据。

### 4.4 项目空间列表

当前页面已有项目卡片和新增项目弹窗。

目标要求：

- 支持按项目名称搜索、分页和状态筛选。
- 新建项目字段：项目名称、描述、负责人；名称必填且租户内不可重复。
- 卡片展示仓库数量、需求数量、进行中数量和最近更新时间。
- 只有项目负责人或管理员可以编辑、归档项目。

### 4.5 项目空间详情

当前页面已有基本信息、仓库绑定/解绑和关联需求列表。

目标要求：

- 基本信息：名称、描述、负责人、成员、默认 Agent 配置、默认 API 路由。
- 首期仓库绑定只支持 HTTPS 仓库主地址；默认分支必须在独立的“默认分支”字段填写，不接受包含 `/tree/`、`/-/tree/`、`/blob/` 或 `/src/<branch>` 的分支或文件页面地址。用户在绑定或编辑窗口填写 Git 用户名和 Personal Access Token，可不填凭据绑定公开仓库。
- 页面显示“已配置凭据/未配置”，但永不回显用户名、Token、密文或服务端凭据引用；已绑定仓库提供编辑、更新 Token、删除 Token 和验证操作。
- “保存仓库/保存 Token”和“验证连接”是两个独立操作：保存成功立即反馈且不等待网络验证；用户单独点击“验证连接”后验证默认分支读取权限，配置 Token 时额外以 `git push --dry-run` 验证写权限，不向远端写入内容。验证请求的前端与后端超时均不得低于 150 秒。
- 验证结果必须明确区分：读取成功但未配置推送凭据、读写验证成功、Token 无效、无仓库写权限、仓库或默认分支读取失败。
- 项目代码仓库提供删除操作；删除仅移除 Dagent 中的项目关联，不删除远端 Git 仓库。已被任何需求或工作区引用时禁止删除；被其他项目共享时只移除当前项目关联；完全无引用时同步删除本地仓库记录和加密凭据。
- 关联需求支持状态、优先级、当前阶段筛选。
- 展示个人 Agent 模型入口；模型选择来自当前用户的两类 Agent 绑定，不再由项目级管理员配置覆盖。

### 4.6 需求列表

当前页面已有项目、状态、优先级筛选，重置、分页和创建入口。

目标要求：

- 字段：需求 ID、标题、所属项目、优先级、状态、当前阶段、创建人、处理人、更新时间。
- 筛选：关键词、项目、状态、当前阶段、优先级、创建人、待我处理。
- 支持草稿、提交、暂停、恢复和取消；删除只允许未提交草稿。
- 创建需求至少填写项目、标题、需求描述、优先级、关联仓库范围。
- 可选选择需求 Agent 配置；未选择时使用项目默认值。

### 4.7 需求详情

需求详情是核心工作页面，采用以下结构：

1. 顶部：需求编号、标题、项目、优先级、状态、当前阶段和可执行动作。
2. 流程条：展示 v2.2 业务阶段；被回退的阶段保留历史，不覆盖旧记录。
3. 左侧或主区域：当前阶段产物、表单和审批操作。
4. 右侧或辅助区域：需求基本信息、Agent 运行状态、Git 分支、关联仓库、操作日志。
5. 历史区域：产物版本、审批记录、Agent 任务、测试记录和状态变更时间线。

当前页面中的“方案生成/方案审批”迁移为“开发文档生成/开发文档审批”；“代码审核”作为开发阶段内部检查，不再单独占据一级业务阶段；开发报告审批通过后直接进入人工测试与最终验收。

### 4.8 Agent 管理

#### 4.8.1 列表

字段：名称、职责类型、模式、版本、默认配置、启用状态、更新时间。

首期职责类型固定为：

- `requirement_clarification`
- `development`

#### 4.8.2 配置详情

- 基本信息：名称、描述、职责类型、是否默认、启用状态。
- OpenCode 配置：Agent 名称、模式、模型路由引用、提示词版本。
- Skills：允许列表、来源、版本、是否启用。
- MCP：服务列表、允许工具、只读/写入权限、超时。
- 工具权限：read、edit、bash、task 等精细权限。
- 任务模式权限：开发 Agent 使用 `development_document`、`implementation`、`failure_fix`。
- 子 Agent 能力必须关闭；OpenCode 的 `task` 工具必须拒绝，不能由提示词临时开启。
- 发布：草稿、已发布、停用；已运行任务固定使用启动时版本。

#### 4.8.3 操作约束

- 每个职责类型必须且只能有一个租户默认配置。
- 停用配置不影响已运行任务，但不能被新需求选择。
- 修改已发布配置必须生成新版本，不能原地改变历史执行环境。

### 4.9 API 网关管理

#### 4.9.1 平台模型与额度

- 每个用户独立保存 Token 总预算、是否启用硬限制、已用、预占、剩余和重置时间；总预算可配置，也可以关闭硬限制。任何用户的使用量不得占用其他用户额度。
- 平台模型路由是唯一可调用模型节点，直接保存名称、供应商、模型、平台优先级、节点额度、健康状态和启停状态；不再创建或维护“我的模型”副本，也不提供普通用户添加模型入口。
- 平台模型节点额度是跨用户共享的资源额度，所有调用都原子更新平台节点的预占量和已用量；用户总预算只负责该用户的独立统计或可选硬限制。
- 页面只返回 `credential_configured`，不返回 Base URL、API Key、密钥引用或密文。
- 管理员可在“平台模型配置”页面新增或编辑模型，填写节点名称、供应商标识、模型名称、API 根地址、API Token、API 协议、平台优先级和节点额度；API Token 只写入请求，后端使用现有 Fernet 密钥加密保存，任何响应、日志和普通用户页面都不返回原文。API 根地址只填写到 `/v1` 等公共前缀，不填写 `/responses` 或 `/chat/completions`。
- 平台模型新增或修改连接信息后默认停用，管理员必须先执行连接验证，验证成功后才能启用；系统不再使用固定域名白名单限制 Base URL。
- API 协议支持 `auto`、`chat_completions` 和 `responses`。选择 `auto` 时，真实验证先请求 Chat Completions，未得到有效 JSON 文本后再请求 Responses；成功后保存检测到的协议。验证必须发送最小真实请求并收到非空文本才标记为 `healthy`，HTTP 200 但返回 HTML、空 `choices` 或空 `output` 都标记为 `unhealthy`。
- Agent 内部统一使用 Chat Completions 契约；当路由协议为 Responses 时，Dagent 网关把消息、工具和输出预算转换为 Responses 请求，再把文本、工具调用和 Token 用量转换回 Chat Completions，避免 OpenCode 适配不同上游协议。

#### 4.9.2 Agent 绑定与自动切换

- 用户分别为需求澄清、开发 Agent 保存有序平台模型 ID 列表，配置维度为“用户 + Agent 类型”；绑定直接指向 `model_route.id`。
- 列表位置就是该 Agent 的调用优先级，从 1 开始且连续；同一 Agent 内不得出现重复节点或重复优先级。两个 Agent 的列表互相独立，同一节点可以在不同 Agent 中处于不同位置。
- 模型节点声明了适用 Agent 类型时，后端必须拒绝把节点绑定到其他 Agent；选路时再次校验适用范围。
- 自动切换开关属于用户，不影响其他用户；关闭后只尝试绑定列表第一项。
- 网关按 Agent 绑定顺序计算“预计输入 + 最大输出预算”；节点额度不足时继续检查下一个节点，不受已关闭的用户总预算硬限制影响。
- 限流、超时、上游不可用、5xx 或 API Key 失效时释放当前预留并切换一次，普通业务 4xx 不切换。
- 普通用户可以分别调整两个 Agent 的主备顺序；平台模型额度、启停状态和连接验证由管理员维护，平台 Base URL/API Key 仍由管理员安全保存。

#### 4.9.3 使用与切换记录

- 按当前用户、平台模型节点、实际模型、Agent、项目、需求和时间查看调用量。
- 展示实际使用节点、预计输入、输出预算、预留 Token、实际 Token、释放 Token 和节点剩余额度。
- 展示 `fallback_from`、429、超时、上游 5xx、鉴权失败、节点配额耗尽及切换原因。
- 不在前端展示完整密钥。

### 4.10 品牌视觉、业务意见与结构化产物

- 产品不展示中信证券 Logo；保留红色 `#D20A10` 作为操作强调色，登录页使用白色背景、红色边框和红色主按钮，不使用大面积纯红背景。
- 开发文档、开发报告、需求文档、人工测试用例及历史测试报告等 JSON 产物必须由前端解析为标题、摘要、列表、表格和状态标签等可读视图，原始 JSON 仅作为可展开的技术数据入口。
- 产物页必须展示版本、生成来源和生成时间；澄清答案要同时保存原始值和选项可读名称。
- 历史 `test_cases` 产物继续只读兼容；新流程统一保存 `test_plan`，人工用例使用 `manual_test_cases` 字段。
- 每个审批门禁的“意见”必须展示在审批历史和流程时间线中；驳回意见及人工补充内容要作为下一次相关 AgentTask 的输入上下文，不能只记录在页面上。

---

## 5. 端到端业务流程

### 5.1 阶段定义

| 序号 | 阶段编码 | 页面名称 | 主要执行者 | 输出 |
| --- | --- | --- | --- | --- |
| 1 | `requirement_draft` | 需求描述 | 用户 | 需求文档初版 |
| 2 | `requirement_clarification` | 需求澄清 | 需求 Agent + 用户 | 澄清记录、需求文档新版本 |
| 3 | `development_document_generation` | 开发文档生成 | 开发 Agent | 开发文档 |
| 4 | `development_document_review` | 开发文档审批 | PM/指定审批人 | 审批记录 |
| 5 | `development` | 开发 | 开发 Agent + Developer | 代码、开发报告、最小单元/冒烟证据 |
| 6 | `development_report_review` | 开发报告审批 | Developer/指定审批人 | 检查清单、审批记录 |
| 7 | `test_plan_generation` | 测试方案生成 | 开发 Agent | 测试方案、人工测试用例 |
| 8 | `test_plan_review` | 测试方案审批 | QA、PM/需求方 | 审批意见、确认版本 |
| 9 | `final_acceptance` | 人工测试与最终验收 | QA、PM/需求方 | 人工测试结论、验收记录、推送结果 |
| 10 | `completed` | 已完成 | 系统 | 完成时间、最终产物清单 |

`branch_creation`、`code_generation`、`code_review` 是开发阶段内部步骤，可在详情页展开显示，但不作为一级业务阶段。

### 5.2 需求描述

- 用户创建需求草稿，选择项目、仓库范围、优先级和需求 Agent 配置。
- 提交前校验必填项、项目权限和仓库绑定关系。
- 提交后生成不可变的需求文档版本，并进入需求澄清。
- 草稿可以编辑和删除；提交后的修改必须形成新版本。

### 5.3 需求澄清

- 需求 Agent 分析需求、相关仓库和项目上下文，生成澄清问题。
- 问题支持单选、多选、文本和文件补充；可给出 AI 推荐答案，但不得自动替用户提交。
- 用户必须回答所有必答问题后才能提交。
- Agent 根据答案更新需求文档，保留原问题、回答和更新差异。
- 用户确认需求描述已清楚后进入开发文档生成。
- 用户认为仍不清楚时可以继续发起下一轮澄清。
- 开发文档被驳回并退回需求澄清后，即使上一轮已是 `confirmed`，页面也必须提供“根据驳回意见生成新一轮澄清问题”按钮；新一轮沿用原需求 Session，确认后生成新的需求文档版本，不覆盖旧版本。

### 5.4 开发文档生成与审批

开发文档至少包含：

- 需求目标与非目标。
- 现状分析和受影响模块。
- 前端改动、后端改动、Agent 改动和数据改动。
- 接口契约和异常处理。
- 权限、安全和审计要求。
- 兼容性、迁移和回滚方案。
- 开发步骤、测试策略和验收清单。

审批动作：

- 通过：进入开发。
- 驳回：必须填写意见，回到需求描述/澄清；形成新需求文档后重新生成开发文档。
- 转交：转交其他有权限的审批人，流程仍停留在当前阶段。
- 编辑后通过：保存人工修订版本并记录编辑人，再执行通过。

### 5.5 开发

进入开发阶段后，系统执行：

1. 为需求创建独立 Git 分支和独立工作区。
2. 固定本次运行使用的 Agent、Skills、MCP、API 路由和提示词版本。
3. 后端以 `implementation` 模式调用本需求的开发主 Session，并在工具层开放当前需求工作区的写权限。
4. 开发 Agent 生成代码改动，只执行与改动直接相关的最小单元测试和一个简单冒烟检查。
5. 开发 Agent 自检变更；发现问题时在同一开发 Session 中创建新的修复 AgentTask。
6. 提交功能分支，但在最终验收通过前不推送远端。
7. 生成开发报告和实现检查清单；此阶段不生成或校验人工测试用例。

开发阶段支持暂停、恢复、重试和人工接管。失败任务不得自动从头重复造成重复提交；重试应从可恢复检查点继续。当前阶段最新一次 AgentTask 失败后，用户再次点击该阶段的主操作按钮时必须调用重试接口，不能创建缺少失败信息的普通任务。创建重试 AgentTask 时，后端必须把上一任务 ID、状态和脱敏后的最终错误写入重试上下文，并明确提示同一 Development Session：已有代码改动应继续复用，不得重复实现；应直接修正错误，在正确仓库目录重新执行最小单元测试和冒烟测试。

### 5.6 开发报告审批

开发报告至少包含：

- 实际修改文件和模块。
- 实现内容与开发文档条目的对应关系。
- 构建、最小单元测试和冒烟测试的真实命令、退出码与结果。
- 未完成事项、已知风险和人工操作项。
- PR/MR 地址、提交记录和当前冲突状态。
- 实现检查清单。

开发报告中的 `checks` 必须各包含一条规范化的 `check_type=unit_test` 和
`check_type=smoke_test`，并包含 `command`、`status`、`summary`、`exit_code`。Agent 返回的
`unit`、`unit_tests`、`pytest`、`smoke`、`health_check` 等等价标签由后端统一为标准值。当前临时以报告
自报命令和退出码为准，不要求匹配 OpenCode bash 工具记录。

审批动作：

- 通过：仅进入 `test_plan_generation`；页面显示“生成测试方案”按钮，用户点击后才创建新的测试方案 AgentTask。
- 驳回：必须填写意见，回到开发阶段。
- 转交：转交其他开发审批人。

### 5.7 最小自动检查与人工测试

- 不创建 `testing` Agent、`testing_session` 或 `task_type=test` 任务。
- 开发 Agent 在 `implementation` 或 `failure_fix` 任务内运行最小单元测试和一个简单冒烟检查，真实命令与退出码进入开发任务日志和开发报告。
- `development` 和 `failure_fix` 只校验代码修改及开发报告中自报的最小单元测试和冒烟测试字段，不要求 OpenCode 工具证据，也不要求或校验 `test_cases`。
- 开发提示词必须给出两条 `checks` 的完整 JSON 示例。开发报告字段缺失或 JSON 不合格时，后端将具体错误回传同一个 Development Session，只允许补正一次；补正阶段禁用写文件和 bash 工具，不重复改代码或执行检查。
- 开发报告审批通过后，后端只进入 `test_plan_generation`，不自动创建任务；用户点击“生成测试方案”后，新建 AgentTask，并由 Development Agent 复用原 `development_session` 生成测试方案，不恢复 Testing Agent。
- 测试方案阶段只读取代码和已审批产物，不修改代码、不执行完整测试。`test_plan` 必须包含非空的 `test_scope`、`test_environment`、`preconditions`、`risk_points`、`entry_criteria`、`exit_criteria` 和 `manual_test_cases`。
- 每条人工测试用例必须包含编号 `id`、标题 `title`、前置条件 `preconditions`、操作步骤 `steps`、预期结果 `expected_result`、优先级 `priority`，并且 `automated=false`。
- 测试方案 JSON 不合法或字段缺失时，后端把具体校验错误发送给同一个 Development Agent，只允许补正一次；第二次仍不合格才将任务标记为失败。
- 所有主 Agent 的最终 JSON 中，可读文本必须严格使用英文，即使需求、用户输入、仓库内容或审批意见是中文；后端发现中文可读文本时将具体错误回传同一 Session 补正一次。代码路径、命令、URL 和提交标识按原值保留。
- 测试方案生成成功后进入 `test_plan_review`。QA/PM 审批通过后才进入 `final_acceptance`；审批不满意时必须填写意见并回到 `test_plan_generation`，Development Agent 复用原 `development_session` 生成新的 `test_plan` 版本，旧版本继续保留。
- 进入 `final_acceptance` 后，QA/需求方按已审批方案人工测试，再由有权限的用户确认或驳回最终验收。
- 人工发现问题或最终验收驳回时回到 `development`，创建新的 `failure_fix` AgentTask 并复用原 `development_session`。
- OpenCode 一次工具循环可能生成多条 Assistant 消息；后端发送任务前记录已有消息 ID，随后只轮询和聚合本次新增消息，直至最终消息 `finish=stop`。
- OpenCode 1.15.12 的消息请求不得携带 `format.type=json_schema`。Agent 仍由提示词要求返回 JSON，最终 JSON 解析、规范化和 Pydantic 校验由 Dagent 后端完成。
- 若旧 Session 明确返回 `OutputFormatJsonSchema` 400，后端必须记录脱敏响应、创建带 `previous_session_id` 的替代 Session，并且最多重试一次。

### 5.8 最终验收

- 页面展示完整产物清单、测试结论、PR/MR 和未关闭风险。
- 用户必须主动点击“验收通过并提交”并再次确认。
- 需求澄清确认、开发文档审批通过、开发报告审批通过、测试方案审批通过和最终验收通过都必须在提交前再次显示“不能撤销或回退”的明确确认按钮。
- 确认时记录验收人、时间、意见和所验收的产物版本。
- 验收通过后由后端推送需求关联的全部功能分支；全部推送成功后自动进入 `completed`，完成态不可由 Agent 或单独的人工“完成”按钮触发。
- 任一推送失败时保持 `final_acceptance`，运行状态标记为交付失败并允许重试，不写入完成时间。
- 验收不通过时必须填写原因，默认回到开发阶段。
- 前端进度条将 `final_acceptance` 与 `completed` 合并为最后一格“最终验收”，依次展示“待验收、提交中、交付失败等待重试、已完成”。

### 5.9 暂停、失败与取消

业务阶段与运行状态分开保存：

- 业务阶段表示需求走到哪里。
- 运行状态表示当前是空闲、运行中、等待人工、暂停、失败还是取消。

取消需求需要二次确认，不删除历史记录；已创建分支和工作区按保留策略处理。失败任务可重试或人工接管，重试记录必须保留。

### 5.10 状态回退规则

| 当前阶段 | 动作/结果 | 目标阶段 |
| --- | --- | --- |
| 开发文档审批 | 驳回 | 需求描述/澄清 |
| 开发报告审批 | 驳回 | 开发 |
| 开发报告审批 | 通过 | 测试方案生成 |
| 测试方案生成 | 方案校验通过 | 测试方案审批 |
| 测试方案审批 | 驳回并填写意见 | 测试方案生成 |
| 测试方案审批 | 通过 | 最终验收 |
| 最终验收 | 不通过 | 开发 |
| 任一人工门禁 | 转交 | 当前阶段 |
| 最终验收 | 确认通过且全部推送成功 | 已完成 |
| 最终验收 | 推送失败 | 最终验收（交付失败、等待重试） |

每次回退必须保存原因、操作者、源阶段、目标阶段和当时的产物版本。

---

## 6. Agent 与 OpenCode 方案

### 6.1 调用方式

- `dagent-agent` 或后端编排服务通过 OpenCode Server API/SDK 发起会话、发送任务、读取事件和中止任务。
- OpenCode 以长期服务方式部署并通过内部网络访问，不由前端直接调用。
- 服务必须启用认证，连接信息和密钥存储在后端密钥管理中。
- 后端通过 `agent_session` 保存需求、职责类型与 OpenCode session ID 的映射。
- 前端通过后端 API 和 SSE/WebSocket 查看状态与日志，不接触 OpenCode 凭证。

### 6.2 两个默认主 Agent

| 主 Agent | 默认能力 | 默认 Skills | MCP/工具边界 |
| --- | --- | --- | --- |
| 需求描述与澄清 | 需求分析、追问、结构化、验收条件 | 需求澄清、文档结构化、验收标准 | 仓库只读；禁止代码写入 |
| 开发 | 开发文档、编码、自检、最小测试、开发报告、测试方案、业务失败修复 | 代码分析、实现、Git 协作、测试设计 | 权限由当前任务模式决定；测试方案模式只读，禁止越权访问其他需求工作区 |

实际 Skill 名称以安装并通过安全评审的清单为准。不能因为 Skill 存在就默认授权使用。

### 6.3 开发 Agent 任务模式与强制权限

开发 Agent 是唯一开发执行者，不存在子 Agent。后端在每次任务调用时指定任务模式并在 OpenCode 请求工具层强制权限：

| 任务模式 | 典型任务类型 | 代码权限 |
| --- | --- | --- |
| `development_document` | 生成或修改开发文档 | 只读代码 |
| `implementation` | 开发实现、开发报告 | 允许修改当前需求工作区 |
| `failure_fix` | 修复代码失败、验收驳回修改 | 允许修改当前需求工作区 |

- OpenCode 全局和两个 Agent 的 `task` 工具均为拒绝；不得创建 child session 或调用隐藏角色。
- 只读模式必须禁用 `edit`、`write`、`apply_patch`、`bash` 等写入或命令工具，并在任务结束后再次比较 Git HEAD；HEAD 变化时任务失败，不比较语义不一致的已提交文件列表和当前未提交文件列表。
- 写模式只允许本需求关联仓库的工作区。后端仅按任务模式启用或禁用 Bash，不解析、不匹配也不校验 Agent 执行的命令文本；Development Agent 的 Bash 默认允许，不再使用测试命令白名单，仅由 OpenCode 配置拒绝 `git push/reset/merge` 和 `rm -rf` 等明确危险操作。
- 权限约束必须由后端和工具层执行，提示词只用于说明职责，不能作为唯一安全措施。

### 6.4 Session、AgentTask 与替代规则

- 一个需求最多保留两个当前主 Session：`requirement_session` 对应 `requirement_clarification`，`development_session` 对应 `development`。
- 第一次进入相应职责时创建 Session；后续继续澄清、生成开发文档、实现、修改报告、修复代码和验收驳回修改，均复用对应 Session。
- 每次用户操作、流程触发、失败修复或重试都必须新建 AgentTask。AgentTask 保存本次任务类型、阶段、状态、输入/输出摘要、开始/结束时间、日志、错误和重试次数，并通过 `session_id` 指向长期 Session。
- 正常流程切换、审批回退和重新打开澄清不得新建 Session。需求澄清完成后重新开发时，将新需求文档版本发送到原开发 Session。
- 只有原 Session 不存在、损坏、上下文超过限制、Agent 配置版本变化，或需求发生重大变化使旧上下文不适用时才创建替代 Session。
- 替代 Session 必须记录 `previous_session_id` 和替代原因；原记录保留，不覆盖历史。
- 启动任务时固定 Agent 配置版本、模型路由版本、Skills/MCP 配置和代码基线。运行中修改管理配置不影响已启动任务。
- 会话摘要、关键输入输出和工具调用结果写入平台审计，敏感内容必须脱敏。

### 6.5 K8S 与容器边界

K8S 用于部署和保障长期运行的 `dagent-web`、`dagent-backend` 和 `dagent-agent/OpenCode` 等服务。数据库使用与集群网络连通的阿里云 RDS MySQL 5.7；本期不依赖 Redis。

首期明确不做：

- 每创建一个 Agent 就创建一个新容器。
- 每创建一个需求就创建一个新 Pod。
- 业务流程结束后批量销毁 Agent 容器。

当前部署统一位于 ACK/K8S 的 `dagent` namespace：`dagent-requirement-agent` 与 `dagent-development-agent` 是两个独立的长期 OpenCode Deployment/Service，分别持久化 OpenCode 状态并挂载需求工作区。前端、后端和两个 OpenCode 服务作为长期工作负载运行，RDS 不在 Pod 内启动；不新增 Testing Agent、Test Runner、测试 Job 或测试 Pod。外部访问通过 HTTPS 入口转发到前端，浏览器调用同域 `/api`，密钥通过 Kubernetes Secret 注入，不写入镜像、ConfigMap、PRD 或日志。

开发 OpenCode 容器镜像必须预装 Python/pytest、Node.js/npm、Java/JDK/Maven/Gradle、Go、Git；K8S 只负责容器持续运行和持久存储，不参与测试结论判断。

需求隔离由业务会话、权限、Git 分支、独立工作区和存储目录实现。后续只有在强隔离、非可信代码执行或资源控制确有要求时，才单独评审沙箱/任务容器方案。

---

## 7. 多需求并行与 Git 协作

### 7.1 隔离模型

每个需求生成：

- 唯一需求 ID。
- 独立分支，例如 `feature/REQ-123-short-title`。
- 独立工作区目录或 Git worktree。
- 一个需求澄清主 Session、一个开发主 Session、一个测试主 Session，以及相互隔离的任务记录目录。
- 独立产物、日志、测试记录和审批记录。

任何 Agent 工具都必须由后端注入并校验工作区根目录，不能访问其他需求的写目录。

### 7.2 同一文件被多个需求修改

不同需求在各自分支中修改同一文件时，运行期间互不覆盖。进入合并前执行：

1. 更新目标分支最新代码。
2. 对需求分支执行 rebase 或 merge 检查。
3. 无冲突时自动合并并重新执行必要测试。
4. 有冲突时停止自动合并，标记“等待冲突处理”。
5. 开发人员或受控开发 Agent 在当前需求分支解决冲突。
6. 重新执行构建、测试和必要审批后进入合并队列。

系统应在开发早期根据预计影响文件提示潜在冲突，但早期提示不能代替合并前的真实 Git 检查。

### 7.3 合并队列

- 同一目标分支的需求按进入队列顺序逐个校验和合并。
- 每次前序需求合并后，后续需求必须基于新的目标分支重新校验。
- 保护分支规则由 Git 平台执行，Dagent 不绕过审批和检查。
- 合并失败、权限不足或保护规则变化时，需求进入等待人工状态。

---

## 8. API 网关与模型路由

### 8.1 目标策略

每个用户首期至少配置两个逻辑优先级：

| 优先级 | 初始策略 | 用途 |
| --- | --- | --- |
| 第一优先级 | 用户级可配置节点预算 | 日常优先调用，并验证额度耗尽切换 |
| 第二优先级 | 同一用户的备用节点预算 | 第一优先级不可用时接管 |

用户总预算与模型节点额度是两个独立层级。用户总预算默认保留 50,000 Token 统计值但不启用硬限制；管理员可以配置预算、重置时间和是否启用硬限制。每个主、备节点分别维护自己的独立额度。

当前平台验证路由采用 OpenAI Compatible 协议，Base URL 为智谱 Coding PaaS v4，模型标识为 `glm-4.7-flash`。供应商密钥只保存于后端密钥存储；普通用户的主、备逻辑节点均可引用该平台路由。若主、备节点引用同一个 GLM API Key，切换只能绕过 Dagent 内部节点额度，不能绕过 GLM 上游账号的真实额度；正式容灾的备用节点必须使用独立上游凭据或独立服务额度。后续新增其他模型时通过平台模型目录提供，不将供应商写死在 Agent 业务逻辑中。

### 8.2 路由规则

1. 根据 AgentTask 的 `requested_by` 确定用户；历史任务缺失该字段时回退需求创建人。
2. 读取“用户 + Agent 类型”的有序绑定，只选择该用户拥有且启用的节点。
3. 根据请求内容计算预计输入 Token 和最大输出预算，两者之和作为原子预留量。
4. 按顺序对个人节点独立执行原子预留；当前节点不足时继续检查下一节点。只有用户总预算硬限制开启时，用户总预算不足才统一阻断调用。
5. 调用完成后按实际用量分别结算用户统计和节点额度，多余预留释放。
6. 当前上游发生 401/403、429、超时、连接失败或允许回退的 5xx 时，释放当前预留并切换备用节点；一次请求最多进行一次上游切换。
7. 参数错误、内容错误等普通业务 4xx 不自动切换，避免重复调用和重复扣费。
8. 所有节点内部额度都不足时返回“所有模型节点额度不足”，模型代理使用 OpenAI Compatible 客户端不会自动重试的 HTTP 400，并在响应体标记 `quota_exhausted` 和 `retryable: false`；不得使用会被 OpenCode 自动重试的 409。
9. 所有尝试和切换记录用户、Agent 类型、平台模型、个人节点、预计输入、输出预算、预留量、实际用量、`fallback_from`、切换原因和同一 trace ID。

### 8.3 并发与一致性

- 配额预留必须通过数据库事务或数据库原子更新完成。
- 同一请求重试使用幂等键，避免重复计费和重复执行业务动作。
- 网关记录 `estimated_input_tokens`、`output_token_budget`、`reserved_tokens`、`input_tokens`、`output_tokens`、`released_tokens`。
- 上游未返回准确用量时使用可配置估算规则，并标记为估算。

### 8.4 验证场景

1. 第一优先级额度充足，只调用第一优先级。
2. 第一优先级剩余额度不足，请求直接进入第二优先级。
3. 第一优先级调用返回 429，按规则切换第二优先级。
4. 并发请求不能让第一优先级实际分配超过预算。
5. 第一优先级失败、第二优先级成功时，业务任务只产生一份有效结果。
6. 所有切换在管理页和审计日志可见。
7. 用户总预算硬限制关闭且总预算剩余不足时，只要备用节点额度充足仍可完成预留。
8. 第二个上游节点仍失败时停止切换并释放预留，不产生第三次上游调用。

---

## 9. 后端能力与接口契约

本节为 v2.2 目标接口，不表示当前仓库已经全部实现。实际路径可以在接口设计阶段调整，但资源、动作和幂等语义必须保持一致。

### 9.1 通用约定

响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

分页结构：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

通用要求：

- 时间使用 ISO 8601，并在传输中携带时区。
- 写接口支持 `Idempotency-Key`。
- 列表接口支持分页、排序和权限过滤。
- 错误码区分参数、鉴权、权限、状态冲突、外部依赖和内部错误。
- 流程动作提交当前资源版本号，避免并发覆盖。

### 9.2 认证与工作台

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/logout` | 退出 |
| GET | `/api/v1/auth/me` | 当前用户与权限 |
| GET | `/api/v1/dashboard/summary` | 工作台统计 |
| GET | `/api/v1/dashboard/todos` | 当前用户待办 |
| GET | `/api/v1/dashboard/recent-requirements` | 最近需求 |

### 9.3 项目与仓库

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET/POST | `/api/v1/projects` | 项目列表/新建项目 |
| GET/PATCH | `/api/v1/projects/{project_id}` | 项目详情/更新 |
| POST | `/api/v1/projects/{project_id}/archive` | 归档项目 |
| GET | `/api/v1/projects/{project_id}/repositories` | 已绑定仓库 |
| POST | `/api/v1/projects/{project_id}/repositories` | 绑定并校验仓库 |
| DELETE | `/api/v1/projects/{project_id}/repositories/{repository_id}` | 从项目删除仓库；无其他引用时同时删除本地仓库记录和凭据，远端 Git 仓库不受影响 |
| PUT | `/api/v1/repositories/{repository_id}/credential` | 加密设置或更新 HTTPS Token |
| DELETE | `/api/v1/repositories/{repository_id}/credential` | 删除数据库凭据和兼容凭据引用 |
| POST | `/api/v1/repositories/{repository_id}/verify` | 分别验证读取和推送权限 |

凭据设置请求包含 `username` 和 `token`。仓库查询及设置/删除响应只返回 `credential_configured`，不得返回用户名、Token、密文或 `credential_ref`。验证响应包含 `result`、`read_verified`、`write_verified`、`credential_configured` 和更新后的脱敏仓库信息。

### 9.4 需求与流程

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET/POST | `/api/v1/requirements` | 需求列表/创建草稿 |
| GET/PATCH | `/api/v1/requirements/{requirement_id}` | 需求详情/更新草稿 |
| POST | `/api/v1/requirements/{requirement_id}/submit` | 提交需求 |
| POST | `/api/v1/requirements/{requirement_id}/pause` | 暂停运行任务 |
| POST | `/api/v1/requirements/{requirement_id}/resume` | 恢复流程 |
| POST | `/api/v1/requirements/{requirement_id}/cancel` | 取消需求 |
| GET | `/api/v1/requirements/{requirement_id}/pipeline` | 当前阶段和历史 |
| GET | `/api/v1/requirements/{requirement_id}/actions` | 当前用户可执行动作 |
| GET | `/api/v1/requirements/{requirement_id}/events` | SSE 事件流 |

### 9.5 澄清、产物与审批

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/requirements/{id}/clarification/generate` | 生成澄清问题 |
| GET | `/api/v1/requirements/{id}/clarification/rounds` | 澄清轮次和问题 |
| POST | `/api/v1/requirements/{id}/clarification/answers` | 提交本轮答案 |
| POST | `/api/v1/requirements/{id}/clarification/confirm` | 确认澄清完成 |
| GET | `/api/v1/requirements/{id}/artifacts` | 产物清单 |
| GET | `/api/v1/requirements/{id}/artifacts/{type}/versions` | 指定产物版本 |
| POST | `/api/v1/requirements/{id}/artifacts/{type}/revise` | 人工修订产物 |
| POST | `/api/v1/requirements/{id}/reviews/{gate}` | 通过、驳回或转交 |
| GET | `/api/v1/requirements/{id}/reviews` | 审批历史 |

`gate` 取值：`development_document`、`development_report`、`final_acceptance`。历史 `test_cases` 审批记录只读保留，新流程不再创建。

审批请求至少包含：`action`、`comment`、`artifact_version`、`assignee_id`（转交时）、`resource_version`。驳回必须有意见；最终验收通过必须带二次确认标识。

### 9.6 Agent 任务与 Git

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/requirements/{id}/tasks` | 启动允许的阶段任务 |
| GET | `/api/v1/requirements/{id}/tasks` | 本需求 AgentTask 列表 |
| GET | `/api/v1/requirements/{id}/agent-sessions` | 需求澄清/开发/测试主 Session 及替代链 |
| GET | `/api/v1/agent-tasks/{task_id}` | 任务详情 |
| POST | `/api/v1/agent-tasks/{task_id}/retry` | 从检查点重试 |
| POST | `/api/v1/agent-tasks/{task_id}/cancel` | 中止任务 |
| GET | `/api/v1/agent-tasks/{task_id}/logs` | 分页日志或日志引用 |
| GET | `/api/v1/requirements/{id}/workspace` | 分支、工作区、基线和 PR/MR |
| POST | `/api/v1/requirements/{id}/merge-check` | 冲突和保护规则检查 |
| POST | `/api/v1/requirements/{id}/merge-queue` | 进入合并队列 |

### 9.7 Agent 管理

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET/POST | `/api/v1/agent-definitions` | Agent 列表/新建 |
| GET/PATCH | `/api/v1/agent-definitions/{id}` | 详情/修改草稿 |
| POST | `/api/v1/agent-definitions/{id}/versions` | 创建新版本 |
| POST | `/api/v1/agent-definitions/{id}/publish` | 发布版本 |
| POST | `/api/v1/agent-definitions/{id}/disable` | 停用 |
| GET | `/api/v1/skills` | 已安装 Skills 清单 |
| GET | `/api/v1/mcp-servers` | 可用 MCP 和工具权限 |

### 9.8 API 网关管理

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/me/model-gateway` | 当前用户总预算设置、可用平台模型和两类 Agent 绑定 |
| PUT | `/api/v1/me/agent-model-bindings/{agent_type}` | 保存当前用户某类 Agent 的有序模型节点 |
| PUT | `/api/v1/me/model-gateway/settings` | 设置当前用户自动切换开关 |
| GET | `/api/v1/me/model-call-logs` | 当前用户调用、失败和切换记录 |
| PUT | `/api/v1/users/{user_id}/model-quota` | 管理员调整指定用户总预算、硬限制开关和重置时间 |
| GET/POST/PATCH | `/api/v1/model-routes...` | 管理员维护平台供应商路由和加密 API Token；普通用户不可访问 |

### 9.9 后端流程约束

- 前端不能直接指定任意目标阶段；只能提交后端返回的可执行动作。
- 后端在事务中校验当前阶段、资源版本、用户权限和产物版本。
- Agent 任务成功只更新产物和运行状态；需要人工门禁时必须停在等待人工状态。
- 后端构造新 AgentTask 输入时必须附带当前需求文档版本、相关审批意见、上一次输出摘要和失败日志；意见的展示与传递使用同一条不可变审批记录。
- 外部系统调用使用 Outbox/任务队列或等价机制，避免数据库已提交而外部状态丢失。
- Git、OpenCode 暂时不可用时保留内部状态并可重试，不允许伪造成功。

---

## 10. 数据模型

### 10.1 核心实体

| 实体 | 关键字段 | 说明 |
| --- | --- | --- |
| `tenant` | id, name, status | 租户隔离根实体 |
| `user` | id, tenant_id, username, status | 用户 |
| `role` / `user_role` | role_code, user_id | RBAC |
| `project` | id, tenant_id, name, owner_id, status | 项目空间 |
| `repository` | id, provider, url, default_branch, credential_username, credential_ciphertext, credential_ref | HTTPS Token 使用固定 K8S 密钥加密；`credential_ref` 仅兼容管理员历史配置 |
| `project_repository` | project_id, repository_id | 项目与仓库多对多 |
| `requirement` | id, project_id, title, priority, stage, run_status, version | 需求主记录 |
| `requirement_repository` | requirement_id, repository_id | 本需求涉及的仓库 |
| `clarification_round` | requirement_id, round_no, status | 澄清轮次 |
| `clarification_question` | round_id, type, required, options | 澄清问题 |
| `clarification_answer` | question_id, answer, user_id | 用户答案 |
| `artifact` | requirement_id, type, current_version | 产物索引 |
| `artifact_version` | artifact_id, version, content_ref, source, checksum | 不可变产物版本 |
| `review_record` | requirement_id, gate, action, artifact_version, reviewer_id, comment | 人工门禁 |
| `pipeline` | requirement_id, current_stage, run_status | 流程实例 |
| `stage_history` | pipeline_id, from_stage, to_stage, trigger, operator | 状态历史 |
| `agent_definition` | role_type, name, status, default_flag | 主 Agent 定义 |
| `agent_version` | agent_id, version, prompt_ref, skill_policy, mcp_policy | 已发布配置版本 |
| `agent_session` | id, requirement_id, role_type, opencode_session_id, agent_version_id, status, previous_session_id, created_at, updated_at | 需求的长期澄清/开发/测试 Session 及替代链 |
| `agent_task` | id, session_id, requested_by, task_type, stage, status, input_summary, output_summary, started_at, completed_at, checkpoint, retry_count | 每次操作的独立执行、模型计费归属与审计记录 |
| `git_workspace` | requirement_id, repository_id, branch, path_ref, base_commit | 需求代码隔离 |
| `merge_queue_item` | requirement_id, target_branch, status, order_no | 合并队列 |
| `model_route` | provider, model, base_url, api_protocol, detected_api_protocol, priority, credential_ref, credential_ciphertext, health_status | 管理员维护的平台供应商路由；API 协议和验证结果按节点保存，Token 使用密文保存，密钥不下发用户 |
| `user_model_quota` | tenant_id, user_id, quota_limit, hard_limit_enabled, quota_reserved, quota_used, reset_at, auto_fallback | 用户独立总预算、可选硬限制和自动切换设置 |
| `user_model_route` | user_id, model_route_id, name, level, priority, quota_limit, quota_used, status | 历史兼容表，仅用于迁移旧绑定，不参与新调用 |
| `user_agent_model_binding` | user_id, agent_type, route_ids, version | 用户为需求澄清、开发 Agent 保存的有序节点列表 |
| `model_quota_ledger` | user_id, route_id, reserved, actual, released, request_id | 用户统计与平台模型节点额度账本 |
| `model_call_log` | user_id, agent_type, route_id, task_id, estimated_input_tokens, output_token_budget, reserved_tokens, input_tokens, output_tokens, released_tokens, latency, result, fallback_from_route_id, fallback_reason | 用户维度的平台模型调用审计 |
| `external_sync_task` | target, business_id, action, status, retry_count | Git 平台等外部操作的同步任务 |
| `audit_log` | actor, action, resource, before_ref, after_ref, trace_id | 审计日志 |

### 10.2 一致性要求

- 所有业务表携带租户归属或可通过关联链确定租户。
- 需求的 `stage` 与流程实例保持一致，并由后端单一事务更新。
- 产物版本不可覆盖；新内容新增版本。
- 审批记录不可物理删除或修改，只能追加更正记录。
- 密钥表只保存密钥管理系统引用或加密密文。
- OpenCode session ID 和 Git 分支建立唯一或组合唯一约束。
- 同一需求同一职责最多只有一条 `active` AgentSession；一个 AgentSession 可关联多条 AgentTask。
- AgentTask 创建后不复用；重试通过 `retry_of_task_id` 或等价字段关联原任务，并继续使用原 Session。
- 历史数据库中的 `parent_task_id` 只作为兼容字段保留，新逻辑不得创建父子 AgentTask。
- `credential_ciphertext` 只能保存经过认证加密的 Token 密文；API 序列化模型不得包含该字段或 `credential_username`。

---

## 11. 外部系统集成

### 11.1 OpenCode

用途：两个主 Agent、Skills、MCP、代码任务和最小测试工具执行。

集成要求：

- 使用 OpenCode Server 的 HTTP/OpenAPI 接口或官方 SDK。
- 内网访问、服务认证、超时、中止、重试和健康检查。
- 会话、消息、工具调用和任务状态与 Dagent 业务 ID 关联。
- Agent 权限由 OpenCode 配置与 Dagent 后端双重限制。
- 禁止 OpenCode `task` 工具和子 Agent 调用；需求澄清与开发 Agent 分别路由到独立 OpenCode 服务。
- Development Pod 内的 `monitor-sidecar` 不参与业务调用，但当前 `/metrics` 正由集群监控采集，因此保留；OpenCode 的业务健康检查仍直接检查 `4096` 端口。
- `workspace-manager` 与 OpenCode 共享同一持久化 `/workspaces`，负责受控的仓库准备、状态检查、提交、推送和合并；它不是第二套工作区。
- 后端保存 OpenCode 返回的工具调用证据用于日志和后续审计；当前不将工具证据与 Agent 最终报告逐条匹配，也不作为任务成功门禁。
- 对多步工具任务，后端必须轮询同一 Session 的新增消息直到最终 Assistant 消息结束，并排除该长期 Session 的历史任务消息。

### 11.2 Git 平台

用途：仓库读取、分支、提交、PR/MR、检查和合并。

集成要求：

- 首期用户自助配置只支持 Git CLI + HTTPS Personal Access Token；SSH 私钥、OAuth、凭据中心和多仓库共享凭据暂不实现。
- Token 使用 K8S Secret 中固定的 Fernet 密钥加密后存入 MySQL；用户更新 Token 不修改 Secret、不重启 Pod。原 `env://GIT_TOKEN` 仅作为管理员历史配置兼容方式。
- 推送前后端临时解密 Token，只通过集群内认证请求传给 Workspace Manager；Workspace Manager 继续使用 `GIT_ASKPASS`，不把 Token 拼入仓库 URL。
- Token 不得进入 Agent、模型上下文、API 响应、审计详情、普通日志或代码工作区。
- 推送、建 PR/MR、合并操作幂等。
- 尊重目标仓库保护分支和必需检查。

---

## 12. 非功能需求

### 12.1 性能

- 普通查询接口 P95 <= 500 ms，不含外部系统耗时。
- 列表接口默认每页 20 条，最大 100 条。
- Agent 日志采用流式或增量读取，不一次返回全部内容。
- 单个 Agent 任务默认最长 1 小时，可按任务类型配置。
- 首期支持至少 50 个在线用户；Agent 并发数由环境配置并在工作台可见。

### 12.2 可用性与恢复

- 后端、Agent 服务和 OpenCode 提供健康检查。
- 长任务保存检查点，服务重启后可识别运行中、已完成和需要人工处理的任务。
- 重试使用幂等键，不能重复创建分支、PR/MR、评论或审批记录。
- 外部依赖故障时显示明确状态和下一步操作。
- 数据库按生产要求执行备份和恢复演练。

### 12.3 安全

- 全链路 HTTPS；集群内按部署要求启用服务认证。
- JWT/会话安全、RBAC、租户隔离、CORS 白名单。
- API 密钥、Git 凭证和 OpenCode 密码集中保管、定期轮换、日志脱敏。
- Git Token 在 MySQL 中必须加密保存；加密密钥固定存放在 Kubernetes Secret，不存入数据库、镜像、ConfigMap 或源代码。
- Agent 命令执行使用允许列表、工作目录限制、超时和输出限制。
- 禁止 Agent 读取与当前需求无关的密钥和租户数据。
- 关键依赖和代码变更进入安全扫描流程。

### 12.4 审计

必须审计：

- 登录、权限和成员变更。
- 项目、仓库、Agent、MCP、Skill、模型路由配置变更。
- 需求阶段变化和全部人工审批动作。
- Agent 任务启动、中止、重试、人工接管。
- Git 推送、PR/MR、冲突处理和合并。
- 仓库凭据设置、更新和删除；审计只记录动作与配置状态，不记录用户名、Token 和密文。
- 模型调用、Token 用量、失败和优先级切换。

审计日志至少包含操作者、时间、动作、资源、结果、来源 IP/客户端、trace ID 和变更引用。

### 12.5 可观测性

- 统一 trace ID 贯穿前端请求、后端、Agent、OpenCode、模型网关和外部系统。
- 指标：接口延迟/错误率、任务队列、Agent 成功率、阶段停留时间、模型用量、回退次数、外部同步失败数。
- 日志按租户和需求可检索，敏感字段脱敏。
- 告警：服务不可用、任务长时间无进展、配额即将耗尽、连续切换失败、合并队列阻塞。

### 12.6 数据保留

- 完成或取消需求后，OpenCode 进程不因该需求单独销毁。
- 需求工作区在完成后按可配置保留期清理；清理前确保代码已推送、产物已归档。
- 审批、审计、产物和测试记录按企业合规要求保留。
- 清理操作必须可审计，不能删除 Git 远端历史。

---

## 13. 当前前端与目标产品差距

### 13.1 可复用页面

| 当前页面 | 可复用内容 | 必须调整 |
| --- | --- | --- |
| 登录 | 表单、校验、布局 | 接真实认证；生产关闭快捷账号 |
| 工作台 | 统计卡、最近需求表 | 接后端；增加待办和运行状态 |
| 项目列表 | 卡片、新建弹窗 | 搜索分页、权限、真实创建 |
| 项目详情 | 基本信息、仓库绑定、需求列表 | 仓库验证、成员、个人 Agent 模型入口 |
| 需求列表 | 筛选、分页、表格 | 接真实数据；创建需求；新阶段筛选 |
| 需求详情 | 进度条、澄清、文档、日志、测试展示 | 替换流程；增加三个门禁、测试工具证据和产物版本 |

已完成的前端基线还包括：无证券品牌 Logo 的红色主题、白底登录页、真实后端接口、审批意见展示和结构化产物渲染。后续迭代必须保持这些能力，不回退为原始 JSON 主视图或 Mock 数据。

### 13.2 必须新增页面

- Agent 管理。
- API 网关管理。
- 审计日志。
- 需求创建/编辑完整页面或弹窗。
- 冲突处理与合并队列视图，可先放在需求详情中。

### 13.3 当前演示状态迁移

当前前端状态：

`draft`、`analyzing`、`clarifying`、`clarified`、`proposing`、`reviewing`、`ready`、`coding`、`testing`、`delivering`、`delivered`。

迁移原则：

- 新系统使用“业务阶段 + 运行状态”，不再用一个状态字段表达两种含义。
- 历史 `proposal` 产物映射为 `development_document`。
- 历史 `delivered` 只有存在明确人工验收记录时映射为 `completed`；否则映射为 `final_acceptance`。
- 历史记录保留原始状态码，迁移表记录新旧映射。

### 13.4 需要修正的现有交互

- 当前“方案审批驳回后回到需求分析”改为回到需求描述/澄清。
- 当前“代码审核”不再是一级阶段，纳入开发阶段内部检查。
- 当前“测试执行”之后不能直接“提测交付/已交付”，必须进入最终验收。
- 当前需求详情中的触发按钮由后端 `actions` 接口决定，不能只按前端 Mock 状态显示。
- 当前多数 Store 使用 Mock 数据，接后端时必须统一响应、错误、加载、空状态和权限处理。
- 任务历史只展示两个主 Agent 的 AgentTask；遗留 `subagent:*` 和 `testing` 记录可以保留在数据库审计中，但不能作为当前业务任务展示。

---

## 14. 验收标准

### 14.1 主流程验收

1. 新建需求后可以完成澄清、开发文档审批、开发与最小检查、开发报告审批、人工测试和最终验收。
2. 三个人工门禁未操作前，系统不能自动进入下一业务阶段。
3. 开发文档驳回后回到需求描述/澄清，并保留意见和旧版本。
4. 开发报告驳回和测试失败后回到开发。
5. 功能不通过时带真实命令证据回到开发；无法测试时停留测试阶段。
6. 测试通过后仍停留在最终验收，只有用户确认才进入完成态。

### 14.2 Agent 验收

1. 系统默认提供需求描述与澄清、开发两个主 Agent。
2. 用户可选择同职责下已发布的配置风格，未选择时使用默认配置。
3. 需求 Agent 无法写代码工作区。
4. OpenCode 配置和每次请求均禁止 `task` 子 Agent 工具，页面不存在子 Agent 或父子任务展示。
5. 任务运行时修改 Agent 配置不会改变该任务的固定版本。
6. 每个任务可查询状态、输入摘要、输出产物、日志、重试和中止记录。
7. 同一需求连续执行开发文档、实现和失败修复时创建不同 AgentTask 并复用开发 Session；审批或最终验收回炉不得丢失原 Session。
8. Session 被替代时，新 Session 记录 `previous_session_id`，旧任务与旧 Session 保持可查询。
9. 只读任务无法通过 OpenCode 工具修改代码；即使发生越权写入，后端基线校验也会将任务判为失败。

### 14.3 多需求与 Git 验收

1. 两个需求可同时修改同一仓库且互不覆盖工作目录。
2. 两个需求修改同一文件时，各自分支保留完整改动。
3. 合并前可以检测真实冲突；有冲突时不得自动合并。
4. 解决冲突后必须重新运行配置的检查和测试。
5. 合并队列在前序需求合并后重新校验后续需求。

### 14.4 仓库凭据验收

1. PM 或管理员可在仓库绑定/编辑窗口设置、更新和删除 HTTPS Token；普通开发人员不能修改凭据。
2. Token 落库值不是明文，查询仓库和凭据接口只返回 `credential_configured`，任何错误响应和日志均不包含 Token。
3. 公开仓库未配置 Token 时可显示“读取验证成功、推送凭据未配置”。
4. 私有仓库可区分 Token 无效与 Token 有读取权限但无写权限；验证写权限不得产生远端提交或分支变更。
5. 开发推送时临时解密数据库凭据并通过 `GIT_ASKPASS` 使用，Token 不进入 Agent 或模型上下文。
6. 现有管理员 `env://GIT_TOKEN` 仓库仍可运行；新绑定仓库不能通过业务接口指定任意环境变量。

### 14.5 API 网关验收

1. 普通用户可以进入模型网关，并查看自己的总预算是否启用硬限制、节点用量、重置时间和 API Key 配置状态。
2. 需求澄清、开发 Agent 可以分别保存平台模型节点顺序，绑定直接使用平台 `model_route.id`，任何用户只能调整自己的绑定顺序。
3. 用户 A 的调用只结算用户 A 的总用量，同时原子结算实际使用的平台模型节点额度；用户 B 的总预算统计保持独立。
4. 第一节点额度不足、401/403、429、超时、连接失败或 5xx 时，自动切换当前 Agent 绑定的下一个平台模型；普通业务 4xx 不切换。
5. 主节点额度不足时不结束请求，继续检查备用节点；所有绑定节点都不足时返回不可重试的“所有模型节点额度不足”。
6. 用户总预算硬限制关闭时，总预算剩余不足不得阻断节点切换；硬限制开启时不足则明确返回“用户总预算不足”。
7. 当前主备平台模型都可以使用 `glm-4.7-flash`，调用记录必须包含用户、Agent、平台路由、实际模型、预计输入、输出预算、预留量、实际用量、尝试序号、切换来源和原因。
8. 上游 401/403、429、超时、连接失败或 5xx 最多切换一次；失败节点和最终节点的预留都必须正确释放或结算。
9. 并发调用不会超卖启用的用户总预算硬限制或平台模型节点额度，前端和普通用户 API 都不能查看 Base URL、API Key 原文或密钥引用。
10. 主、备节点共用同一个 GLM API Key 时只视为内部额度切换验证；正式容灾必须使用独立上游凭据或独立服务额度。

### 14.6 最小检查与人工测试验收

1. 开发 Agent 在实现任务内执行与改动直接相关的最小单元测试和一个冒烟检查，命令、退出码与日志保存在任务证据中。
2. 开发任务成功时保存规范化的 `development_report`，不要求 `test_cases`；最小单元测试和冒烟测试命令、退出码与日志必须保存在任务证据中。
3. 后端接受常见单元/冒烟标签别名并落库为 `unit_test`、`smoke_test`；当前不要求 `tool_evidence`，也不校验报告命令与真实 bash 记录是否匹配。
4. 开发报告契约不合格时复用同一 Development Session 只补正 JSON 一次，补正不得修改代码或重新执行命令；第二次仍不合格才失败。
5. 开发报告审批通过后只进入 `test_plan_generation`；用户点击“生成测试方案”按钮后才创建 AgentTask。不创建 Testing Agent 或测试 Session，该任务复用原 Development Session。
6. 每需求最多两个当前主 Session，没有子 Agent；最终验收驳回后新建 `failure_fix` AgentTask 并复用原开发 Session。
7. 两个 OpenCode Agent 使用独立 Deployment、Service 和状态目录；需求澄清服务只读挂载工作区。
8. 对 OpenCode 执行一次真实的“发送消息 -> 读取消息历史”调用时，请求体不包含 `format`，历史接口可正常返回；遇到旧 `OutputFormatJsonSchema` Session 时只替换 Session 并重试一次。
9. 测试方案只在 `test_plan_generation` 校验范围、环境、前置条件、风险、进入/退出条件及非空人工用例；缺失项回传同一 Agent 补正一次。
10. 最终验收通过时统一推送全部工作区；推送失败保持最终验收并允许重试，全部成功后系统自动标记完成。
11. Agent 最终 JSON 的可读文本必须全部为英文；中文输入不能改变输出语言，中文路径、命令和其他技术标识可按原值保留。
12. Development Agent 在实现和修复模式下可直接执行复合 Bash 命令，后端不做命令级 allowlist 校验；只读任务仍必须在请求层关闭 Bash。

### 14.7 权限和审计验收

1. 用户不能访问其他租户的项目、需求、日志和配置。
2. 非管理员不能更新 Agent 和 API 密钥配置。
3. 所有审批、状态回退、配置变更、模型切换和合并操作可审计。
4. 日志中不出现密码、完整 Token、完整 API Key 或 Git 私钥。

---

## 15. 实施优先级与里程碑

### P0：打通可用闭环

- 认证、项目、仓库、需求基础接口。
- v2.2 流程状态机和三个人工门禁。
- 两个默认主 Agent 与两个独立 OpenCode Server 接入。
- 每需求独立分支、工作区、产物和日志。
- 开发文档、开发报告、最小检查证据、人工测试用例和验收记录。
- 当前前端页面接入真实后端并替换流程条。

### P1：提高并行和稳定性

- 两个主 Session 的替代、上下文恢复和审计完善。
- API 网关双优先级、Token 配额和切换验证。
- 合并队列、冲突预警和冲突处理。
- Agent 管理、API 网关、审计日志页面。

### P2：运营和扩展

- 更多 Agent 配置风格和经过评审的 Skills/MCP。
- 质量趋势、阶段耗时和模型成本分析。
- 更细粒度的项目策略和审批模板。
- 在确有安全和资源需求时评审任务沙箱，不默认采用动态 Pod。

---

## 16. 风险、约束与待确认事项

### 16.1 已确定约束

- K8S 必须用于整体部署，但本业务不做每 Agent/每需求动态 Pod。
- 首期且当前产品级 Agent 只允许需求澄清、开发、测试三个；所有主 Agent 内部都不允许任何子 Agent。
- 后端通过 OpenCode 接口调用，不由浏览器直连。
- 每需求独立分支和工作区。
- 最终完成必须由用户明确确认。

### 16.2 风险与控制

| 风险 | 影响 | 控制措施 |
| --- | --- | --- |
| Agent 输出不稳定 | 文档或代码质量波动 | 固定版本、检查清单、测试和人工门禁 |
| 多需求代码冲突 | 合并阻塞或错误覆盖 | 独立工作区、早期提示、真实 Git 检查、合并队列 |
| 模型配额并发超卖 | 任务中断、成本失控 | 原子预留/结算、幂等、用量审计 |
| MCP/Skill 权限过大 | 数据泄露或越权修改 | 允许列表、按 Agent 授权、后端二次校验 |
| 外部系统不稳定 | 流程卡住或状态不一致 | 异步同步、重试、幂等、人工处理入口 |
| 长任务服务重启 | 状态丢失或重复执行 | 持久化任务、检查点和恢复校验 |
| 当前前端与新流程差异大 | 联调返工 | 先冻结状态机和接口契约，再分页面接入 |

### 16.3 待产品/技术评审确认

1. 第一优先级 50,000 Token 的正式重置周期：按日、按月还是管理员手工重置。
2. 最终验收不通过是否始终回到开发，还是允许选择回到需求澄清。
3. 用户总 Token 额度的正式分配流程和 30 天滚动周期是否需要对接统一计费中心。
4. 完成/取消后本地需求工作区的默认保留天数。
5. 首期 Git 平台和 PR/MR API 的具体供应商及认证方式。

---

## 17. 需求追踪矩阵

| 需求主题 | 页面 | 后端模块 | 主要数据实体 | 核心验收 |
| --- | --- | --- | --- | --- |
| 项目空间 | 项目列表/详情 | Project/Repository | project, repository | 仓库可验证绑定 |
| 仓库凭据 | 项目详情仓库弹窗 | Repository/Git | repository | Token 加密、不回显、读写权限可区分 |
| 需求澄清 | 需求详情 | Requirement/Clarification | clarification_* | 必答问题完成后确认 |
| 开发文档 | 需求详情 | Artifact/Review | artifact, review_record | 驳回回到需求澄清 |
| 开发 | 需求详情 | Agent/Git | agent_task, git_workspace | 独立工作区、可重试 |
| 开发报告 | 需求详情 | Artifact/Review | artifact, review_record | 人工审批后生成结构化测试交接 |
| 测试方案生成 | 需求详情 | Development Agent/OpenCode | development_session, agent_task, artifact | 只生成方案与人工用例；字段缺失时同 Session 补正一次 |
| 测试方案审批 | 需求详情 | Review/Pipeline | review_record, stage_history, artifact | 驳回意见回传原 Development Session 并生成新版本 |
| 最终验收 | 需求详情 | Review/Pipeline | review_record, stage_history | 人工确认才完成 |
| Agent 管理 | Agent 管理 | Agent Config | agent_definition, agent_version | 发布版本不可原地修改 |
| API 网关 | API 网关 | Model Gateway | model_route, quota_ledger | 配额耗尽自动切换 |
| 多需求合并 | 需求详情 | Git/Merge Queue | git_workspace, merge_queue_item | 冲突不自动合并 |

---

## 18. 参考资料

- 原始产品需求：`PRD.md` v2.1。
- 当前前端实现：`dagent-web/src/router`、`dagent-web/src/views`、`dagent-web/src/stores`。
- OpenCode Agents：[https://opencode.ai/docs/agents/](https://opencode.ai/docs/agents/)
- OpenCode Skills：[https://opencode.ai/docs/skills/](https://opencode.ai/docs/skills/)
- OpenCode MCP Servers：[https://opencode.ai/docs/mcp-servers/](https://opencode.ai/docs/mcp-servers/)
- OpenCode Server：[https://dev.opencode.ai/docs/server/](https://dev.opencode.ai/docs/server/)

---

## 19. 修订记录

| 版本 | 日期 | 状态 | 说明 |
| --- | --- | --- | --- |
| v2.2-draft | 2026-07-31 | 评审草案 | 基于 v2.1、当前前端和最新需求评审新建；不覆盖原 PRD |
| v2.2-draft.2 | 2026-08-02 | 实现同步 | 收敛为两个主 Agent 和每需求两个长期 Session；每次操作新建 AgentTask；删除子 Agent；测试改为确定性执行；同步中信证券主题、结构化产物、审批意见传递、GLM 模型网关及 ACK/RDS 部署约束 |
| v2.2-draft.3 | 2026-08-02 | 实现同步 | 增加 HTTPS Personal Access Token 自助配置；Token 由 K8S 固定密钥加密后存入 MySQL；补充凭据更新/删除、读写权限验证、GIT_ASKPASS 推送和全链路脱敏要求 |
| v2.2-draft.4 | 2026-08-03 | 实现同步 | 改为需求澄清、开发、测试三个主 Agent 和每需求三个长期 Session；测试 Agent 在原 OpenCode Pod 内通过受限文件与 bash 工具完成测试全过程；删除独立 Test Runner、测试 Job 和测试用例审批阶段，增加真实工具证据校验、结构化开发交接及工作区锁 |
| v2.2-draft.5 | 2026-08-03 | 交互修正 | 仓库与 Token 保存从连接验证中拆分；连接验证前后端超时统一提高到至少 150 秒，避免保存成功被后续 Git 超时误报为失败 |
| v2.2-draft.6 | 2026-08-03 | 用户模型网关 | 增加用户级总额度、个人模型池和“用户 + Agent 类型”有序绑定；普通用户可使用模型网关；主备逻辑节点支持同一 glm-4.7-flash；按用户隔离计费并记录用户、Agent、模型和节点；平台 Base URL/API Key 继续由管理员安全保存 |
| v2.2-draft.7 | 2026-08-03 | OpenCode 兼容修复 | OpenCode 1.15.12 请求不再发送持久化的 JSON Schema `format`；后端继续解析并校验 Agent JSON；历史消息出现 `OutputFormatJsonSchema` 400 时创建替代 Session 并只重试一次；增加真实 POST/GET 消息链路验收约束 |
| v2.2-draft.8 | 2026-08-03 | 双 Agent 简化 | 仅保留需求澄清和开发两个主 Agent；拆分两个独立长期 OpenCode Deployment/Service；每需求最多两个长期 Session 并在回炉时复用；开发 Agent 仅运行最小单元/冒烟检查并生成人工测试用例；取消 Testing Agent 和测试执行阶段 |
| v2.2-draft.9 | 2026-08-03 | 模型额度切换修正 | 用户总预算改为可选硬限制并默认关闭；主备节点额度独立原子预留；节点额度不足继续按 Agent 顺序选择；上游错误最多切换一次；调用日志增加预计输入、输出预算、预留、实际用量和切换原因；明确同一 GLM API Key 不提供真实上游额度容灾 |
| v2.2-draft.10 | 2026-08-03 | 不可重试额度响应 | 模型代理的节点额度耗尽响应从会被 OpenAI Compatible 客户端自动重试的 HTTP 409 改为 HTTP 400；保留 `quota_exhausted` 和 `retryable: false`，避免 OpenCode 长时间重试导致 AgentTask 一直 running |
| v2.2-draft.11 | 2026-08-03 | Agent JSON 容错 | 严格 JSON 解析失败时使用专用 JSON 修复解析器处理 LLM 常见的未转义引号等语法错误，修复后继续执行既有字段规范化和业务校验；提示词同时要求字符串内使用中文引号 |
| v2.2-draft.12 | 2026-08-03 | 项目仓库删除 | 项目详情增加代码仓库删除操作；需求或工作区引用时阻止删除；共享仓库仅移除当前项目关联；完全无引用时删除 Dagent 本地仓库记录与加密凭据；任何情况都不删除远端 Git 仓库 |
| v2.2-draft.13 | 2026-08-03 | 测试方案与交付门禁 | 开发与修复结果不再要求 `test_cases`；开发报告通过后由原 Development Session 自动执行 `test_plan_generation`；测试方案严格校验并最多补正一次；最终验收统一推送，全部成功后自动完成，失败则留待重试；前端合并最终验收和完成终态 |
| v2.2-draft.14 | 2026-08-03 | 开发报告契约对齐 | 开发提示词给出精确 `checks` JSON；后端规范化单元/冒烟标签并以真实 bash 证据校准退出码；报告不合格时复用同一 Development Session 只读补正一次；失败日志不再重复写入 |
| v2.2-draft.15 | 2026-08-03 | 暂停工具证据门禁 | 开发任务继续校验报告结构和自报的单元/冒烟结果，但暂时不要求 `tool_evidence`、不匹配报告命令与 OpenCode bash 记录；工具调用仅保留为日志和审计信息 |
| v2.2-draft.16 | 2026-08-03 | 修复只读工作区误判 | 只读任务结束后保留 Git HEAD 校验，移除已提交变更列表与当前未提交文件列表的错误比较，避免测试方案阶段把干净工作区误判为被 Agent 修改 |
| v2.2-draft.17 | 2026-08-03 | 测试方案交互与英文契约 | 开发报告审批后不再自动创建测试方案任务，改为用户点击“生成测试方案”；仓库绑定只接受仓库主地址并单独填写默认分支；所有 Agent 最终 JSON 的可读文本强制使用英文，中文输出同 Session 最多补正一次 |
| v2.2-draft.18 | 2026-08-04 | 开放开发 Bash 命令 | Development Agent 写模式移除 Bash 命令白名单并改为默认允许；后端只按任务模式开关 Bash，不校验命令文本；只读模式继续禁用 Bash，OpenCode 仅保留推送、重置、合并和递归删除等危险命令拒绝 |
| v2.2-draft.19 | 2026-08-04 | Agent 独立模型顺序与重试上下文 | 模型优先级改为每个 Agent 绑定列表的独立连续顺序，禁止重复节点并校验节点适用 Agent；失败重试把脱敏后的上一任务最终错误加入提示词，要求复用已有改动并直接修正；确认 monitor-sidecar 的 metrics 正被采集后予以保留 |
| v2.2-draft.20 | 2026-08-04 | 审批闭环与阶段按钮重试 | 增加测试方案审批，驳回意见回到测试方案生成并形成新版本；所有通过/验收操作增加不可回退二次确认；当前阶段最新任务失败后主按钮直接走带原错误的重试；开发文档驳回后前端允许从已确认轮次启动新一轮澄清；monitor-sidecar 因 metrics 仍被采集继续保留 |
| v2.2-draft.21 | 2026-08-05 | 管理员新增平台模型 | 模型网关增加管理员平台模型配置页面，支持填写 Base URL、模型名称和 API Token；Token 使用现有 Fernet 密钥加密入库，响应不回显，连接验证成功后才允许启用；普通用户使用后台自动同步的已启用平台模型节点 |
| v2.2-draft.22 | 2026-08-05 | 简化模型接入 | 移除普通用户手动“添加模型”入口和模型目录接口；管理员启用平台模型后，后台自动为每个用户补齐对应模型节点，用户只维护 Agent 独立顺序与节点额度 |
| v2.2-draft.23 | 2026-08-05 | 取消模型域名白名单 | 删除 `MODEL_ROUTE_ALLOWED_HOSTS` 配置及连接验证中的固定域名限制，管理员配置的合法 HTTP(S) Base URL 可直接执行连接验证 |
| v2.2-draft.24 | 2026-08-05 | 统一平台模型额度 | 删除“我的模型”运行时副本和用户模型编辑/验证接口；平台模型直接持有节点额度，Agent 绑定直接保存平台模型 ID；调用日志和配额账本统一记录平台路由，保留旧用户模型表仅用于历史绑定迁移 |
| v2.2-draft.25 | 2026-08-05 | 平台模型真实验证 | 平台模型验证从仅检查 `/models` 改为追加最小 Chat Completions 请求；必须收到非空文本才算健康，前端展示真实响应摘要，失败信息脱敏 |
| v2.2-draft.26 | 2026-08-05 | 多协议模型接入 | 平台模型增加 `auto`、Chat Completions、Responses API 协议；真实验证自动识别并保存协议；Responses 请求由网关转换为 OpenCode 使用的 Chat Completions 契约 |
| v2.2-draft.27 | 2026-08-05 | GLM 路由验证预算 | 平台模型真实验证的最大输出预算提高到 256 Token，避免 GLM 推理内容占满过小预算而被误判为空响应；GLM-4.7 Flash 固定使用 Chat Completions 协议 |
