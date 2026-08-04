import {
  mysqlTable,
  varchar,
  int,
  datetime,
  mysqlEnum,
  text,
  index,
} from 'drizzle-orm/mysql-core'

// 用户表（自带账号体系）
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
})

// LLM Provider 配置表（真实 key 存 Higress，这里存 Higress 路由信息 + OMA 消费者 key）
export const providers = mysqlTable(
  'providers',
  {
    id: int('id').autoincrement().primaryKey(),
    ownerId: int('owner_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(), // 显示名（如 "DeepSeek"）
    template: varchar('template', { length: 32 }).notNull(), // deepseek/openai/anthropic/custom
    // Higress 相关
    higressProviderName: varchar('higress_provider_name', { length: 128 }), // Higress 里的 provider 名（如 "deepseek-xxx"）
    higressRouteName: varchar('higress_route_name', { length: 128 }), // Higress 里的 AI 路由名
    higressConsumerKey: varchar('higress_consumer_key', { length: 255 }), // OMA 签发的消费者 key（agent 用这个）
    // upstream 信息（展示用，真实 key 不存这里）
    baseUrl: varchar('base_url', { length: 512 }), // 原始 upstream 地址（如 https://api.deepseek.com/v1）
    models: text('models'), // JSON 数组：支持的模型列表
    // 状态
    status: mysqlEnum('status', ['active', 'error', 'deleted']).notNull().default('active'),
    createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
    updatedAt: datetime('updated_at').notNull().default(new Date('1970-01-01')),
  },
  (t) => ({
    ownerIdx: index('idx_provider_owner').on(t.ownerId),
  }),
)

// 实例表（对应一个 K8s Deployment/Pod）
// 版本管理：同 group_id 的多条记录代表同一逻辑实例的不同版本，
// is_active=1 表示当前活跃版本（同一 group 同时只有一个 active）。
// name = `${group_id}-v${version_num}`（K8s Deployment 实际名）
// PVC/Service 用稳定名 `${group_id}`，跨版本复用
export const instances = mysqlTable(
  'instances',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(), // 版本化 K8s 名：${group_id}-v${n}
    displayName: varchar('display_name', { length: 128 }).notNull(), // 用户填的展示名
    groupId: varchar('group_id', { length: 32 }).notNull(), // 稳定逻辑标识（短 UUID）
    versionNum: int('version_num').notNull().default(1), // v1, v2, ...
    isActive: int('is_active', { unsigned: true }).notNull().default(1), // 0/1
    ownerId: int('owner_id').notNull(),
    namespace: varchar('namespace', { length: 64 }).notNull(),
    status: mysqlEnum('status', ['running', 'deploying', 'error', 'stopped'])
      .notNull()
      .default('deploying'),
    configJson: text('config_json').notNull(),
    version: varchar('version', { length: 64 }), // 兼容字段（原存 agentType）
    modelId: varchar('model_id', { length: 128 }),
    provider: varchar('provider', { length: 64 }),
    createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
    updatedAt: datetime('updated_at').notNull().default(new Date('1970-01-01')),
  },
  (t) => ({
    ownerIdx: index('idx_owner').on(t.ownerId),
    groupIdx: index('idx_group').on(t.groupId),
    groupActiveIdx: index('idx_group_active').on(t.groupId, t.isActive),
  }),
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type InstanceRow = typeof instances.$inferSelect
export type NewInstance = typeof instances.$inferInsert
export type ProviderRow = typeof providers.$inferSelect
export type NewProvider = typeof providers.$inferInsert

// Skill 模板表（统一管理，部署实例时可预装到 PVC）
export const skillTemplates = mysqlTable(
  'skill_templates',
  {
    id: int('id').autoincrement().primaryKey(),
    ownerId: int('owner_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    description: varchar('description', { length: 512 }).notNull().default(''),
    // Skill 内容（SKILL.md 原文）
    content: text('content'),
    // 可选附加文件（JSON 数组：{filename, content}）
    files: text('files'),
    // 来源
    source: varchar('source', { length: 32 }).notNull().default('custom'), // custom / nacos / market
    status: mysqlEnum('status', ['active', 'deleted']).notNull().default('active'),
    createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
    updatedAt: datetime('updated_at').notNull().default(new Date('1970-01-01')),
  },
  (t) => ({
    ownerIdx: index('idx_skill_owner').on(t.ownerId),
  }),
)
export type SkillTemplateRow = typeof skillTemplates.$inferSelect

// MCP Server 配置表（真实 token 存 Higress，和 providers 同理）
export const mcpServers = mysqlTable(
  'mcp_servers',
  {
    id: int('id').autoincrement().primaryKey(),
    ownerId: int('owner_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    type: mysqlEnum('type', ['remote', 'local']).notNull().default('remote'),
    // 原始 upstream 信息（展示用）
    url: varchar('url', { length: 512 }),
    command: text('command'), // local 类型的命令
    // Higress 相关（remote 类型）
    higressRouteName: varchar('higress_route_name', { length: 128 }),
    higressConsumerKey: varchar('higress_consumer_key', { length: 255 }),
    // 状态
    status: mysqlEnum('status', ['active', 'error', 'deleted']).notNull().default('active'),
    createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
    updatedAt: datetime('updated_at').notNull().default(new Date('1970-01-01')),
  },
  (t) => ({
    ownerIdx: index('idx_mcp_owner').on(t.ownerId),
  }),
)
export type McpServerRow = typeof mcpServers.$inferSelect

// 审计日志（替代 sidecar 本地文件，持久化到 DB）
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    instanceName: varchar('instance_name', { length: 128 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(), // skill_create / skill_delete / a2a_call / error
    detail: text('detail'), // JSON 详情
    level: mysqlEnum('level', ['info', 'warn', 'error']).notNull().default('info'),
    createdAt: datetime('created_at').notNull().default(new Date('1970-01-01')),
  },
  (t) => ({
    instanceIdx: index('idx_audit_instance').on(t.instanceName),
    levelIdx: index('idx_audit_level').on(t.level),
  }),
)
export type AuditLogRow = typeof auditLogs.$inferSelect
