# Atlas v0 Handoff

Дата: 2026-04-24

Этот файл нужен, чтобы после переустановки Windows или в новом чате быстро восстановить контекст проекта и продолжить без потери нити.

## Что строим

Atlas v0 — личная local-first оболочка в духе JARVIS:

- Windows/Desktop-first командный центр.
- Локальная память: задачи, заметки, контекст состояния, события, audit log.
- Быстрый ввод через Quick Add.
- Ask Atlas: локальный heuristic assistant с будущим provider layer под OpenAI/Anthropic/custom models.
- Безопасные действия: `safe`, `confirm`, `dangerous`; опасное не выполняется без подтверждения.
- Голосовой слой v0: UI, Web Speech API fallback и wake-word simulator; настоящий `openWakeWord`/`whisper.cpp` sidecar отложен.
- Tauri-ready scaffold есть, но native build не запускался, потому что в текущем окружении не было Rust/Cargo.

## Где проект

Исходный проект:

```text
C:\Users\milio\Documents\Codex\2026-04-24\new-chat\atlas-v0
```

Архив для переноса:

```text
C:\Users\milio\Downloads\atlas-v0-handoff-2026-04-24.zip
```

## Что уже реализовано

- React/Vite/TypeScript приложение.
- Tauri v2 scaffold в `src-tauri/`.
- Dexie/IndexedDB база `atlas-v0`.
- Zustand app store.
- Сущности:
  - `Task`
  - `Area`
  - `Note`
  - `ContextSnapshot`
  - `DomainEvent`
  - `AuditEvent`
  - `Settings`
- Репозитории пишут domain events и audit events.
- Undo для последних пользовательских действий:
  - task created
  - task updated
  - task deleted
  - note created
  - context created
- Quick Add parser:
  - русский: `завтра`, `через N дней`, дни недели, `в 18`, `#теги`, `!важно`, `!срочно`
  - английский: `tomorrow`, `in N days`, weekdays, `at 18`, `#tags`
- Views:
  - Today
  - Inbox
  - Notes
  - Ask Atlas
  - Settings
- Command Palette через `Ctrl/Cmd + K`.
- Quick Add focus через `Ctrl/Cmd + N`.
- Light/Dark тема.
- Renameable assistant name.
- Prompt preview перед будущей отправкой контекста в облако.
- Voice session UI:
  - wake-word arm button
  - Web Speech API when available
  - simulator fallback
- Audit log в Settings.
- JSON export.
- Local data nuke через dangerous confirmation.

## Проверки, которые прошли

В текущем окружении использовался portable Node:

```text
C:\Users\milio\Documents\Codex\2026-04-24\new-chat\.tools\node-v24.14.0-win-x64
```

Команды:

```powershell
$nodeDir = Resolve-Path '..\.tools\node-v24.14.0-win-x64'
$env:Path = "$nodeDir;$env:Path"
& (Join-Path $nodeDir 'npm.cmd') run build
& (Join-Path $nodeDir 'npm.cmd') run test:self
```

Результат:

- `npm run build` — успешно.
- `npm run test:self` — успешно.
- Dev server запущен на `http://127.0.0.1:1420/`.
- HTTP smoke вернул `200`.

## Известные ограничения

- Rust/Cargo не были доступны, поэтому `npm run tauri dev` не проверялся.
- In-app browser smoke через Browser Use не сработал из-за `Access denied` у Node REPL.
- Реальный wake-word sidecar ещё не подключён.
- API-ключи AI-провайдеров намеренно не сохраняются в browser storage.
- OpenAI/Anthropic/custom providers пока представлены как архитектурный слой, но реальные cloud calls не включены.
- E2EE sync, VPS relay, mobile app и coding-agent слой ещё не реализованы.

## Как восстановить после переустановки

1. Распаковать архив `atlas-v0-handoff-2026-04-24.zip`.
2. Перейти в папку `atlas-v0`.
3. Установить Node.js LTS или использовать portable Node.
4. Выполнить:

```powershell
npm install
npm run build
npm run dev
```

5. Открыть:

```text
http://127.0.0.1:1420/
```

Для native desktop:

1. Установить Rust/Cargo.
2. Проверить:

```powershell
rustc --version
cargo --version
```

3. Запустить:

```powershell
npm run tauri dev
```

## Следующая разумная итерация

1. Поставить нормальный toolchain после переустановки:
   - Node.js LTS
   - Git
   - Rust/Cargo
   - WebView2 Runtime, если Tauri попросит
2. Проверить `npm run tauri dev`.
3. Разнести UI на компоненты, потому что `src/App.tsx` уже стал большим.
4. Подключить реальный provider bridge:
   - хранить ключи только через Tauri native secure storage/vault;
   - не класть ключи в IndexedDB/localStorage;
   - делать prompt preview перед каждым облачным запросом.
5. Сделать настоящий voice sidecar:
   - `openWakeWord` для локального wake-word;
   - `whisper.cpp` для STT;
   - main app принимает только transcript/events, sidecar ничего не выполняет.
6. Добавить Playwright/Vitest тесты:
   - Quick Add
   - persistence
   - action confirmation
   - undo
   - offline smoke
7. Начать `docs/ARCHITECTURE.md` и расширить `docs/DECISIONS.md`.

## Важные файлы

```text
README.md
ATLAS_HANDOFF.md
docs/DECISIONS.md
sidecars/voice/README.md
src/App.tsx
src/types.ts
src/lib/date.ts
src/data/db.ts
src/data/repositories.ts
src/assistant/providers.ts
src/state/appStore.ts
src-tauri/tauri.conf.json
src-tauri/capabilities/default.json
```

## Что сказать новому Codex/ассистенту

Можно начать новый чат так:

```text
Я продолжаю проект Atlas v0. В архиве есть ATLAS_HANDOFF.md и LIFE_OS_SPEC.md.
Сначала прочитай ATLAS_HANDOFF.md, README.md, docs/DECISIONS.md и src/App.tsx.
Нужно продолжить с проверки Tauri native build после установки Node/Rust/Git, затем разнести App.tsx на компоненты и подключить безопасный provider bridge.
```

## Принцип проекта

Не строить “своего Claude” с нуля сейчас. Строить свою агентную оболочку: память, интерфейс, права доступа, локальность, голос, команды, аудит и сменяемые AI-модели. Собственный AI/локальные модели — будущая R&D-ветка.
