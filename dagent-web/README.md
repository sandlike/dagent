# Dagent Web

Vue 3 frontend for Dagent.

Local development:

```powershell
npm ci
npm run dev
```

Build the production image:

```powershell
docker build -t registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:web-v1.0.0 .
```

The Docker build compiles the Vue source and copies `dist` plus the Nginx
configuration into the final image. Kubernetes does not mount a frontend tarball or
an Nginx ConfigMap.
