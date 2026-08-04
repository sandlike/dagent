// 一次性建库脚本：确保 database 存在（不连接具体库）
import { config } from 'dotenv'
import mysql from 'mysql2/promise'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  new URL('../../../.env', import.meta.url).pathname,
]
for (const p of candidates) {
  if (existsSync(p)) {
    config({ path: p })
    break
  }
}

const dbName = process.env.MYSQL_DATABASE ?? 'agenthub'

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST!,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
  })
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  console.log(`✅ database '${dbName}' ensured`)
  await conn.end()
}

main().catch((e) => {
  console.error('❌ init db failed:', e)
  process.exit(1)
})
