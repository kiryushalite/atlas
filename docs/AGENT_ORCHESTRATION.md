# Agent Orchestration

Atlas should be developed through isolated git worktrees so Codex and Claude Code can work in parallel without stepping on each other.

## Daily Flow

1. Keep `main` as the clean baseline.
2. Create one worktree per task:

   ```powershell
   .\scripts\Start-AgentTask.ps1 -Agent claude -Name "task-editor" -Task "Build a task editor modal. Own src/App.tsx only if needed; prefer new components."
   ```

3. Give each agent a narrow scope and owned files.
4. Review each branch separately:

   ```powershell
   .\scripts\Review-AgentBranch.ps1 -Branch agent/claude/20260425-031500-task-editor
   ```

5. Check the whole agent board:

   ```powershell
   .\scripts\Get-AgentStatus.ps1
   ```

6. Merge only after checks pass:

   ```powershell
   .\scripts\Merge-AgentBranch.ps1 -Branch agent/claude/20260425-031500-task-editor -RunTests
   ```

## Task Shape

Every task should include:

- Goal
- Owned files or subsystem
- Out of scope
- Required checks
- Expected final report

## Parallel Safety

- Good split: Claude works on `src/components/*`, Codex works on `src/data/*`.
- Risky split: both agents edit `src/App.tsx`.
- If shared files are unavoidable, sequence the tasks instead of running them in parallel.

## Claude Code Modes

Interactive Claude worker:

```powershell
.\scripts\Start-AgentTask.ps1 -Agent claude -Name "notes-search" -Task "Add local notes search."
```

Headless Claude worker, useful when Codex is orchestrating:

```powershell
.\scripts\Start-AgentTask.ps1 -Agent claude -Name "notes-search" -Task "Add local notes search." -Headless
```

Plan-only Claude branch:

```powershell
.\scripts\Start-AgentTask.ps1 -Agent claude -Mode plan -Name "provider-bridge-plan" -Task "Plan the secure provider bridge; do not edit app code."
```

## Codex Branches

For Codex work, create a branch/worktree but do not launch Claude:

```powershell
.\scripts\Start-AgentTask.ps1 -Agent codex -Name "quick-add-tests" -Task "Add focused tests for Quick Add parsing." -NoLaunch
```

Then point Codex at the printed worktree path.
