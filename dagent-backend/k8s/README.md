# Dagent Kubernetes deployment

This overlay deploys these workloads into the `dagent` namespace:

- One Dagent backend replica exposed by a ClusterIP Service
- Two Nginx frontend replicas exposed by an approved HTTPS test tunnel
- One persistent requirement-clarification OpenCode Pod
- One persistent development OpenCode Pod with workspace manager sidecar and monitoring handled by the cluster
- An `ExternalName` Service named `mysql` that resolves to the existing Alibaba Cloud RDS endpoint

Redis is not required by this implementation. MySQL is provided by RDS rather than a MySQL Pod in ACK.
The two main Agents use separate Deployments, Services, and OpenCode state directories. The requirement Agent mounts
workspaces read-only. The development Agent uses the preinstalled Python/pytest, Node.js/npm, Java/JDK/Maven/Gradle,
Go, and Git toolchain for minimal unit and smoke checks. No Testing Agent, Test Runner, test Job, or test Pod is created.

The manifests never contain production credentials. Create these Secrets before applying the overlay:

- `dagent-rds`: `DATABASE_URL`
- `dagent-secrets`: `JWT_SECRET_KEY`
- `dagent-git-credential-key`: `GIT_CREDENTIAL_ENCRYPTION_KEY` (a fixed Fernet key)
- `dagent-glm`: `GLM_API_KEY`
- `dagent-agent-callback`: `AGENT_CALLBACK_TOKEN`
- `dagent-development-agent-auth`: `OPENCODE_SERVER_PASSWORD`
- `opencode-pull-secret`: registry pull credentials

Build and push the image referenced by `kustomization.yaml`, then deploy:

```powershell
kubectl -n dagent create configmap dagent-opencode-runtime-build-v2 `
  --from-file=Dockerfile=k8s/agent/Dockerfile
kubectl apply -f k8s/agent/runtime-build-job.yaml
kubectl -n dagent wait --for=condition=complete job/dagent-opencode-runtime-build-v2 --timeout=20m
kubectl apply -k k8s
kubectl -n dagent rollout status deployment/dagent-backend
kubectl -n dagent rollout status deployment/dagent-requirement-agent
kubectl -n dagent rollout status deployment/dagent-development-agent
kubectl -n dagent port-forward service/dagent-backend 8000:8000
```

The frontend static bundle is intentionally separate from the manifests because the
development machine does not require Docker. Build it, archive `dist`, and create the
versioned bundle before applying the overlay:

```powershell
npm run build
tar -czf frontend.tar.gz -C dist .
kubectl -n dagent create configmap dagent-frontend-bundle-v1 `
  --from-file=frontend.tar.gz=frontend.tar.gz
kubectl apply -k k8s
```

The approved test deployment uses a Cloudflare Quick Tunnel because arbitrary domains
on the Alibaba Cloud mainland-China gateway are blocked until ICP filing is complete.
Read the generated `https://*.trycloudflare.com` URL from the tunnel Pod logs. Quick
Tunnel URLs change after the tunnel Pod restarts; use an owned, ICP-filed domain and a
valid TLS certificate before production use. Do not expose login over plain HTTP.

`AUTO_CREATE_SCHEMA` and `SEED_DEMO_DATA` are enabled for the first test deployment. Disable demo seeding and use migrations before a production rollout.
