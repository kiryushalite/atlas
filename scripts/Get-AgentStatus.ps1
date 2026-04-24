[CmdletBinding()]
param()

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

Write-Host "== Main =="
Invoke-Git @("-C", $repoRoot, "status", "--short", "--branch")

Write-Host ""
Write-Host "== Worktrees =="
Invoke-Git @("-C", $repoRoot, "worktree", "list")

Write-Host ""
Write-Host "== Agent Branches =="
$branches = Invoke-GitOutput @("-C", $repoRoot, "branch", "--list", "agent/*")
if ($branches) {
  $branches | ForEach-Object { Write-Host $_ }
}
else {
  Write-Host "No agent branches."
}
