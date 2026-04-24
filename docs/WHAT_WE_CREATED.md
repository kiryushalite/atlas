# What We Created

## Restored Atlas

- `atlas-v0/` - restored product app from the backup archive.
- `Start Atlas Web.cmd` - opens Atlas through Vite at `http://127.0.0.1:1420/`.
- `Start Atlas Desktop.cmd` - starts Atlas through Tauri dev mode.
- `src-tauri/icons/icon.ico` - minimal required Windows icon so Tauri can build/run.

Purpose: make Atlas runnable again as the product we are building.

## Git Safety Layer

- Git repository on `main` - stable integration baseline.
- `../atlas-v0-worktrees/` - separate work folders for each agent task.
- `AGENTS.md` - shared rules for all agents.
- `CLAUDE.md` - Claude-specific working rules.

Purpose: let multiple agents work without editing the same files in the same folder.

## Agent Scripts

- `scripts/Start-AgentTask.ps1` - creates a branch, worktree, and `TASK.md`.
- `scripts/Start-ClaudeBackgroundTask.ps1` - launches Claude Code as a background worker.
- `scripts/Start-CodexBackgroundTask.ps1` - launches Codex CLI as a background worker.
- `scripts/New-CodexInboxTask.ps1` - fallback bridge when Codex CLI is unavailable.
- `scripts/Get-AgentStatus.ps1` - shows main status, worktrees, branches, and agent runs.
- `scripts/Watch-AgentRun.ps1` - reads any agent run log.
- `scripts/Watch-ClaudeRun.ps1` - compatibility wrapper around `Watch-AgentRun.ps1`.
- `scripts/Review-AgentBranch.ps1` - shows changed files, diff stat, and commits.
- `scripts/Merge-AgentBranch.ps1` - merges reviewed branches into `main`.

Purpose: provide the backend behavior that Dev Hub will later call from an app UI.

## One-Window Prototype

- `Atlas Agent Console.cmd` - temporary command-window UI.
- `scripts/Atlas-AgentConsole.ps1` - interactive console with `claude`, `codex`, `both`, `status`, `watch`, `review`, `merge`, `shell`.
- Desktop shortcut: `C:\Users\yu9lite\Desktop\Atlas Agent Console.lnk`.

Purpose: usable prototype while the real Dev Hub app is not built yet.

## Shared Agent Bus

- `../atlas-v0-agent-bus/shared-context.md` - shared context for all agents.
- `../atlas-v0-agent-bus/events.log` - shared event stream.
- `../atlas-v0-agent-bus/codex-inbox/` - fallback Codex task inbox.
- `../atlas-v0-agent-bus/notes/` - review notes, including Claude architecture feedback.

Purpose: one coordination space that Codex, Claude, and future research agents can read/write.

## Roadmap Docs

- `docs/AGENT_ORCHESTRATION.md` - how the current orchestration works.
- `docs/DEV_HUB_ROADMAP.md` - priority path toward the separate Dev Hub app.
- `docs/WHAT_WE_CREATED.md` - this inventory.

Purpose: keep the project understandable when we come back later.
