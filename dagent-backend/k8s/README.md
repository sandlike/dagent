# Dagent Kubernetes deployment

The deployment uses one persistent runtime Pod per non-terminal requirement.

```text
create requirement
-> backend creates Deployment + Service + dedicated PVC
-> initContainer prepares isolated state directories and runtime credentials
-> three Agent containers and workspace-manager start
-> requirement waits, runs, or waits for approval without losing the Pod
-> completion, cancellation, or deletion removes Deployment and Service
-> PVC is retained or deleted according to workspace_retention_policy
```

Each requirement Pod contains four independent containers:

- `requirement-clarification` on port `4096`: Wang Tianyou's clarification behavior with `grill-me`
- `development-document` on port `4097`: Wang Tianyou's grounded development-plan behavior with `dev-plan`
- `development` on port `4098`: repository implementation and focused checks
- `workspace-manager` on port `8090`: requirement Workspace preparation and Git operations

Each Agent has its own image, OpenCode process, configuration, Skill, password, port,
and state directory. Clarification and development-document mount the requirement
Workspace read-only; development and workspace-manager can write it. The containers
share only their requirement's Pod and PVC and cannot mount another requirement's
Workspace. A NetworkPolicy allows inbound Agent/workspace traffic only from
`dagent-backend`. Agent results and logs are persisted by the backend before the runtime
is removed. Deleting a runtime never deletes requirement, result, task-log, or audit rows
from MySQL.

The three local image projects are:

- `k8s/agent/images/requirement-clarification`
- `k8s/agent/images/development-document`
- `k8s/agent/images/development`

They build these registry images:

- `registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent-requirement-clarification:1.0.1`
- `registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent-development-document:1.0.1`
- `registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent-development:1.0.1`

No image is built when a requirement is created. If local Docker is unavailable, create
the three versioned build-context ConfigMaps and let the Kaniko Jobs build them in K8s:

```powershell
kubectl -n dagent create configmap dagent-requirement-clarification-image-v2 `
  --from-file=k8s/agent/images/requirement-clarification
kubectl -n dagent create configmap dagent-development-document-image-v2 `
  --from-file=k8s/agent/images/development-document
kubectl -n dagent create configmap dagent-development-image-v2 `
  --from-file=k8s/agent/images/development
kubectl apply -f k8s/agent/build-agent-images.yaml
kubectl -n dagent wait --for=condition=complete job `
  -l app.kubernetes.io/part-of=dagent --timeout=15m
kubectl apply -k k8s
```

The overlay also deploys the backend, two Nginx frontend replicas, a repository
verification workspace-manager, RBAC for dynamic requirement resources, and the test
Cloudflare tunnel. MySQL remains on Alibaba Cloud RDS; Redis is not used.

Required Secrets:

- `dagent-rds`: `DATABASE_URL`
- `dagent-secrets`: `JWT_SECRET_KEY`
- `dagent-git-credential-key`: `GIT_CREDENTIAL_ENCRYPTION_KEY`
- `dagent-glm`: `GLM_API_KEY`
- `dagent-agent-callback`: `AGENT_CALLBACK_TOKEN`
- `opencode-pull-secret`: registry pull credentials

The current ACK cluster has no default StorageClass, so the overlay explicitly uses
`alicloud-disk-topology-alltype` and a 20Gi PVC per requirement. `retain` is the default
workspace policy. Select `delete` when creating the requirement to remove its PVC when
the requirement finishes or is deleted.

`AUTO_CREATE_SCHEMA` and `SEED_DEMO_DATA` are enabled only for this test deployment.
Use versioned migrations and disable demo seeding before production.
