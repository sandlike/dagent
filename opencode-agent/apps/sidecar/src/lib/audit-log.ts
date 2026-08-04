import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import { env } from '../env.js'

export interface AuditEntry {
  ts: string // ISO 时间
  action: string // skill.upload / skill.delete / ...
  detail: Record<string, unknown>
  ok: boolean
}

// 追加写一条审计日志（JSONL 格式），同时输出到 stdout 供 kubectl logs 查看
export function logAudit(action: string, detail: Record<string, unknown>, ok = true) {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    action,
    detail,
    ok,
  }
  const line = JSON.stringify(entry)
  try {
    appendFileSync(env.auditLogPath, line + '\n')
  } catch {
    // 写日志失败不应影响主流程
  }
  console.log(`[audit] ${line}`)
}

// 读取审计日志（倒序，最近 limit 条）
export function readAudit(limit = 100): AuditEntry[] {
  if (!existsSync(env.auditLogPath)) return []
  const text = readFileSync(env.auditLogPath, 'utf8')
  const lines = text.split('\n').filter(Boolean)
  const entries: AuditEntry[] = []
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {
      // 跳过损坏行
    }
  }
  return entries.reverse().slice(0, limit)
}
