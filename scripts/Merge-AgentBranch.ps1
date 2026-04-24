[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Branch,

  [switch]$RunTests
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$dirty = git -C $repoRoot status --porcelain
if ($dirty) {
  throw "Main worktree is dirty. Commit or stash changes before merging."
}

git -C $repoRoot checkout main
git -C $repoRoot merge --no-ff $Branch

if ($RunTests) {
  Push-Location $repoRoot
  try {
    npm run build
    npm run test:self
  }
  finally {
    Pop-Location
  }
}

Write-Host "Merged $Branch into main."
