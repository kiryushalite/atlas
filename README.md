# Atlas v0

Local-first personal assistant shell: tasks, notes, context, Ask Atlas, command safety, audit log, undo, and a voice-session contract ready for a real wake-word sidecar.

## Run

This Codex workspace uses a portable Node runtime under `../.tools/node-v24.14.0-win-x64`.

```powershell
$nodeDir = Resolve-Path '..\.tools\node-v24.14.0-win-x64'
$env:Path = "$nodeDir;$env:Path"
npm run dev
```

Open the Vite URL printed by the terminal, usually `http://127.0.0.1:1420`.

In this workspace, call `npm.cmd` explicitly if PowerShell blocks `npm.ps1`:

```powershell
& (Join-Path $nodeDir 'npm.cmd') run dev
```

## Build

```powershell
$nodeDir = Resolve-Path '..\.tools\node-v24.14.0-win-x64'
$env:Path = "$nodeDir;$env:Path"
npm run build
```

## Desktop Packaging

The `src-tauri/` scaffold is present. To run the native app later, install Rust/Cargo and run:

```powershell
npm run tauri dev
```

## What Works Now

- Quick Add with Russian/English date parsing.
- Today and Inbox task views.
- Notes and context snapshots.
- Local Ask Atlas heuristic answer with prompt preview.
- Proposed tool actions that require confirmation.
- Undo for recent user-created/updated/deleted records.
- Audit log for executed, confirmed, cancelled, and blocked actions.
- Light/dark themes and renameable assistant.
- Voice-session UI with Web Speech API when available and a wake-word simulator fallback.

## What Is Intentionally Deferred

- Real `openWakeWord` sidecar.
- Secure native vault for provider API keys.
- Actual cloud model calls through a Tauri native bridge.
- E2EE sync via VPS.
- Mobile client and coding-agent layer.
