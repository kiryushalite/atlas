# Atlas v0 Claude Code Rules

You are working on Atlas v0, a local-first Windows desktop assistant shell.

Before changing code, read:

- `README.md`
- `ATLAS_HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/AGENT_ORCHESTRATION.md`
- `TASK.md` when present in the worktree

Rules:

- Work only in the assigned git worktree and branch.
- Do not edit files outside the task's declared scope unless you clearly report why.
- Do not run destructive git commands such as `reset --hard`, `checkout --`, or force pushes.
- Keep browser API keys out of IndexedDB, localStorage, committed files, and logs.
- Do not open `index.html` directly; use `npm run dev`, `Start Atlas Web.cmd`, or Tauri.
- Prefer small, reviewable changes with passing checks.
- Before reporting done, run `npm run build` and `npm run test:self` when the task touches app code.
- If the task touches Tauri/Rust, also run an appropriate native check such as `npm run tauri dev` or `cargo check` from `src-tauri`.

Final report format:

- Summary
- Changed files
- Tests run
- Risks or follow-up needed
