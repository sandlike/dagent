import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import { env } from '../env.js'
import * as schema from './schema.js'

// 全局连接池（单例）
const globalForDb = globalThis as unknown as {
  _mysqlPool?: mysql.Pool
}

const pool =
  globalForDb._mysqlPool ??
  mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    // 用 ISO 字符串存日期
    dateStrings: true,
  })

if (process.env.NODE_ENV !== 'production') globalForDb._mysqlPool = pool

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
