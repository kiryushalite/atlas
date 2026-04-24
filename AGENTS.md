# Atlas v0 Agent Rules

These rules apply to Codex, Claude Code, and any other coding agent working on Atlas.

Coordination:

- `main` is the stable integration branch.
- Each task gets its own branch and git worktree under `../atlas-v0-worktrees/`.
- Give parallel agents disjoint ownership of files whenever possible.
- Merge one branch at a time after review and tests.
- If two tasks must touch the same file, choose one owner and make the other task read-only for that file.

Project checks:

- Web checks: `npm run build` and `npm run test:self`.
- Browser smoke: `http://127.0.0.1:1420/` should return HTTP 200 when Vite is running.
- Desktop check: `npm run tauri dev`.

Safety:

- Do not store provider API keys in browser storage or committed files.
- Dangerous local actions must stay behind explicit confirmation in the UI.
- Do not rewrite unrelated code while implementing a task.
