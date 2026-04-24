import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  FileText,
  Home,
  Inbox,
  Mic,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type { ContextSnapshot, RiskLevel, ToolAction } from './types';
import { askAssistant } from './assistant/providers';
import {
  clearAllData,
  completeTask,
  createContextSnapshot,
  createNote,
  createTaskFromQuickAdd,
  executeToolAction,
  exportSnapshot,
  initializeAtlas,
  recordAudit,
  riskCopy,
  saveSetting,
  softDeleteTask,
  undoLastUserEvent,
} from './data/repositories';
import { formatDate, isSameLocalDay, parseQuickAdd, statusOf } from './lib/date';
import { useAppStore } from './state/appStore';

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

type Toast = { text: string; action?: () => void };
type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

function runSelfTests() {
  console.assert(Boolean(parseQuickAdd('позвонить завтра в 18 #личное !важно').dueAt), 'quick-add parses Russian date');
  console.assert(Boolean(parseQuickAdd('buy milk tomorrow at 18 #home').dueAt), 'quick-add parses English date');
  console.assert(statusOf({ status: 'active', deadlineAt: '2020-01-01T00:00:00.000Z' }) === 'failed', 'deadline computes failed');
  console.assert(statusOf({ status: 'done', deadlineAt: '2020-01-01T00:00:00.000Z' }) === 'done', 'done beats failed');
}

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function riskClass(risk: RiskLevel) {
  return risk === 'dangerous' ? 'riskDanger' : risk === 'confirm' ? 'riskConfirm' : 'riskSafe';
}

export function App() {
  const {
    booted,
    view,
    theme,
    search,
    areas,
    tasks,
    notes,
    contextSnapshots,
    auditEvents,
    assistant,
    setView,
    setSearch,
    setTheme,
    refresh,
  } = useAppStore();
  const [quickAdd, setQuickAdd] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [askInput, setAskInput] = useState('Что сегодня?');
  const [askAnswer, setAskAnswer] = useState('');
  const [promptPreview, setPromptPreview] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingAction, setPendingAction] = useState<ToolAction | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [wakeArmed, setWakeArmed] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const todayTasks = useMemo(
    () => tasks.filter((task) => statusOf(task) === 'active' && (isSameLocalDay(task.dueAt) || task.priority === 'asap')),
    [tasks],
  );
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusOf(task) !== 'active') return false;
      if (!q) return true;
      return [task.title, task.note, ...task.tags].join(' ').toLowerCase().includes(q);
    });
  }, [search, tasks]);

  useEffect(() => {
    runSelfTests();
    initializeAtlas().then(refresh);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        quickAddRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setPendingAction(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  async function withRefresh(action: () => Promise<unknown>, message?: string) {
    await action();
    await refresh();
    if (message) setToast({ text: message, action: handleUndo });
  }

  async function handleQuickAdd() {
    if (!quickAdd.trim()) return;
    const text = quickAdd;
    setQuickAdd('');
    await withRefresh(() => createTaskFromQuickAdd(text), 'Задача создана');
  }

  async function handleUndo() {
    const event = await undoLastUserEvent();
    await refresh();
    setToast({ text: event ? 'Действие отменено' : 'Нечего отменять' });
    window.setTimeout(() => setToast(null), 2400);
  }

  async function ask() {
    const result = await askAssistant(askInput, { tasks, notes, contextSnapshots, settings: assistant });
    setAskAnswer(result.answer);
    setPromptPreview(result.preview);
    if (result.action) setPendingAction(result.action);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    await executeToolAction(action);
    await refresh();
    setToast({ text: `Выполнено: ${action.label}`, action: handleUndo });
  }

  async function cancelAction() {
    if (!pendingAction) return;
    await recordAudit({ kind: pendingAction.kind, label: pendingAction.label, risk: pendingAction.risk, actor: 'user', status: 'cancelled' });
    setPendingAction(null);
    await refresh();
  }

  async function saveNote() {
    if (!noteDraft.trim()) return;
    const body = noteDraft;
    setNoteDraft('');
    await withRefresh(() => createNote(body), 'Заметка создана');
  }

  async function saveContext(value: Omit<ContextSnapshot, 'id' | 'at'>) {
    await withRefresh(() => createContextSnapshot(value), 'Контекст записан');
  }

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await saveSetting('theme', next);
  }

  async function updateAssistantName(name: string) {
    await saveSetting('assistant', { ...assistant, assistantName: name || 'Atlas' });
    await refresh();
  }

  async function exportData() {
    const data = await exportSnapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function proposeVoiceAction(text: string) {
    setVoiceTranscript(text);
    setAskInput(text);
    askAssistant(text, { tasks, notes, contextSnapshots, settings: assistant }).then((result) => {
      setAskAnswer(result.answer);
      setPromptPreview(result.preview);
      if (result.action) setPendingAction(result.action);
    });
  }

  function startVoiceSession() {
    const Recognition = (window.SpeechRecognition ?? window.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;
    if (!Recognition) {
      setWakeArmed(true);
      setVoiceListening(false);
      setVoiceTranscript('SpeechRecognition недоступен в этом webview. Используй симулятор ниже.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    setVoiceListening(true);
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? '';
      proposeVoiceAction(text);
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = () => {
      setVoiceListening(false);
      setVoiceTranscript('Голосовая сессия не распозналась. Можно повторить или использовать текст.');
    };
    recognition.start();
  }

  function armWakeWord() {
    setWakeArmed(true);
    setToast({ text: `Wake-word armed: скажи "${assistant.assistantName}" или нажми симулятор` });
    window.setTimeout(() => setToast(null), 3000);
  }

  if (!booted) {
    return <div className="boot">Atlas запускает локальное ядро...</div>;
  }

  return (
    <div className="appFrame">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <Bot size={22} />
          </div>
          <div>
            <strong>{assistant.assistantName}</strong>
            <span>local command shell</span>
          </div>
        </div>
        <nav className="nav">
          <NavButton active={view === 'today'} icon={<Home size={18} />} label="Today" onClick={() => setView('today')} />
          <NavButton active={view === 'inbox'} icon={<Inbox size={18} />} label="Inbox" onClick={() => setView('inbox')} />
          <NavButton active={view === 'notes'} icon={<FileText size={18} />} label="Notes" onClick={() => setView('notes')} />
          <NavButton active={view === 'ask'} icon={<Sparkles size={18} />} label={`Ask ${assistant.assistantName}`} onClick={() => setView('ask')} />
          <NavButton active={view === 'settings'} icon={<Settings size={18} />} label="Settings" onClick={() => setView('settings')} />
        </nav>
        <div className="sidebarPanel">
          <div className="panelHeader">Areas</div>
          {areas.map((area) => (
            <div className="areaRow" key={area.id}>
              <span className="areaDot" style={{ background: area.color }} />
              <span>{area.name}</span>
            </div>
          ))}
        </div>
        <div className="securityCard">
          <Shield size={18} />
          <div>
            <strong>Dangerous actions locked</strong>
            <span>Файлы, удаление и команды ОС идут через подтверждение.</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="quickAdd">
            <Plus size={18} />
            <input
              ref={quickAddRef}
              value={quickAdd}
              onChange={(event) => setQuickAdd(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleQuickAdd();
              }}
              placeholder="Поймать мысль: позвонить завтра в 18 #личное !важно"
            />
            <button onClick={handleQuickAdd}>Add</button>
          </div>
          <div className="topActions">
            <button className={cx('iconText', wakeArmed && 'active')} onClick={armWakeWord}>
              <Mic size={17} />
              Wake
            </button>
            <button className="iconText" onClick={() => setPaletteOpen(true)}>
              <Command size={17} />
              Cmd
            </button>
            <button className="iconOnly" aria-label="Toggle theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {view === 'today' && (
          <section className="viewGrid">
            <div className="heroBand">
              <div>
                <span className="eyebrow">Operational day</span>
                <h1>Сегодня</h1>
                <p>{todayTasks.length ? `У тебя ${todayTasks.length} актуальных фокуса. Начинай с самого маленького следующего шага.` : 'Сегодня чисто. Можно поймать первую мысль или записать контекст состояния.'}</p>
              </div>
              <button className="primary" onClick={() => setView('ask')}>
                Спросить {assistant.assistantName}
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="contentGrid">
              <div className="section">
                <SectionTitle icon={<CircleDot size={18} />} title="Today queue" />
                <TaskList tasks={todayTasks} areas={areas} onComplete={(id) => withRefresh(() => completeTask(id), 'Задача закрыта')} onDelete={(id) => setPendingAction({ id, kind: 'task.delete', label: 'Удалить задачу', risk: 'confirm', payload: { id }, requiresConfirmation: true })} />
              </div>
              <div className="section">
                <SectionTitle icon={<Activity size={18} />} title="Context" />
                <ContextPanel snapshots={contextSnapshots} onSave={saveContext} />
              </div>
            </div>
          </section>
        )}

        {view === 'inbox' && (
          <section className="viewGrid">
            <div className="toolbar">
              <div className="searchBox">
                <Search size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по задачам, тегам, заметкам" />
              </div>
              <button className="ghost" onClick={handleUndo}>
                <RotateCcw size={17} />
                Undo
              </button>
            </div>
            <div className="section">
              <SectionTitle icon={<Inbox size={18} />} title="Inbox" />
              <TaskList tasks={filteredTasks} areas={areas} onComplete={(id) => withRefresh(() => completeTask(id), 'Задача закрыта')} onDelete={(id) => setPendingAction({ id, kind: 'task.delete', label: 'Удалить задачу', risk: 'confirm', payload: { id }, requiresConfirmation: true })} />
            </div>
          </section>
        )}

        {view === 'notes' && (
          <section className="contentGrid">
            <div className="section">
              <SectionTitle icon={<FileText size={18} />} title="Новая заметка" />
              <textarea className="noteInput" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Запомни мысль, решение, идею или дневниковую запись..." />
              <button className="primary" onClick={saveNote}>Сохранить заметку</button>
            </div>
            <div className="section">
              <SectionTitle icon={<Database size={18} />} title="Память" />
              <div className="noteList">
                {notes.map((note) => (
                  <article className="noteCard" key={note.id}>
                    <strong>{note.title ?? 'Без заголовка'}</strong>
                    <p>{note.body}</p>
                    <span>{note.date}</span>
                  </article>
                ))}
                {!notes.length && <Empty text="Заметок пока нет." />}
              </div>
            </div>
          </section>
        )}

        {view === 'ask' && (
          <section className="contentGrid askGrid">
            <div className="section">
              <SectionTitle icon={<Sparkles size={18} />} title={`Ask ${assistant.assistantName}`} />
              <textarea className="askInput" value={askInput} onChange={(event) => setAskInput(event.target.value)} />
              <div className="buttonRow">
                <button className="primary" onClick={ask}>Спросить</button>
                <button className="ghost" onClick={startVoiceSession}>
                  <Mic size={17} />
                  {voiceListening ? 'Слушаю...' : 'Голосовая команда'}
                </button>
              </div>
              {voiceTranscript && <div className="transcript">Transcript: {voiceTranscript}</div>}
              {askAnswer && <div className="answer">{askAnswer}</div>}
            </div>
            <div className="section">
              <SectionTitle icon={<Shield size={18} />} title="Prompt preview" />
              <pre className="promptPreview">{promptPreview || 'Здесь появится контекст, который ушёл бы в облачную модель. В v0 ответ локальный.'}</pre>
              <div className="voiceSimulator">
                <strong>Wake-word simulator</strong>
                <button className="ghost" onClick={() => proposeVoiceAction(`создай задачу проверить ${assistant.assistantName} завтра в 18 #работа`)}>
                  Симулировать "{assistant.assistantName}"
                </button>
              </div>
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="contentGrid">
            <div className="section">
              <SectionTitle icon={<Settings size={18} />} title="Settings" />
              <label className="field">
                Имя ассистента
                <input defaultValue={assistant.assistantName} onBlur={(event) => updateAssistantName(event.target.value)} />
              </label>
              <label className="field">
                Provider
                <select
                  value={assistant.provider}
                  onChange={(event) => saveSetting('assistant', { ...assistant, provider: event.target.value }).then(refresh)}
                >
                  <option value="local">Local heuristic</option>
                  <option value="openai">OpenAI bridge (planned)</option>
                  <option value="anthropic">Anthropic bridge (planned)</option>
                  <option value="custom">Custom OpenAI-compatible bridge (planned)</option>
                </select>
              </label>
              <label className="switchRow">
                <input
                  type="checkbox"
                  checked={assistant.aiEnabled}
                  onChange={(event) => saveSetting('assistant', { ...assistant, aiEnabled: event.target.checked }).then(refresh)}
                />
                AI layer enabled
              </label>
              <div className="warning">
                API-ключи не сохраняются в webview в v0. Для настоящего облачного мозга подключим Tauri secure vault/native bridge.
              </div>
              <div className="buttonRow">
                <button className="ghost" onClick={exportData}>Экспорт JSON</button>
                <button className="danger" onClick={() => setPendingAction({ id: 'nuke', kind: 'data.nuke', label: 'Очистить локальную базу Atlas', risk: 'dangerous', payload: {}, requiresConfirmation: true })}>Nuke local data</button>
              </div>
            </div>
            <div className="section">
              <SectionTitle icon={<Shield size={18} />} title="Audit log" />
              <div className="auditList">
                {auditEvents.map((event) => (
                  <div className="auditRow" key={event.id}>
                    <span className={cx('riskPill', riskClass(event.risk))}>{event.risk}</span>
                    <span>{event.label}</span>
                    <small>{new Date(event.at).toLocaleTimeString('ru-RU')}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {paletteOpen && (
        <div className="overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette" onClick={(event) => event.stopPropagation()}>
            <div className="paletteHead">
              <Command size={18} />
              Command Palette
              <button className="iconOnly" onClick={() => setPaletteOpen(false)}><X size={18} /></button>
            </div>
            <CommandItem label="Новая задача" detail="Фокус на Quick Add" onClick={() => { setPaletteOpen(false); quickAddRef.current?.focus(); }} />
            <CommandItem label="Открыть Today" detail="Перейти к сегодняшнему дню" onClick={() => { setPaletteOpen(false); setView('today'); }} />
            <CommandItem label={`Спросить ${assistant.assistantName}`} detail="Открыть Ask view" onClick={() => { setPaletteOpen(false); setView('ask'); }} />
            <CommandItem label="Записать контекст" detail="energy 3 / mood 3" onClick={() => { setPaletteOpen(false); saveContext({ energy: 3, mood: 3, note: 'Быстрая запись из command palette' }); }} />
            <CommandItem label="Экспорт JSON" detail="Локальный файл со всеми данными" onClick={() => { setPaletteOpen(false); exportData(); }} />
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="overlay">
          <div className="confirmDialog">
            <div className={cx('riskBadge', riskClass(pendingAction.risk))}>{riskCopy(pendingAction.risk)}</div>
            <h2>{pendingAction.label}</h2>
            <p>Это действие не будет выполнено без твоего подтверждения. Оно будет записано в audit log.</p>
            <pre>{JSON.stringify(pendingAction.payload, null, 2)}</pre>
            <div className="buttonRow">
              <button className="ghost" onClick={cancelAction}>Отмена</button>
              <button
                className={pendingAction.risk === 'dangerous' ? 'danger' : 'primary'}
                onClick={() => {
                  if (pendingAction.kind === 'task.delete') {
                    const id = String(pendingAction.payload.id);
                    setPendingAction(null);
                    withRefresh(() => softDeleteTask(id), 'Задача удалена');
                    return;
                  }
                  if (pendingAction.kind === 'data.nuke') {
                    setPendingAction(null);
                    clearAllData().then(refresh);
                    return;
                  }
                  confirmAction();
                }}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.action && <button onClick={toast.action}>Undo</button>}
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={cx('navButton', active && 'active')} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="sectionTitle">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function TaskList({ tasks, areas, onComplete, onDelete }: { tasks: ReturnType<typeof useAppStore.getState>['tasks']; areas: ReturnType<typeof useAppStore.getState>['areas']; onComplete: (id: string) => void; onDelete: (id: string) => void }) {
  if (!tasks.length) return <Empty text="Здесь пока пусто." />;
  return (
    <div className="taskList">
      {tasks.map((task) => {
        const area = areas.find((candidate) => candidate.id === task.areaId);
        return (
          <article className={cx('taskCard', task.priority === 'asap' && 'asap')} key={task.id}>
            <button className="complete" aria-label="Complete task" onClick={() => onComplete(task.id)}>
              <Check size={16} />
            </button>
            <div className="taskBody">
              <strong>{task.title}</strong>
              <div className="taskMeta">
                <span>{formatDate(task.dueAt)}</span>
                <span>{task.priority}</span>
                {area && <span style={{ color: area.color }}>{area.name}</span>}
                {statusOf(task) === 'failed' && <span className="failed">failed</span>}
              </div>
              {!!task.tags.length && <div className="tags">{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            </div>
            <button className="iconOnly subtle" aria-label="Delete task" onClick={() => onDelete(task.id)}>
              <Trash2 size={17} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

function ContextPanel({ snapshots, onSave }: { snapshots: ContextSnapshot[]; onSave: (value: Omit<ContextSnapshot, 'id' | 'at'>) => void }) {
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [note, setNote] = useState('');
  return (
    <div className="contextPanel">
      <div className="sliderRow">
        <label>Energy {energy}/5</label>
        <input type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} />
      </div>
      <div className="sliderRow">
        <label>Mood {mood}/5</label>
        <input type="range" min="1" max="5" value={mood} onChange={(event) => setMood(Number(event.target.value))} />
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Коротко: сон, состояние, что важно..." />
      <button
        className="primary"
        onClick={() => {
          onSave({ energy: energy as ContextSnapshot['energy'], mood: mood as ContextSnapshot['mood'], note });
          setNote('');
        }}
      >
        Записать
      </button>
      <div className="snapshotList">
        {snapshots.slice(0, 5).map((snapshot) => (
          <div className="snapshot" key={snapshot.id}>
            <span>energy {snapshot.energy ?? '?'}</span>
            <span>mood {snapshot.mood ?? '?'}</span>
            <small>{snapshot.note}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandItem({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button className="commandItem" onClick={onClick}>
      <span>{label}</span>
      <small>{detail}</small>
      <ChevronRight size={16} />
    </button>
  );
}
