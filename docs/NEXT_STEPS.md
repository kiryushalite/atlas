# Next Steps

## Immediate

- Install clean toolchain after Windows reinstall: Node.js LTS, Git, Rust/Cargo.
- Run `npm install`.
- Run `npm run build`.
- Run `npm run tauri dev`.
- Fix any Tauri v2 platform-specific warnings.

## Refactor

- Split `src/App.tsx` into:
  - `components/AppShell.tsx`
  - `components/Sidebar.tsx`
  - `components/TopBar.tsx`
  - `components/TaskList.tsx`
  - `components/ContextPanel.tsx`
  - `components/CommandPalette.tsx`
  - `components/ConfirmDialog.tsx`
  - `views/TodayView.tsx`
  - `views/InboxView.tsx`
  - `views/NotesView.tsx`
  - `views/AskView.tsx`
  - `views/SettingsView.tsx`

## Security

- Add a native secure vault for provider API keys.
- Keep provider calls in the Tauri/native layer.
- Preserve prompt preview before cloud calls.
- Add explicit permission registry for tool actions.

## Voice

- Add sidecar process contract.
- Test local wake-word detection.
- Add local STT.
- Keep UI indicator visible whenever listening/recording.

## Product

- Improve Quick Add date parser.
- Add task editor modal.
- Add recurring rituals.
- Add weekly review.
- Add local search across tasks/notes.
