# Voice Sidecar Contract

v0 ships with a browser speech fallback and wake-word simulator. The production sidecar should expose this contract to the Tauri app:

```ts
interface VoiceEvent {
  kind: 'wake.detected' | 'speech.final' | 'speech.error' | 'session.ended';
  sessionId: string;
  text?: string;
  confidence?: number;
  at: string;
}
```

Recommended future stack:

- Wake-word: `openWakeWord`, local-only.
- STT: `whisper.cpp`, local-only by default.
- TTS: Windows system voice first, replaceable later.
- Transport: Tauri sidecar stdout JSON lines or localhost loopback with signed session tokens.

Security rules:

- The sidecar never executes actions.
- The sidecar only emits transcripts/events.
- The main app turns transcripts into `ToolAction` values and applies confirmation rules.
- Recording/listening state must always be visible in UI.
