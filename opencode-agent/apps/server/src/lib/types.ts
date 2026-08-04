import type { JwtPayload } from '../lib/jwt.js'

// Hono 应用级上下文变量类型
export interface AppBindings {
  Variables: {
    user: JwtPayload
  }
}
