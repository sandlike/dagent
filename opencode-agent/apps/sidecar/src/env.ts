import { resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// sidecar 环境变量（部署时由 K8s 注入，本地开发用默认值）
const opencodeDir = process.env.OPENCODE_DIR ?? resolve(process.cwd(), '.uploads/.opencode')
const skillsDir = process.env.SKILLS_DIR ?? resolve(opencodeDir, 'skills')
const auditLogPath = process.env.AUDIT_LOG_PATH ?? resolve(opencodeDir, 'audit.log')

// 确保目录存在
for (const d of [opencodeDir, skillsDir]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  // 共享 PVC 路径：opencode 与 sidecar 挂载同一卷
  opencodeDir,
  skillsDir,
  auditLogPath,
  // 同 Pod 的 opencode 服务地址
  opencodeBase: process.env.OPENCODE_BASE ?? 'http://localhost:4096',
}
