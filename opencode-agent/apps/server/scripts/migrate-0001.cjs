// 一次性 migration 脚本：instances 表加 display_name/group_id/version_num/is_active
// 幂等，可重复执行
const mysql = require('mysql2/promise')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') })

async function main() {
  const host = process.env.MYSQL_HOST
  const port = Number(process.env.MYSQL_PORT ?? 3306)
  const user = process.env.MYSQL_USER
  const password = process.env.MYSQL_PASSWORD
  // 优先 agenthub_test（ACK 测试库），其次 agenthub
  const candidates = ['agenthub_test', 'agenthub', process.env.MYSQL_DATABASE].filter(Boolean)
  const database = process.env.MYSQL_DATABASE || 'agenthub_test'

  console.log(`connecting to ${host}:${port}/${database} as ${user}`)
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true })

  // 当前列
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'instances'`,
    [database],
  )
  const existing = cols.map((c) => c.COLUMN_NAME)

  const toAdd = [
    ['display_name', "VARCHAR(128) NOT NULL DEFAULT ''"],
    ['group_id', "VARCHAR(32) NOT NULL DEFAULT ''"],
    ['version_num', 'INT NOT NULL DEFAULT 1'],
    ['is_active', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ]
  for (const [col, def] of toAdd) {
    if (!existing.includes(col)) {
      await conn.query(`ALTER TABLE instances ADD COLUMN \`${col}\` ${def}`)
      console.log('✅ added column:', col)
    } else {
      console.log('– exists:', col)
    }
  }

  // 回填旧数据
  const [r1] = await conn.query(
    `UPDATE instances SET group_id = name, version_num = 1, is_active = 1, display_name = CASE WHEN display_name = '' THEN name ELSE display_name END WHERE group_id = '' OR display_name = ''`,
  )
  console.log('✅ backfilled rows:', r1.affectedRows)

  // 索引
  const [idx] = await conn.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'instances'`,
    [database],
  )
  const idxNames = idx.map((i) => i.INDEX_NAME)
  if (!idxNames.includes('idx_group')) {
    await conn.query('CREATE INDEX idx_group ON instances (group_id)')
    console.log('✅ added index idx_group')
  }
  if (!idxNames.includes('idx_group_active')) {
    await conn.query('CREATE INDEX idx_group_active ON instances (group_id, is_active)')
    console.log('✅ added index idx_group_active')
  }

  // 验证
  const [rows] = await conn.query(
    'SELECT id, name, display_name, group_id, version_num, is_active FROM instances',
  )
  console.log('current rows:', JSON.stringify(rows, null, 2))
  await conn.end()
}

main().catch((e) => {
  console.error('❌ migration failed:', e.message)
  process.exit(1)
})
