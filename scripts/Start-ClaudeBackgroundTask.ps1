[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Task,

  [ValidateSet("work", "plan", "review")]
  [string]$Mode = "work",

  [string[]]$Files = @(),

  [ValidateSet("acceptEdits", "bypassPermissions", "default", "dontAsk", "auto", "plan")]
  [string]$PermissionMode = "bypassPermissions",

  [string]$Model = "sonnet",

  [decimal]$MaxBudgetUsd = 5.00,

  [string]$BusRoot,

  [switch]$FullPcAccess
)

$ErrorActionPreference = "Stop"

function ConvertTo-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9._-]+", "-"
  $slug = $slug.Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "claude-task"
  }
  return $slug
}

function ConvertTo-JsonFile {
  param(
    [Parameter(Mandatory = $true)] [object]$Value,
    [Parameter(Mandatory = $true)] [string]$Path
  )
  $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pcAccessRoot = "$($env:SystemDrive)\"
$defaultBusRoot = Join-Path (Split-Path $repoRoot -Parent) "atlas-v0-agent-bus"
if ([string]::IsNullOrWhiteSpace($BusRoot)) {
  $BusRoot = $defaultBusRoot
}
New-Item -ItemType Directory -Path $BusRoot -Force | Out-Null

$runRoot = Join-Path $repoRoot ".agent-runs"
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

$taskOutput = & (Join-Path $PSScriptRoot "Start-AgentTask.ps1") -Agent claude -Name $Name -Task $Task -Mode $Mode -Files $Files -NoLaunch 2>&1
$taskOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create Claude task worktree."
}

$branch = (($taskOutput | Where-Object { $_ -match '^BRANCH=' } | Select-Object -First 1).ToString()).Substring(7)
$worktree = (($taskOutput | Where-Object { $_ -match '^WORKTREE=' } | Select-Object -First 1).ToString()).Substring(9)
$taskFile = (($taskOutput | Where-Object { $_ -match '^TASK_FILE=' } | Select-Object -First 1).ToString()).Substring(10)

$runId = "$(Get-Date -Format "yyyyMMdd-HHmmss")-$(ConvertTo-Slug $Name)"
$runDir = Join-Path $runRoot $runId
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$logPath = Join-Path $runDir "claude.log"
$reportPath = Join-Path $runDir "claude-report.txt"
$metadataPath = Join-Path $runDir "run.json"
$runnerPath = Join-Path $runDir "run-claude.ps1"
$promptPath = Join-Path $runDir "prompt.txt"

$ownedFiles = if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { "- No fixed file list. Keep edits narrow and report every changed file." }
$prompt = @"
You are Claude Code working as a background worker for Atlas v0.

Read these files first:
- TASK.md
- CLAUDE.md
- AGENTS.md
- docs/AGENT_ORCHESTRATION.md
- $BusRoot\shared-context.md when it exists

Task:
$Task

Mode:
$Mode

Owned files or scope:
$ownedFiles

Rules:
- Work only in this worktree: $worktree
- Stay on this branch: $branch
- Use this shared agent bus for coordination notes: $BusRoot
- Full PC access is enabled: $FullPcAccess. You may inspect $pcAccessRoot when needed, but do not modify files outside the worktree or agent bus unless the task explicitly asks for that.
- Do not merge to main.
- Do not edit outside the requested scope unless absolutely necessary; report any scope expansion.
- Do not run destructive git commands.
- Keep API keys out of browser storage, committed files, and logs.
- If this is a work task, run relevant checks before finishing. For app code, run npm run build and npm run test:self.
- If you changed files and the result is ready for review, commit them on this branch with a concise message.
- Before finishing, append a short status note to $BusRoot\events.log.
- Write a final report with Summary, Changed files, Tests run, Risks or follow-up.
"@
Set-Content -LiteralPath $promptPath -Value $prompt -Encoding UTF8

$runner = @"
`$ErrorActionPreference = "Continue"
Set-Location -LiteralPath "$worktree"
`$env:PATH = "`$env:USERPROFILE\.cargo\bin;`$env:PATH"
"STARTED $(Get-Date -Format o)" | Tee-Object -FilePath "$logPath" -Append
"WORKTREE $worktree" | Tee-Object -FilePath "$logPath" -Append
"BRANCH $branch" | Tee-Object -FilePath "$logPath" -Append
`$promptText = Get-Content -LiteralPath "$promptPath" -Raw
`$addDirs = @("$worktree", "$BusRoot")
if ("$FullPcAccess" -eq "True") { `$addDirs += "$pcAccessRoot" }
`$promptText | claude --add-dir `$addDirs --print --input-format text --model "$Model" --permission-mode "$PermissionMode" --max-budget-usd "$MaxBudgetUsd" *>&1 | Tee-Object -FilePath "$logPath" -Append | Tee-Object -FilePath "$reportPath"
`$exitCode = `$LASTEXITCODE
"EXIT_CODE `$exitCode" | Tee-Object -FilePath "$logPath" -Append
"FINISHED $(Get-Date -Format o)" | Tee-Object -FilePath "$logPath" -Append
exit `$exitCode
"@
Set-Content -LiteralPath $runnerPath -Value $runner -Encoding UTF8

$process = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runnerPath) -WorkingDirectory $worktree -PassThru -WindowStyle Hidden

$metadata = [ordered]@{
  runId = $runId
  agent = "claude"
  name = $Name
  mode = $Mode
  branch = $branch
  worktree = $worktree
  busRoot = $BusRoot
  taskFile = $taskFile
  promptFile = $promptPath
  log = $logPath
  report = $reportPath
  pid = $process.Id
  permissionMode = $PermissionMode
  fullPcAccess = [bool]$FullPcAccess
  model = $Model
  maxBudgetUsd = $MaxBudgetUsd
  createdAt = (Get-Date -Format o)
}
ConvertTo-JsonFile -Value $metadata -Path $metadataPath

Write-Output "RUN_ID=$runId"
Write-Output "PID=$($process.Id)"
Write-Output "BRANCH=$branch"
Write-Output "WORKTREE=$worktree"
Write-Output "LOG=$logPath"
Write-Output "REPORT=$reportPath"
