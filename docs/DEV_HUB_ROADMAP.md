# Atlas Dev Hub Roadmap

Atlas Dev Hub is a separate developer-orchestration app. Atlas remains the product being developed.

## P0 - Make Codex A First-Class Worker

Why: Codex is the lead developer and final integrator. If Codex can only participate through the current chat, the Dev Hub is not complete.

Current status:

- The WindowsApps alias is blocked from PowerShell with `Access is denied`.
- A callable Codex CLI exists at:

  ```text
  C:\Users\yu9lite\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\OpenAI\Codex\bin\codex.exe
  ```

- It reports `codex-cli 0.124.0-alpha.2` and supports `codex exec`.
- `scripts/Start-CodexBackgroundTask.ps1` starts Codex CLI workers in isolated worktrees.
- Smoke test proved read-only background execution works and produces a final report.

Acceptance criteria:

- Dev Hub can start Codex workers directly, not only create inbox files. Done in script prototype.
- Codex workers run in isolated git worktrees. Done in script prototype.
- Codex workers write logs and final reports into `.agent-runs/<run-id>/`. Done in script prototype.
- Review and plan tasks run read-only. Done in script prototype.
- Work tasks can run with full access only inside explicit worktree/bus boundaries.
- The main Codex chat remains lead developer and decides merges.

Remaining P0 work:

- Move the script prototype into the separate Dev Hub Tauri app.
- Handle Codex sandbox ownership warnings cleanly.
- Keep the inbox fallback for machines where the callable LocalCache CLI path is absent.

## P1 - Turn Console Prototype Into A Dev App

- Create separate `atlas-dev-hub` Tauri app next to `atlas-v0`.
- Move the current PowerShell backend into a proper native command layer.
- Show agents, tasks, branches, logs, tests, diffs, and merge state in one UI.
- Keep Atlas untouched as the product app.

## P2 - Add Research Providers

- Perplexity: current web research and source-backed answers.
- Kimi: long-context analysis and second-opinion implementation/review.
- Store provider keys outside repo files and logs.

## P3 - Hardening

- Redact secrets from logs.
- Replace shared `events.log` appends with one-file-per-event or a locked writer.
- Add kill/retry controls for long-running agent jobs.
- Enforce declared file ownership before merge.
