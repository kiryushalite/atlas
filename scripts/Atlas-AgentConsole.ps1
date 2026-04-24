[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$busRoot = Join-Path (Split-Path $repoRoot -Parent) "atlas-v0-agent-bus"
$sharedContext = Join-Path $busRoot "shared-context.md"
$eventsLog = Join-Path $busRoot "events.log"

New-Item -ItemType Directory -Path $busRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $busRoot "codex-inbox") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $busRoot "notes") -Force | Out-Null

if (-not (Test-Path -LiteralPath $sharedContext)) {
  Set-Content -LiteralPath $sharedContext -Encoding UTF8 -Value @"
# Atlas Agent Bus

This is the shared coordination space for Codex, Claude Code, and the user.

Rules:
- Main stays stable.
- Agents work in separate git worktrees.
- Merge one reviewed branch at a time.
- Keep secrets out of files and logs.
"@
}
if (-not (Test-Path -LiteralPath $eventsLog)) {
  Set-Content -LiteralPath $eventsLog -Encoding UTF8 -Value "[$(Get-Date -Format o)] BUS_CREATED $busRoot"
}

function Write-Event {
  param([string]$Message)
  Add-Content -LiteralPath $eventsLog -Value "[$(Get-Date -Format o)] $Message"
}

function Read-Multiline {
  param([string]$Title)
  Write-Host $Title
  Write-Host "Finish with an empty line."
  $lines = New-Object System.Collections.Generic.List[string]
  while ($true) {
    $line = Read-Host ">"
    if ([string]::IsNullOrWhiteSpace($line)) { break }
    $lines.Add($line)
  }
  return ($lines -join [Environment]::NewLine)
}

function Show-Help {
  Write-Host ""
  Write-Host "Atlas Agent Console"
  Write-Host ""
  Write-Host "Commands:"
  Write-Host "  help       Show this help"
  Write-Host "  claude     Create a background Claude Code task"
  Write-Host "  codex      Create a background Codex CLI task"
  Write-Host "  both       Split work into one Claude task and one Codex task"
  Write-Host "  status     Show main branch, worktrees, agent branches, Claude runs"
  Write-Host "  watch      Show a Claude run log"
  Write-Host "  review     Review an agent branch"
  Write-Host "  merge      Merge a reviewed branch into main"
  Write-Host "  bus        Open the shared agent bus folder"
  Write-Host "  context    Open shared-context.md"
  Write-Host "  events     Show recent bus events"
  Write-Host "  shell      Run a PowerShell command from this console"
  Write-Host "  exit       Close console"
  Write-Host ""
}

function New-ClaudeTask {
  $name = Read-Host "Task name"
  $task = Read-Multiline "Claude task"
  if ([string]::IsNullOrWhiteSpace($task)) {
    Write-Host "No task text."
    return
  }
  & (Join-Path $PSScriptRoot "Start-ClaudeBackgroundTask.ps1") -Name $name -Task $task -BusRoot $busRoot -FullPcAccess
}

function New-CodexTask {
  $name = Read-Host "Task name"
  $task = Read-Multiline "Codex task"
  if ([string]::IsNullOrWhiteSpace($task)) {
    Write-Host "No task text."
    return
  }
  try {
    & (Join-Path $PSScriptRoot "Start-CodexBackgroundTask.ps1") -Name $name -Task $task -BusRoot $busRoot -FullPcAccess
  }
  catch {
    Write-Host "Direct Codex worker failed: $($_.Exception.Message)"
    Write-Host "Falling back to Codex inbox bridge."
    & (Join-Path $PSScriptRoot "New-CodexInboxTask.ps1") -Name $name -Task $task -BusRoot $busRoot
  }
}

function New-BothTasks {
  $baseName = Read-Host "Base task name"
  $claudeTask = Read-Multiline "Claude part"
  $codexTask = Read-Multiline "Codex part"
  if (-not [string]::IsNullOrWhiteSpace($claudeTask)) {
    & (Join-Path $PSScriptRoot "Start-ClaudeBackgroundTask.ps1") -Name "$baseName-claude" -Task $claudeTask -BusRoot $busRoot -FullPcAccess
  }
  if (-not [string]::IsNullOrWhiteSpace($codexTask)) {
    try {
      & (Join-Path $PSScriptRoot "Start-CodexBackgroundTask.ps1") -Name "$baseName-codex" -Task $codexTask -BusRoot $busRoot -FullPcAccess
    }
    catch {
      Write-Host "Direct Codex worker failed: $($_.Exception.Message)"
      Write-Host "Falling back to Codex inbox bridge."
      & (Join-Path $PSScriptRoot "New-CodexInboxTask.ps1") -Name "$baseName-codex" -Task $codexTask -BusRoot $busRoot
    }
  }
}

function Watch-Run {
  $runId = Read-Host "Run ID"
  if (-not [string]::IsNullOrWhiteSpace($runId)) {
    & (Join-Path $PSScriptRoot "Watch-ClaudeRun.ps1") -RunId $runId
  }
}

function Review-Branch {
  $branch = Read-Host "Branch"
  if (-not [string]::IsNullOrWhiteSpace($branch)) {
    & (Join-Path $PSScriptRoot "Review-AgentBranch.ps1") -Branch $branch
  }
}

function Merge-Branch {
  $branch = Read-Host "Branch"
  if ([string]::IsNullOrWhiteSpace($branch)) { return }
  $runTests = Read-Host "Run tests after merge? y/N"
  if ($runTests -match "^(y|yes|д|да)$") {
    & (Join-Path $PSScriptRoot "Merge-AgentBranch.ps1") -Branch $branch -RunTests
  }
  else {
    & (Join-Path $PSScriptRoot "Merge-AgentBranch.ps1") -Branch $branch
  }
}

function Invoke-ConsoleShell {
  $command = Read-Multiline "PowerShell command"
  if ([string]::IsNullOrWhiteSpace($command)) { return }
  Write-Host ""
  Write-Host "About to run:"
  Write-Host $command
  $confirm = Read-Host "Run this command? y/N"
  if ($confirm -notmatch "^(y|yes|д|да)$") {
    Write-Host "Cancelled."
    return
  }
  Write-Event "SHELL $command"
  Invoke-Expression $command
}

function Show-Diagnostics {
  Write-Host "Repo: $repoRoot"
  Write-Host "Bus:  $busRoot"
  Write-Host ""
  Write-Host "Claude:"
  try {
    claude --version
  }
  catch {
    Write-Host "Claude not available: $($_.Exception.Message)"
  }
  Write-Host ""
  Write-Host "Codex CLI:"
  try {
    $codexPath = (Get-Command (Join-Path $env:LOCALAPPDATA "Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\OpenAI\Codex\bin\codex.exe") -ErrorAction Stop).Source
    Write-Host $codexPath
    & $codexPath --version
  }
  catch {
    Write-Host "Callable Codex CLI was not found. Inbox bridge remains available."
  }
}

Clear-Host
Write-Host "Atlas Agent Console"
Write-Host "One window for user commands, Claude background workers, Codex inbox, git worktrees, and shell access."
Write-Host "Type 'help' for commands."
Write-Host ""
Show-Diagnostics
Write-Event "CONSOLE_STARTED"

while ($true) {
  Write-Host ""
  $rawCommand = Read-Host "atlas"
  if ($null -eq $rawCommand) {
    Write-Event "CONSOLE_STDIN_CLOSED"
    break
  }
  $command = $rawCommand.Trim().ToLowerInvariant()
  try {
    switch ($command) {
      "" { continue }
      "help" { Show-Help }
      "claude" { New-ClaudeTask }
      "codex" { New-CodexTask }
      "both" { New-BothTasks }
      "status" { & (Join-Path $PSScriptRoot "Get-AgentStatus.ps1") }
      "watch" { Watch-Run }
      "review" { Review-Branch }
      "merge" { Merge-Branch }
      "bus" { Start-Process $busRoot }
      "context" { Start-Process notepad.exe $sharedContext }
      "events" { Get-Content -LiteralPath $eventsLog -Tail 40 }
      "shell" { Invoke-ConsoleShell }
      "exit" { Write-Event "CONSOLE_STOPPED"; break }
      default { Write-Host "Unknown command: $command. Type 'help'." }
    }
  }
  catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Event "ERROR $($_.Exception.Message)"
  }
}
