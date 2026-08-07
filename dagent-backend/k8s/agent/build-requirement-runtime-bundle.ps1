param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "agent-v2.tar.gz")
)

$ErrorActionPreference = "Stop"
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dagent-agent-v2-" + [Guid]::NewGuid())

try {
    $configRoot = Join-Path $stagingRoot "config"
    $grillSkill = Join-Path $configRoot "skills/grill-me"
    $devPlanSkill = Join-Path $configRoot "skills/dev-plan"
    $serenaRoot = Join-Path $stagingRoot "serena"
    New-Item -ItemType Directory -Force -Path $grillSkill, $devPlanSkill, $serenaRoot | Out-Null

    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "bundle-v2/opencode.json") -Destination (Join-Path $configRoot "opencode.json")
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "bundle-v2/derive-runtime-auth.mjs") -Destination (Join-Path $stagingRoot "derive-runtime-auth.mjs")
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "skills/grill-me/SKILL.md") -Destination (Join-Path $grillSkill "SKILL.md")
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "skills/dev-plan/SKILL.md") -Destination (Join-Path $devPlanSkill "SKILL.md")
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "serena_config.yml") -Destination (Join-Path $serenaRoot "serena_config.yml")

    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Force
    }
    tar -czf $OutputPath -C $stagingRoot .
    if ($LASTEXITCODE -ne 0) {
        throw "tar failed with exit code $LASTEXITCODE"
    }
    Write-Output $OutputPath
}
finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}
