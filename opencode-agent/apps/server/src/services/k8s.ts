import { env } from '../env.js'
import { findTemplate, imageRef, DEFAULT_TEMPLATE } from '@opencode/shared'

// K8s client 封装：本地用 kubeconfig，无集群时降级为 Mock
// 真实部署用 @kubernetes/client-node（按需 lazy import，避免无集群时启动失败）
//
// === 版本管理模型（2026-07-04 重构）===
// 一个逻辑实例 = 一个 group_id（稳定短 UUID），可有多版本 v1/v2/...
// 资源命名：
//   ConfigMap / Secret / Deployment → `${group_id}-v${n}[-{config|secret}]`（每版本独立）
//   PVC    → `${group_id}-pvc`（同 group 复用，跨版本保留数据）
//   Service → `${group_id}`（稳定名，切版本时改 selector）
// Label：
//   所有资源打 `opencode/group: ${group_id}`
//   版本化资源额外打 `opencode/version: v${n}`
// 同时只有一个版本在跑（PVC 是 RWO，强制约束）：
//   部署/回滚到目标版本 = scale 旧版本到 0（等 Pod 终止释放 PVC）→ 起目标版本到 1 → patch Service selector

export interface DeployVersionResources {
  groupId: string
  displayName: string
  versionNum: number
  namespace: string
  configJson: string
  secretData: Record<string, string>
  serverPassword?: string
  ownerId?: number
  agentType?: string
}

export interface DeployResult {
  deployed: boolean // false 表示 Mock（无集群）
  message: string
}

// 旧接口（兼容已部署实例 / 单元测试）
export interface DeployResources {
  name: string
  namespace: string
  configJson: string
  secretData: Record<string, string>
  serverPassword?: string
  ownerId?: number
  version?: string
  agentType?: string
}

let _available: boolean | null = null

async function loadClient(): Promise<any | null> {
  if (_available === false) return null
  try {
    const k8s = await import('@kubernetes/client-node')
    const kc = new k8s.KubeConfig()
    if (env.kubeconfig) {
      kc.loadFromFile(env.kubeconfig)
    } else {
      kc.loadFromDefault()
    }
    _available = true
    return { k8s, kc }
  } catch {
    _available = false
    return null
  }
}

export async function k8sAvailable(): Promise<boolean> {
  await loadClient()
  return _available === true
}

// 资源命名工具
function versionedName(groupId: string, versionNum: number): string {
  return `${groupId}-v${versionNum}`
}

// 确保 imagePullSecret 存在（幂等）
const PULL_SECRET_NAME = 'opencode-pull-secret'
async function ensureImagePullSecret(coreApi: any, namespace: string): Promise<string | undefined> {
  if (env.imagePullSecret) return env.imagePullSecret
  if (!env.imagePullRegistry || !env.imagePullUser || !env.imagePullPassword) return undefined
  const auth = Buffer.from(`${env.imagePullUser}:${env.imagePullPassword}`).toString('base64')
  const dockerconfigjson = JSON.stringify({
    auths: { [env.imagePullRegistry]: { auth, email: '' } },
  })
  try {
    await coreApi.createNamespacedSecret(namespace, {
      metadata: { name: PULL_SECRET_NAME, labels: { 'opencode/managed': 'true' } },
      type: 'kubernetes.io/dockerconfigjson',
      data: { '.dockerconfigjson': Buffer.from(dockerconfigjson).toString('base64') },
    })
  } catch {
    // 已存在则忽略
  }
  return PULL_SECRET_NAME
}

// 确保 PVC 存在（幂等）：同 group 共享，已存在则复用
async function ensurePvc(
  coreApi: any,
  namespace: string,
  groupId: string,
): Promise<void> {
  const pvcName = `${groupId}-pvc`
  try {
    await coreApi.readNamespacedPersistentVolumeClaim(pvcName, namespace)
    return // 已存在，复用
  } catch {
    // 不存在，继续创建
  }
  const pvcSpec: any = {
    accessModes: ['ReadWriteOnce'],
    resources: { requests: { storage: env.pvcSize } },
  }
  if (env.storageClassName) pvcSpec.storageClassName = env.storageClassName
  await coreApi.createNamespacedPersistentVolumeClaim(namespace, {
    metadata: {
      name: pvcName,
      labels: { 'opencode/group': groupId },
    },
    spec: pvcSpec,
  })
}

// 等待某 Deployment 的 Pod 全部终止（用于释放 RWO PVC）
// 超时 60s 后强制继续（让部署流程往下走，K8s 最终会终止 Pod）
async function waitForPodsTerminated(
  appsApi: any,
  coreApi: any,
  namespace: string,
  deploymentName: string,
  timeoutMs = 60000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    let replicas = 0
    try {
      const dep = await appsApi.readNamespacedDeployment(deploymentName, namespace)
      replicas = dep?.status?.replicas ?? 0
    } catch {
      return // Deployment 不存在，视为已终止
    }
    if (replicas === 0) {
      // 再确认 Pod 数为 0
      try {
        const pods = await coreApi.listNamespacedPod(
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          `opencode/instance=${deploymentName}`,
        )
        if ((pods?.items?.length ?? 0) === 0) return
      } catch {
        return
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

// 把某 group 下"非目标版本"的 Deployment scale 到 0（释放 PVC）
async function scaleDownOtherVersions(
  appsApi: any,
  coreApi: any,
  namespace: string,
  groupId: string,
  keepVersionNum: number,
): Promise<void> {
  let deps: any[] = []
  try {
    const list = await appsApi.listNamespacedDeployment(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      `opencode/group=${groupId}`,
    )
    deps = list?.items ?? []
  } catch {
    return
  }
  for (const dep of deps) {
    const labels = dep.metadata?.labels ?? {}
    const ver = labels['opencode/version']
    const depName = dep.metadata?.name
    if (!depName || !ver) continue
    const verNum = parseInt(ver.replace(/^v/, ''), 10)
    if (verNum === keepVersionNum) continue
    // 已是 0 副本的跳过
    if ((dep.spec?.replicas ?? 0) === 0) continue
    try {
      await appsApi.patchNamespacedDeployment(
        depName,
        namespace,
        { spec: { replicas: 0 } },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
      )
      await waitForPodsTerminated(appsApi, coreApi, namespace, depName)
    } catch {
      // 忽略单个版本 scale 失败
    }
  }
}

// patch Service selector 指向目标版本（不存在则创建）
// 注意：K8s Service selector 是 map，strategic/merge patch 只能加 key 不能删。
// 切版本时必须用 JSON patch replace 整个 selector，否则旧版本的 opencode/instance
// label 残留会导致 selector 同时要求新旧 label，匹配不到任何 Pod。
async function reconcileService(
  coreApi: any,
  namespace: string,
  groupId: string,
  activeVersionNum: number,
): Promise<void> {
  const serviceName = groupId // 稳定名
  // selector 只用 group + version（不用 opencode/instance，因为它带版本号会匹配不上）
  const selector = {
    'opencode/group': groupId,
    'opencode/version': `v${activeVersionNum}`,
  }
  try {
    await coreApi.readNamespacedService(serviceName, namespace)
    // 已存在 → 用 JSON patch replace 整个 selector（确保旧 key 被清除）
    await coreApi.patchNamespacedService(
      serviceName,
      namespace,
      [{ op: 'replace', path: '/spec/selector', value: selector }],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } },
    )
  } catch {
    // 不存在 → 创建
    await coreApi.createNamespacedService(namespace, {
      metadata: {
        name: serviceName,
        labels: { 'opencode/group': groupId },
      },
      spec: {
        type: 'ClusterIP',
        selector,
        ports: [
          { name: 'opencode', port: 4096, targetPort: 4096 },
          { name: 'sidecar', port: 8080, targetPort: 8080 },
        ],
      },
    })
  }
}

// 创建单个版本的 ConfigMap + Secret + Deployment（版本化名）
async function createVersionResources(
  k8s: any,
  appsApi: any,
  coreApi: any,
  res: DeployVersionResources,
): Promise<void> {
  const { groupId, versionNum, namespace, configJson, secretData } = res
  const vName = versionedName(groupId, versionNum)
  const template =
    (res.agentType ? findTemplate(res.agentType) : undefined) ?? DEFAULT_TEMPLATE
  const opencodeImage = imageRef(template, process.env.IMAGE_REGISTRY)
  const pullSecretName = await ensureImagePullSecret(coreApi, namespace)

  // 1. ConfigMap（版本化名）
  await coreApi.createNamespacedConfigMap(namespace, {
    metadata: {
      name: `${vName}-config`,
      labels: {
        'opencode/group': groupId,
        'opencode/version': `v${versionNum}`,
        'opencode/owner': String(res.ownerId ?? ''),
      },
    },
    data: { 'opencode.json': configJson },
  })

  // 2. Secret（版本化名）
  await coreApi.createNamespacedSecret(namespace, {
    metadata: {
      name: `${vName}-secret`,
      labels: {
        'opencode/group': groupId,
        'opencode/version': `v${versionNum}`,
        'opencode/owner': String(res.ownerId ?? ''),
      },
    },
    stringData: secretData,
  })

  // 3. Deployment（版本化名，selector 用 opencode/group 稳定）
  await appsApi.createNamespacedDeployment(namespace, {
    metadata: {
      name: vName,
      labels: {
        'opencode/group': groupId,
        'opencode/version': `v${versionNum}`,
        'opencode/instance': vName, // 兼容旧 label（port-forward/list 用）
        'opencode/owner': String(res.ownerId ?? ''),
      },
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { 'opencode/group': groupId } },
      template: {
        metadata: {
          labels: {
            'opencode/group': groupId,
            'opencode/version': `v${versionNum}`,
            'opencode/instance': vName,
          },
        },
        spec: {
          securityContext: {
            runAsUser: 1500,
            runAsGroup: 1500,
            fsGroup: 1500,
          },
          ...(pullSecretName ? { imagePullSecrets: [{ name: pullSecretName }] } : {}),
          containers: [
            {
              name: 'opencode',
              image: opencodeImage,
              command: ['opencode', 'serve', '--hostname', '0.0.0.0', '--port', '4096'],
              ports: [{ containerPort: 4096 }],
              envFrom: [{ secretRef: { name: `${vName}-secret` } }],
              volumeMounts: [
                {
                  name: 'config',
                  mountPath: '/home/opencode/.config/opencode/opencode.json',
                  subPath: 'opencode.json',
                },
                {
                  name: 'data',
                  mountPath: '/home/opencode/.config/opencode/skills',
                  subPath: 'skills',
                },
                {
                  name: 'data',
                  mountPath: '/home/opencode/.local/share/opencode',
                  subPath: 'data',
                },
              ],
            },
            {
              name: 'monitor-sidecar',
              image: process.env.SIDECAR_IMAGE ?? 'opencode-sidecar:latest',
              ports: [{ containerPort: 8080 }],
              env: [
                { name: 'OPENCODE_DIR', value: '/home/opencode/.config/opencode' },
                { name: 'SKILLS_DIR', value: '/home/opencode/.config/opencode/skills' },
                { name: 'OPENCODE_BASE', value: 'http://localhost:4096' },
                { name: 'AUDIT_LOG_PATH', value: '/home/opencode/.config/opencode/audit.log' },
                // Nacos 注册用 group_id（稳定，不随版本变）
                { name: 'AGENT_NAME', value: groupId },
                { name: 'POD_IP', valueFrom: { fieldRef: { fieldPath: 'status.podIP' } } },
              ],
              volumeMounts: [
                { name: 'data', mountPath: '/home/opencode/.config/opencode/skills', subPath: 'skills' },
              ],
            },
          ],
          volumes: [
            { name: 'config', configMap: { name: `${vName}-config` } },
            { name: 'data', persistentVolumeClaim: { claimName: `${groupId}-pvc` } }, // 复用 group 级 PVC
          ],
        },
      },
    },
  })
}

// === 主入口：部署指定版本 ===
// 流程：确保 PVC → scale down 其他版本（释放 PVC）→ 创建新版本资源 → patch Service
export async function deployInstanceVersion(res: DeployVersionResources): Promise<DeployResult> {
  const client = await loadClient()
  if (!client) {
    return {
      deployed: false,
      message: '未配置 K8s 集群，实例已记录为 Mock 状态（可在测试环境联调真实部署）',
    }
  }
  const { k8s, kc } = client
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const { groupId, versionNum, namespace } = res

  try {
    // 1. 确保 group 级 PVC 存在（复用）
    await ensurePvc(coreApi, namespace, groupId)
    // 2. scale down 同 group 其他版本（释放 RWO PVC）
    await scaleDownOtherVersions(appsApi, coreApi, namespace, groupId, versionNum)
    // 3. 创建目标版本资源（幂等性：若已存在会抛 AlreadyExists，由外层处理）
    await createVersionResources(k8s, appsApi, coreApi, res)
    // 4. Service selector 指向新版本
    await reconcileService(coreApi, namespace, groupId, versionNum)
    return { deployed: true, message: `已部署版本 v${versionNum} 并切换为活跃版本` }
  } catch (e) {
    _available = false
    return {
      deployed: false,
      message: `K8s 部署失败：${(e as Error).message}`,
    }
  }
}

// === 回滚：把指定版本切回活跃 ===
export async function rollbackInstance(
  groupId: string,
  versionNum: number,
  namespace: string,
): Promise<DeployResult> {
  const client = await loadClient()
  if (!client) return { deployed: false, message: 'Mock 模式' }
  const { k8s, kc } = client
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const vName = versionedName(groupId, versionNum)
  try {
    // 确认目标版本 Deployment 存在
    try {
      await appsApi.readNamespacedDeployment(vName, namespace)
    } catch {
      return { deployed: false, message: `版本 v${versionNum} 的 Deployment 不存在` }
    }
    // scale down 其他版本
    await scaleDownOtherVersions(appsApi, coreApi, namespace, groupId, versionNum)
    // scale up 目标版本
    await appsApi.patchNamespacedDeployment(
      vName,
      namespace,
      { spec: { replicas: 1 } },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
    )
    // patch Service selector
    await reconcileService(coreApi, namespace, groupId, versionNum)
    return { deployed: true, message: `已回滚到 v${versionNum}` }
  } catch (e) {
    return { deployed: false, message: `回滚失败: ${(e as Error).message}` }
  }
}

// === 删除整个 group（级联删所有版本 + Service + PVC）===
export async function deleteInstanceGroup(groupId: string, namespace: string): Promise<DeployResult> {
  const client = await loadClient()
  if (!client) return { deployed: false, message: 'Mock 模式，无需清理 K8s 资源' }
  const { k8s, kc } = client
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  try {
    // 列出同 group 所有 Deployment，逐个删
    let deps: any[] = []
    try {
      const list = await appsApi.listNamespacedDeployment(
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `opencode/group=${groupId}`,
      )
      deps = list?.items ?? []
    } catch {}
    for (const dep of deps) {
      const depName = dep.metadata?.name
      if (!depName) continue
      try { await appsApi.deleteNamespacedDeployment(depName, namespace) } catch {}
    }
    // 删 Service（稳定名 = groupId）
    try { await coreApi.deleteNamespacedService(groupId, namespace) } catch {}
    // 删 PVC（group 级）
    try { await coreApi.deleteNamespacedPersistentVolumeClaim(`${groupId}-pvc`, namespace) } catch {}
    // 兜底：删可能残留的旧命名资源（兼容未迁移的旧实例 name=groupId）
    for (const n of [`${groupId}-config`, `${groupId}-secret`, groupId]) {
      try { await coreApi.deleteNamespacedConfigMap(n, namespace) } catch {}
      try { await coreApi.deleteNamespacedSecret(n, namespace) } catch {}
      // 旧 Deployment/Service 名可能就是 groupId（迁移前的实例）
      if (n === groupId) {
        try { await appsApi.deleteNamespacedDeployment(n, namespace) } catch {}
        try { await coreApi.deleteNamespacedService(n, namespace) } catch {}
      }
    }
    return { deployed: true, message: '已级联删除 group 所有资源' }
  } catch {
    _available = false
    return { deployed: false, message: 'K8s 不可达，仅清理数据库记录' }
  }
}

// === 重启指定版本（rolling restart）===
export async function restartInstance(
  name: string, // 版本化 Deployment 名（${groupId}-v${n}）
  namespace: string,
): Promise<DeployResult> {
  const client = await loadClient()
  if (!client) return { deployed: false, message: 'Mock 模式，无需重启' }
  const { k8s, kc } = client
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  try {
    await appsApi.patchNamespacedDeployment(
      name,
      namespace,
      {
        spec: {
          template: {
            metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } },
          },
        },
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
    )
    return { deployed: true, message: '已触发滚动重启' }
  } catch (e) {
    return { deployed: false, message: `重启失败: ${(e as Error).message}` }
  }
}

// === 兼容旧调用：deployInstance / deleteInstance ===
// 旧代码（单元测试等）可能仍调用这两个，内部转成版本化部署（versionNum=1, groupId=name）
export async function deployInstance(res: DeployResources): Promise<DeployResult> {
  return deployInstanceVersion({
    groupId: res.name,
    displayName: res.name,
    versionNum: 1,
    namespace: res.namespace,
    configJson: res.configJson,
    secretData: res.secretData,
    serverPassword: res.serverPassword,
    ownerId: res.ownerId,
    agentType: res.agentType,
  })
}

export async function deleteInstance(name: string, namespace: string): Promise<DeployResult> {
  // name 在旧接口里是实例名 = 现在的 group_id（迁移后兼容）
  return deleteInstanceGroup(name, namespace)
}
