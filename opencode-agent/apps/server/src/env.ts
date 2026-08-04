import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 按优先级查找根 .env：cwd 上溯 → import.meta.url 上溯
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  new URL('../../../.env', import.meta.url).pathname, // src/env.ts → 根
]
for (const p of candidates) {
  if (existsSync(p)) {
    config({ path: p })
    break
  }
}

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback
  if (v === undefined) {
    throw new Error(`Missing required env: ${key}`)
  }
  return v
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: required('MYSQL_HOST'),
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE'),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  kubeconfig: process.env.KUBECONFIG ?? undefined,
  // 部署实例的默认 namespace（各环境隔离：opencode-test / opencode-staging / opencode-prod）
  instanceNamespace: process.env.INSTANCE_NAMESPACE ?? 'opencode-users',
  // K8s 部署相关（阿里云 ACK 等环境）
  storageClassName: process.env.STORAGE_CLASS_NAME ?? undefined, // 无默认 SC 时必须指定
  pvcSize: process.env.PVC_SIZE ?? '20Gi', // 阿里云云盘最小 20Gi
  // 镜像拉取凭据（私有 registry）
  imagePullSecret: process.env.IMAGE_PULL_SECRET ?? undefined, // 已存在的 secret 名，复用
  imagePullRegistry: process.env.IMAGE_PULL_REGISTRY ?? process.env.IMAGE_REGISTRY ?? undefined,
  imagePullUser: process.env.IMAGE_PULL_USER ?? undefined,
  imagePullPassword: process.env.IMAGE_PULL_PASSWORD ?? undefined,
  // Higress 网关（密钥保管箱 + LLM 代理）
  higress: {
    consoleUrl: process.env.HIGRESS_CONSOLE_URL ?? 'http://higress-console.higress-system.svc:8080',
    consoleUser: process.env.HIGRESS_CONSOLE_USER ?? 'admin',
    consolePassword: process.env.HIGRESS_CONSOLE_PASSWORD ?? 'admin',
    // Gateway 数据面地址（agent 调 LLM 时走这里）
    gatewayUrl: process.env.HIGRESS_GATEWAY_URL ?? 'http://higress-gateway.higress-system.svc:80',
    // 用于 LLM 代理路由的域名（Higress 按 host 路由）
    gatewayDomain: process.env.HIGRESS_GATEWAY_DOMAIN ?? 'ai.oma.internal',
  },
}
