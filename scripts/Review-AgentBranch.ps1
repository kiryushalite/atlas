[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Branch
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

git -C $repoRoot rev-parse --verify $Branch | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Branch not found: $Branch"
}

Write-Host "== Branch =="
Write-Host $Branch

Write-Host ""
Write-Host "== Changed files =="
git -C $repoRoot diff --name-status "main...$Branch"

Write-Host ""
Write-Host "== Diff stat =="
git -C $repoRoot diff --stat "main...$Branch"

Write-Host ""
Write-Host "== Commits =="
git -C $repoRoot log --oneline "main..$Branch"
