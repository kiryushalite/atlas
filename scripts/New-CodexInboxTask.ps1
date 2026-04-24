[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Task,

  [string[]]$Files = @(),

  [string]$BusRoot
)

$ErrorActionPreference = "Stop"

function ConvertTo-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9._-]+", "-"
  $slug = $slug.Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "codex-task"
  }
  return $slug
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$defaultBusRoot = Join-Path (Split-Path $repoRoot -Parent) "atlas-v0-agent-bus"
if ([string]::IsNullOrWhiteSpace($BusRoot)) {
  $BusRoot = $defaultBusRoot
}

$inbox = Join-Path $BusRoot "codex-inbox"
New-Item -ItemType Directory -Path $inbox -Force | Out-Null

$taskOutput = & (Join-Path $PSScriptRoot "Start-AgentTask.ps1") -Agent codex -Name $Name -Task $Task -Files $Files -NoLaunch 2>&1
$taskOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create Codex task worktree."
}

$branch = (($taskOutput | Where-Object { $_ -match '^BRANCH=' } | Select-Object -First 1).ToString()).Substring(7)
$worktree = (($taskOutput | Where-Object { $_ -match '^WORKTREE=' } | Select-Object -First 1).ToString()).Substring(9)
$taskFile = (($taskOutput | Where-Object { $_ -match '^TASK_FILE=' } | Select-Object -First 1).ToString()).Substring(10)

$taskId = "$(Get-Date -Format "yyyyMMdd-HHmmss")-$(ConvertTo-Slug $Name)"
$inboxFile = Join-Path $inbox "$taskId.md"
$ownedFiles = if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { "- Not specified; keep edits narrow and report changed files." }

$content = @"
# Codex Inbox Task

Task ID: $taskId
Branch: $branch
Worktree: $worktree
Task file: $taskFile
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")

## Goal

$Task

## Owned Files Or Scope

$ownedFiles

## Instructions For Codex

- Read `TASK.md`, `AGENTS.md`, and `docs/AGENT_ORCHESTRATION.md` from the worktree.
- Work only in the listed worktree.
- Commit changes on the listed branch when ready for review.
- Append a short status note to `$BusRoot\events.log`.
"@

Set-Content -LiteralPath $inboxFile -Value $content -Encoding UTF8
Add-Content -LiteralPath (Join-Path $BusRoot "events.log") -Value "[$(Get-Date -Format o)] CODEX_TASK_CREATED $taskId branch=$branch"

Write-Output "CODEX_TASK_ID=$taskId"
Write-Output "CODEX_INBOX_FILE=$inboxFile"
Write-Output "BRANCH=$branch"
Write-Output "WORKTREE=$worktree"
Write-Output "TASK_FILE=$taskFile"
