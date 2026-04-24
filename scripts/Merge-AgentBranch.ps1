[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Branch,

  [switch]$RunTests
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-GitOutput {
  param([string[]]$Arguments)
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & git @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $oldPreference
  }
  if ($exitCode -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $exitCode. $($output -join [Environment]::NewLine)"
  }
  return $output
}

function Invoke-Git {
  param([string[]]$Arguments)
  $output = Invoke-GitOutput $Arguments
  if ($output) {
    $output | ForEach-Object { Write-Host $_ }
  }
}

$dirty = Invoke-GitOutput @("-C", $repoRoot, "status", "--porcelain")
if ($dirty) {
  throw "Main worktree is dirty. Commit or stash changes before merging."
}

Invoke-Git @("-C", $repoRoot, "checkout", "main")
Invoke-Git @("-C", $repoRoot, "merge", "--no-ff", $Branch)

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
