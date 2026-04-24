[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Branch
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

Invoke-GitOutput @("-C", $repoRoot, "rev-parse", "--verify", $Branch) | Out-Null

Write-Host "== Branch =="
Write-Host $Branch

Write-Host ""
Write-Host "== Changed files =="
Invoke-Git @("-C", $repoRoot, "diff", "--name-status", "main...$Branch")

Write-Host ""
Write-Host "== Diff stat =="
Invoke-Git @("-C", $repoRoot, "diff", "--stat", "main...$Branch")

Write-Host ""
Write-Host "== Commits =="
Invoke-Git @("-C", $repoRoot, "log", "--oneline", "main..$Branch")
