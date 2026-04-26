[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Task,

  [ValidateSet("work", "plan", "review")]
  [string]$Mode = "work",

  [string[]]$Files = @(),

  [string]$Model = "gpt-5.5",

  [string]$BusRoot,

  [switch]$FullPcAccess
)

$ErrorActionPreference = "Stop"

function ConvertTo-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9-]+", "-"
  $slug = $slug.Trim("-")
  $slug = $slug -replace "-{2,}", "-"
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "codex-task"
  }
  return $slug
}

function Resolve-CodexCli {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\OpenAI\Codex\bin\codex.exe"),
    "codex.exe",
    "codex"
  )

  foreach ($candidate in $candidates) {
    try {
      $command = Get-Command $candidate -ErrorAction Stop
      $path = $command.Source
      & $path --version *> $null
      if ($LASTEXITCODE -eq 0) {
        return $path
      }
    }
    catch {
      continue
    }
  }

  throw "No callable Codex CLI found. WindowsApps alias may be blocked; install or expose a callable codex.exe."
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

$taskOutput = & (Join-Path $PSScriptRoot "Start-AgentTask.ps1") -Agent codex -Name $Name -Task $Task -Mode $Mode -Files $Files -NoLaunch 2>&1
$taskOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create Codex task worktree."
}

$branch = (($taskOutput | Where-Object { $_ -match '^BRANCH=' } | Select-Object -First 1).ToString()).Substring(7)
$worktree = (($taskOutput | Where-Object { $_ -match '^WORKTREE=' } | Select-Object -First 1).ToString()).Substring(9)
$taskFile = (($taskOutput | Where-Object { $_ -match '^TASK_FILE=' } | Select-Object -First 1).ToString()).Substring(10)
$codexCli = Resolve-CodexCli

$runId = "$(Get-Date -Format "yyyyMMdd-HHmmss")-$(ConvertTo-Slug $Name)"
$runDir = Join-Path $runRoot $runId
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$logPath = Join-Path $runDir "codex.log"
$reportPath = Join-Path $runDir "codex-report.txt"
$metadataPath = Join-Path $runDir "run.json"
$runnerPath = Join-Path $runDir "run-codex.ps1"
$promptPath = Join-Path $runDir "prompt.txt"
$eventsPath = Join-Path $BusRoot "events.log"

$ownedFiles = if ($Files.Count -gt 0) { ($Files | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { "- No fixed file list. Keep edits narrow and report every changed file." }
$prompt = @"
You are a Codex background worker for Atlas Dev Hub.

The main Codex chat remains the lead developer and final integrator. Your job is to execute this bounded task in your own worktree, or provide a focused review when Mode is review.

Read these files first:
- TASK.md
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
- Do not run destructive git commands.
- If this is a work task, run relevant checks before finishing. For app code, run npm run build and npm run test:self.
- If you changed files and the result is ready for review, commit them on this branch with a concise message.
- Before finishing, append a short status note to $BusRoot\events.log.
- Write a final report with Summary, Changed files, Tests run, Risks or follow-up.
"@
Set-Content -LiteralPath $promptPath -Value $prompt -Encoding UTF8

$sandbox = if ($Mode -in @("plan", "review")) {
  "read-only"
}
elseif ($FullPcAccess) {
  "danger-full-access"
}
else {
  "workspace-write"
}
$addDirLine = if ($FullPcAccess) { "`$addDirs = @(`"$BusRoot`", `"$pcAccessRoot`")" } else { "`$addDirs = @(`"$BusRoot`")" }

$runner = @"
`$ErrorActionPreference = "Continue"
Set-Location -LiteralPath "$worktree"
`$env:PATH = "`$env:USERPROFILE\.cargo\bin;`$env:PATH"
"STARTED $(Get-Date -Format o)" | Tee-Object -FilePath "$logPath" -Append
"WORKTREE $worktree" | Tee-Object -FilePath "$logPath" -Append
"BRANCH $branch" | Tee-Object -FilePath "$logPath" -Append
"CODEX_CLI $codexCli" | Tee-Object -FilePath "$logPath" -Append
$addDirLine
`$promptText = Get-Content -LiteralPath "$promptPath" -Raw
`$codexArgs = @("exec", "-C", "$worktree", "-s", "$sandbox", "-m", "$Model", "-o", "$reportPath")
foreach (`$dir in `$addDirs) {
  `$codexArgs += @("--add-dir", `$dir)
}
`$codexArgs += "-"
`$promptText | & "$codexCli" @codexArgs *>&1 | Tee-Object -FilePath "$logPath" -Append
`$exitCode = `$LASTEXITCODE
"[$(Get-Date -Format o)] CODEX_RUN_FINISHED $runId exit=`$exitCode branch=$branch" | Add-Content -LiteralPath "$eventsPath"
"EXIT_CODE `$exitCode" | Tee-Object -FilePath "$logPath" -Append
"FINISHED $(Get-Date -Format o)" | Tee-Object -FilePath "$logPath" -Append
exit `$exitCode
"@
Set-Content -LiteralPath $runnerPath -Value $runner -Encoding UTF8

$process = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runnerPath) -WorkingDirectory $worktree -PassThru -WindowStyle Hidden

$metadata = [ordered]@{
  runId = $runId
  agent = "codex"
  name = $Name
  mode = $Mode
  branch = $branch
  worktree = $worktree
  busRoot = $BusRoot
  taskFile = $taskFile
  promptFile = $promptPath
  log = $logPath
  report = $reportPath
  events = $eventsPath
  pid = $process.Id
  model = $Model
  fullPcAccess = [bool]$FullPcAccess
  codexCli = $codexCli
  createdAt = (Get-Date -Format o)
}
ConvertTo-JsonFile -Value $metadata -Path $metadataPath

Write-Output "RUN_ID=$runId"
Write-Output "PID=$($process.Id)"
Write-Output "BRANCH=$branch"
Write-Output "WORKTREE=$worktree"
Write-Output "LOG=$logPath"
Write-Output "REPORT=$reportPath"
Write-Output "CODEX_CLI=$codexCli"
