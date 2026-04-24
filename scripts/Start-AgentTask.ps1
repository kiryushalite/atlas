[CmdletBinding()]
param(
  [ValidateSet("claude", "codex")]
  [string]$Agent = "claude",

  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Task,

  [ValidateSet("work", "plan", "review")]
  [string]$Mode = "work",

  [string[]]$Files = @(),

  [switch]$NoLaunch,

  [switch]$Headless
)

$ErrorActionPreference = "Stop"

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

function ConvertTo-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9._-]+", "-"
  $slug = $slug.Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "task"
  }
  return $slug
}

function Escape-SingleQuotedPowerShell {
  param([string]$Value)
  return $Value -replace "'", "''"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
try {
  $isRepo = Invoke-GitOutput @("-C", $repoRoot, "rev-parse", "--is-inside-work-tree")
}
catch {
  throw "Atlas is not a git repository yet. Run: git init -b main"
}
if (($isRepo | Select-Object -First 1).Trim() -ne "true") {
  throw "Atlas is not a git repository yet. Run: git init -b main"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$slug = ConvertTo-Slug $Name
$branch = "agent/$Agent/$timestamp-$slug"
$worktreeRoot = Join-Path (Split-Path $repoRoot -Parent) "atlas-v0-worktrees"
$worktreePath = Join-Path $worktreeRoot "$Agent-$timestamp-$slug"

New-Item -ItemType Directory -Path $worktreeRoot -Force | Out-Null

$dirty = Invoke-GitOutput @("-C", $repoRoot, "status", "--porcelain")
if ($dirty) {
  Write-Warning "Main worktree has uncommitted changes. The new task branch will start from HEAD, not from those changes."
}

Invoke-Git @("-C", $repoRoot, "worktree", "add", "-b", $branch, $worktreePath, "HEAD")

$ownedFiles = if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { "- Not specified; keep edits narrow and report changed files." }
$taskFile = Join-Path $worktreePath "TASK.md"
$taskMarkdown = @"
# Agent Task

Agent: $Agent
Mode: $Mode
Branch: $branch
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")

## Goal

$Task

## Owned Files Or Scope

$ownedFiles

## Required Rules

- Read `CLAUDE.md`, `AGENTS.md`, and `docs/AGENT_ORCHESTRATION.md`.
- Work only in this worktree.
- Do not edit unrelated files.
- Do not run destructive git commands.
- Run relevant checks before reporting done.

## Final Report

- Summary
- Changed files
- Tests run
- Risks or follow-up
"@
Set-Content -LiteralPath $taskFile -Value $taskMarkdown -Encoding UTF8

Write-Output "BRANCH=$branch"
Write-Output "WORKTREE=$worktreePath"
Write-Output "TASK_FILE=$taskFile"

if ($Agent -eq "codex") {
  Write-Host ""
  Write-Host "Codex task created. Point Codex at WORKTREE and ask it to read TASK.md."
  exit 0
}

if ($NoLaunch) {
  Write-Host ""
  Write-Host "Claude task created but not launched."
  exit 0
}

$permissionMode = if ($Mode -eq "plan") { "plan" } else { "acceptEdits" }
$claudePrompt = "Read TASK.md first, then follow CLAUDE.md and AGENTS.md. Work only in this worktree. When finished, report summary, changed files, tests, and risks."

if ($Headless) {
  $agentDir = Join-Path $worktreePath ".agent"
  New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
  $report = Join-Path $agentDir "claude-report.txt"
  Push-Location $worktreePath
  try {
    claude --print --permission-mode $permissionMode --add-dir $worktreePath $claudePrompt *>&1 | Tee-Object -FilePath $report
  }
  finally {
    Pop-Location
  }
  Write-Host "CLAUDE_REPORT=$report"
  exit $LASTEXITCODE
}

$safePath = Escape-SingleQuotedPowerShell $worktreePath
$safePrompt = Escape-SingleQuotedPowerShell $claudePrompt
$safeName = Escape-SingleQuotedPowerShell "Atlas $slug"
$command = "Set-Location -LiteralPath '$safePath'; claude --name '$safeName' --permission-mode $permissionMode --add-dir '$safePath' '$safePrompt'"
Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command)
Write-Host "Claude Code launched in a new PowerShell window."
