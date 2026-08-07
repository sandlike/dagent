param(
    [string]$Version = "v1.0.0",
    [string]$Registry = "registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent",
    [switch]$Push
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9]+)*$') {
    throw "Version must look like v1.0.0 or v1.0.0-rc1."
}

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectRoot = Split-Path $backendRoot -Parent
$webRoot = Join-Path $projectRoot "dagent-web"
$agentRoot = Join-Path $PSScriptRoot "agent"

if (-not (Test-Path -LiteralPath (Join-Path $webRoot "Dockerfile"))) {
    throw "Frontend Dockerfile not found: $webRoot"
}

$images = [ordered]@{
    backend                  = "${Registry}:backend-${Version}"
    web                      = "${Registry}:web-${Version}"
    agentRuntime             = "${Registry}:agent-runtime-${Version}"
    requirementClarification = "${Registry}:requirement-clarification-${Version}"
    developmentDocument      = "${Registry}:development-document-${Version}"
    development              = "${Registry}:development-${Version}"
    workspaceManager         = "${Registry}:workspace-manager-${Version}"
    cloudflared              = "${Registry}:cloudflared-e39ee8da81ad"
}

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($args -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Write-Host "Building Dagent images for $Version"

Invoke-Docker build --pull -t $images.backend -f (Join-Path $backendRoot "Dockerfile") $backendRoot
Invoke-Docker build --pull -t $images.web -f (Join-Path $webRoot "Dockerfile") $webRoot
Invoke-Docker build --pull -t $images.agentRuntime -f (Join-Path $agentRoot "Dockerfile") $agentRoot

foreach ($role in @(
    @{ Name = "requirement-clarification"; Image = $images.requirementClarification },
    @{ Name = "development-document"; Image = $images.developmentDocument },
    @{ Name = "development"; Image = $images.development }
)) {
    $context = Join-Path $agentRoot ("images/" + $role.Name)
    Invoke-Docker build `
        --build-arg "AGENT_RUNTIME_IMAGE=$($images.agentRuntime)" `
        -t $role.Image `
        -f (Join-Path $context "Dockerfile") `
        $context
}

Invoke-Docker build --pull `
    -t $images.workspaceManager `
    -f (Join-Path $agentRoot "Dockerfile.workspace-manager") `
    $agentRoot

$cloudflaredSource = "docker.m.daocloud.io/cloudflare/cloudflared@sha256:e39ee8da81ad5e05d77f38d2f51c60ca51bf2a8450ac3abab50c17fdb91d91bf"
Invoke-Docker pull $cloudflaredSource
Invoke-Docker tag $cloudflaredSource $images.cloudflared

if ($Push) {
    foreach ($image in $images.Values) {
        Invoke-Docker push $image
    }
}

Write-Host "Images ready:"
$images.Values | ForEach-Object { Write-Host "  $_" }
