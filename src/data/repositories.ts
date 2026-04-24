import { nanoid } from 'nanoid';
import { db } from './db';
import type { AppSetting, Area, AssistantSettings, AuditEvent, ContextSnapshot, DomainEvent, Note, RiskLevel, Task, ToolAction } from '../types';
import { nowIso, parseQuickAdd, todayDate } from '../lib/date';

const defaultAreas = [
  { name: 'Работа', icon: 'briefcase', color: 'hsl(204 70% 48%)' },
  { name: 'Спорт', icon: 'activity', color: 'hsl(150 62% 40%)' },
  { name: 'Личное', icon: 'user', color: 'hsl(262 62% 56%)' },
  { name: 'Быт', icon: 'home', color: 'hsl(35 72% 50%)' },
];

export const defaultAssistantSettings: AssistantSettings = {
  assistantName: 'Atlas',
  aiEnabled: true,
  provider: 'local',
  model: 'local-heuristic-v0',
};

async function recordEvent(event: Omit<DomainEvent, 'id' | 'at'>) {
  await db.events.add({ ...event, id: nanoid(), at: nowIso() });
}

export async function recordAudit(event: Omit<AuditEvent, 'id' | 'at'>) {
  await db.auditEvents.add({ ...event, id: nanoid(), at: nowIso() });
}

export async function initializeAtlas() {
  const areaCount = await db.areas.count();
  if (areaCount === 0) {
    const timestamp = nowIso();
    await db.areas.bulkAdd(
      defaultAreas.map((area, index) => ({
        ...area,
        id: nanoid(),
        order: index,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
    await recordEvent({ kind: 'areas.seeded', actor: 'system', payload: { meta: { count: defaultAreas.length } } });
  }

  const settings = await db.settings.get('assistant');
  if (!settings) {
    await db.settings.put({ key: 'assistant', value: defaultAssistantSettings });
  }
  const theme = await db.settings.get('theme');
  if (!theme) {
    await db.settings.put({ key: 'theme', value: 'dark' });
  }
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const value = (await db.settings.get('assistant'))?.value;
  return { ...defaultAssistantSettings, ...(value as Partial<AssistantSettings> | undefined) };
}

export async function saveSetting<T>(key: string, value: T) {
  const before = await db.settings.get(key);
  const after: AppSetting = { key, value };
  await db.settings.put(after);
  await recordEvent({ kind: 'settings.updated', actor: 'user', payload: { entity: 'settings', entityId: key, before, after } });
}

export async function listAreas() {
  return db.areas.orderBy('order').toArray();
}

export async function createTaskFromQuickAdd(text: string, actor: 'user' | 'ai' = 'user') {
  const parsed = parseQuickAdd(text);
  const areas = await listAreas();
  const area = areas.find((candidate) => {
    const haystack = `${candidate.name} ${candidate.icon}`.toLowerCase();
    return parsed.areaHint ? haystack.includes(parsed.areaHint.toLowerCase()) : false;
  }) ?? areas[0];
  const timestamp = nowIso();
  const task: Task = {
    id: nanoid(),
    title: parsed.title,
    note: '',
    areaId: area.id,
    priority: parsed.priority,
    status: 'active',
    dueAt: parsed.dueAt,
    tags: parsed.tags,
    contextTags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.tasks.add(task);
  await recordEvent({ kind: 'task.created', actor, payload: { entity: 'task', entityId: task.id, after: task } });
  await recordAudit({ kind: 'task.created', label: `Создана задача: ${task.title}`, risk: 'safe', actor, status: 'executed' });
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>, actor: 'user' | 'ai' = 'user') {
  const before = await db.tasks.get(id);
  if (!before) return;
  const after = { ...before, ...patch, updatedAt: nowIso() };
  await db.tasks.put(after);
  await recordEvent({ kind: 'task.updated', actor, payload: { entity: 'task', entityId: id, before, after } });
  await recordAudit({ kind: 'task.updated', label: `Обновлена задача: ${after.title}`, risk: 'safe', actor, status: 'executed' });
}

export async function completeTask(id: string) {
  await updateTask(id, { status: 'done', completedAt: nowIso() });
}

export async function softDeleteTask(id: string) {
  const before = await db.tasks.get(id);
  if (!before) return;
  const after = { ...before, deletedAt: nowIso(), updatedAt: nowIso() };
  await db.tasks.put(after);
  await recordEvent({ kind: 'task.deleted', actor: 'user', payload: { entity: 'task', entityId: id, before, after } });
  await recordAudit({ kind: 'task.deleted', label: `Удалена задача: ${before.title}`, risk: 'confirm', actor: 'user', status: 'executed' });
}

export async function createNote(body: string, kind: Note['kind'] = 'free') {
  const timestamp = nowIso();
  const firstLine = body.split('\n').find(Boolean)?.slice(0, 80);
  const note: Note = {
    id: nanoid(),
    title: firstLine,
    body,
    date: todayDate(),
    kind,
    linkedTaskIds: [],
    linkedGoalIds: [],
    tags: Array.from(body.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.notes.add(note);
  await recordEvent({ kind: 'note.created', actor: 'user', payload: { entity: 'note', entityId: note.id, after: note } });
  await recordAudit({ kind: 'note.created', label: `Создана заметка: ${note.title ?? 'без заголовка'}`, risk: 'safe', actor: 'user', status: 'executed' });
  return note;
}

export async function createContextSnapshot(snapshot: Omit<ContextSnapshot, 'id' | 'at'>) {
  const value: ContextSnapshot = { ...snapshot, id: nanoid(), at: nowIso() };
  await db.contextSnapshots.add(value);
  await recordEvent({ kind: 'context.created', actor: 'user', payload: { entity: 'context', entityId: value.id, after: value } });
  await recordAudit({ kind: 'context.created', label: 'Добавлен контекст состояния', risk: 'safe', actor: 'user', status: 'executed' });
  return value;
}

export async function listActiveTasks() {
  const tasks = await db.tasks.orderBy('createdAt').reverse().toArray();
  return tasks.filter((task) => !task.deletedAt);
}

export async function listNotes() {
  return db.notes.orderBy('createdAt').reverse().toArray();
}

export async function listContextSnapshots() {
  return db.contextSnapshots.orderBy('at').reverse().limit(30).toArray();
}

export async function listAuditEvents() {
  return db.auditEvents.orderBy('at').reverse().limit(80).toArray();
}

export async function listDomainEvents() {
  return db.events.orderBy('at').reverse().limit(80).toArray();
}

export async function undoLastUserEvent() {
  const events = (await db.events.where('actor').equals('user').toArray()).sort((left, right) => right.at.localeCompare(left.at));
  const event = events.find((candidate) => !candidate.undone && ['task.created', 'task.updated', 'task.deleted', 'note.created', 'context.created'].includes(candidate.kind));
  if (!event) return null;

  if (event.kind === 'task.created' && event.payload.entityId) {
    await db.tasks.delete(event.payload.entityId);
  }
  if ((event.kind === 'task.updated' || event.kind === 'task.deleted') && event.payload.before) {
    await db.tasks.put(event.payload.before as Task);
  }
  if (event.kind === 'note.created' && event.payload.entityId) {
    await db.notes.delete(event.payload.entityId);
  }
  if (event.kind === 'context.created' && event.payload.entityId) {
    await db.contextSnapshots.delete(event.payload.entityId);
  }

  await db.events.update(event.id, { undone: true });
  await recordAudit({ kind: 'undo', label: `Отменено действие: ${event.kind}`, risk: 'safe', actor: 'user', status: 'executed' });
  return event;
}

export async function executeToolAction(action: ToolAction) {
  await recordAudit({ kind: action.kind, label: action.label, risk: action.risk, actor: 'ai', status: 'confirmed' });
  if (action.kind === 'task.create') {
    const title = String(action.payload.title ?? '');
    if (title.trim()) return createTaskFromQuickAdd(title, 'ai');
  }
  if (action.kind === 'note.create') {
    const body = String(action.payload.body ?? '');
    if (body.trim()) return createNote(body, 'idea');
  }
  if (action.kind === 'context.create') {
    return createContextSnapshot({
      energy: Number(action.payload.energy ?? 3) as ContextSnapshot['energy'],
      mood: Number(action.payload.mood ?? 3) as ContextSnapshot['mood'],
      note: String(action.payload.note ?? ''),
    });
  }
  await recordAudit({ kind: action.kind, label: action.label, risk: action.risk, actor: 'ai', status: 'blocked', details: 'No executor registered in v0.' });
  return null;
}

export async function exportSnapshot() {
  return {
    exportedAt: nowIso(),
    areas: await db.areas.toArray(),
    tasks: await db.tasks.toArray(),
    notes: await db.notes.toArray(),
    contextSnapshots: await db.contextSnapshots.toArray(),
    settings: await db.settings.toArray(),
    events: await db.events.toArray(),
    auditEvents: await db.auditEvents.toArray(),
  };
}

export async function clearAllData() {
  await db.transaction('rw', [db.tasks, db.areas, db.notes, db.contextSnapshots, db.events, db.settings, db.auditEvents], async () => {
    await Promise.all([db.tasks.clear(), db.areas.clear(), db.notes.clear(), db.contextSnapshots.clear(), db.events.clear(), db.settings.clear(), db.auditEvents.clear()]);
  });
  await initializeAtlas();
  await recordAudit({ kind: 'data.nuke', label: 'Локальные данные очищены и пересозданы', risk: 'dangerous', actor: 'user', status: 'executed' });
}

export function riskCopy(risk: RiskLevel) {
  if (risk === 'dangerous') return 'Опасное действие';
  if (risk === 'confirm') return 'Требует подтверждения';
  return 'Безопасное действие';
}
