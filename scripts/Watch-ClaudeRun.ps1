[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RunId,

  [int]$Tail = 80,

  [switch]$Wait
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runDir = Join-Path (Join-Path $repoRoot ".agent-runs") $RunId
$metadataPath = Join-Path $runDir "run.json"

if (-not (Test-Path -LiteralPath $metadataPath)) {
  throw "Run not found: $RunId"
}

$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$isRunning = $false
if ($metadata.pid) {
  $isRunning = [bool](Get-Process -Id $metadata.pid -ErrorAction SilentlyContinue)
}

Write-Host "RUN_ID=$($metadata.runId)"
Write-Host "BRANCH=$($metadata.branch)"
Write-Host "WORKTREE=$($metadata.worktree)"
Write-Host "PID=$($metadata.pid)"
Write-Host "RUNNING=$isRunning"
Write-Host "LOG=$($metadata.log)"
Write-Host ""

if ($Wait) {
  Get-Content -LiteralPath $metadata.log -Tail $Tail -Wait -ErrorAction SilentlyContinue
}
else {
  Get-Content -LiteralPath $metadata.log -Tail $Tail -ErrorAction SilentlyContinue
}
