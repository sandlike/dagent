# Dagent Kubernetes deployment

All application code is built into versioned Docker images before deployment. Kubernetes
only pulls and starts images; it does not unpack source or frontend tarballs and it does
not build images inside the cluster.

## Images

The project uses one Alibaba Cloud repository with component-specific tags:

```text
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:backend-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:web-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:agent-runtime-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:requirement-clarification-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:development-document-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:development-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:workspace-manager-v1.0.0
registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:cloudflared-e39ee8da81ad
```

`cloudflared` is a pinned third-party image mirrored into the same repository. The other
seven images are built from this project and the sibling `dagent-web` repository.

## Build and push

Log in without putting the password in the command history:

```powershell
$password = Read-Host "Alibaba Cloud registry password" -AsSecureString
$credential = [pscredential]::new("lwjlwjlwj33712563", $password)
$credential.GetNetworkCredential().Password | docker login `
  --username $credential.UserName --password-stdin registry.cn-hangzhou.aliyuncs.com
```

Build, tag, and push every image:

```powershell
.\k8s\build-images.ps1 -Version v1.0.0 -Push
```

The script tags images with their full registry names during `docker build`, so a separate
`docker tag [ImageId] ...` command is unnecessary.

## Deploy

After every push succeeds:

```powershell
kubectl apply -k k8s
kubectl -n dagent rollout status deployment/dagent-backend --timeout=5m
kubectl -n dagent rollout status deployment/dagent-frontend --timeout=5m
kubectl -n dagent rollout status deployment/dagent-repository-verifier --timeout=5m
```

The backend reconciles active requirement Deployments. Each requirement Pod contains four
containers that use their own prebuilt image:

```text
requirement Pod
|- requirement-clarification :4096
|- development-document      :4097
|- development               :4098
`- workspace-manager         :8090
```

The three Agent containers have independent OpenCode configuration, Skill, password, port,
and state directory. They share only that requirement's PVC. Clarification and development
document mount the Workspace read-only; development and workspace-manager can write it.

ConfigMaps now contain ordinary non-secret environment configuration only. Secrets remain in
Kubernetes Secrets. No source code, compiled frontend, Agent Skill, or startup script is stored
in a ConfigMap.

Required Secrets:

- `dagent-rds`: `DATABASE_URL`
- `dagent-secrets`: `JWT_SECRET_KEY`
- `dagent-git-credential-key`: `GIT_CREDENTIAL_ENCRYPTION_KEY`
- `dagent-glm`: `GLM_API_KEY`
- `dagent-agent-callback`: `AGENT_CALLBACK_TOKEN`
- `opencode-pull-secret`: Alibaba Cloud registry pull credentials

The cluster uses `alicloud-disk-topology-alltype` and a 20Gi PVC per requirement. MySQL is
Alibaba Cloud RDS and is not packaged as a project image.
