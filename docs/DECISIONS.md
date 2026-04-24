# Decisions

## 001. Build a useful local app before full native packaging

Windows has no Rust/Cargo available in this workspace, so v0 ships as a Vite/React app with a Tauri-ready scaffold. The product remains desktop-oriented, but the first verification target is the webview UI and local data layer.

## 002. Keep cloud model calls behind a future native bridge

Provider selection exists, but browser-side API key storage/calls are intentionally blocked. API keys should live in a Tauri secure vault/native layer, not in IndexedDB or localStorage.

## 003. Voice v0 uses a stable contract, not a fake promise

Wake-word is represented in the UI and simulator, and Web Speech API is used when available. The sidecar contract is isolated so `openWakeWord` + `whisper.cpp` can replace the v0 layer without changing command safety or action confirmation.

## 004. Every mutation writes domain and audit events

Tasks, notes, context, settings, undo, and proposed actions are logged. This supports the current undo/audit needs and leaves room for future sync/conflict handling.

## 005. Dangerous actions require confirmation

Voice-created actions, deletes, and destructive data operations are never executed directly. The user sees payload and risk before confirmation.
