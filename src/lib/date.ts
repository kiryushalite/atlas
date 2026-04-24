import type { ParsedQuickAdd, Priority, Task, TaskStatus } from '../types';

const pad = (value: number) => String(value).padStart(2, '0');

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function toLocalInputDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function atLocalHour(date: Date, hour = 9, minute = 0): string {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

export function isSameLocalDay(iso?: string, date = new Date()): boolean {
  if (!iso) return false;
  const value = new Date(iso);
  return toLocalInputDate(value) === toLocalInputDate(date);
}

export function formatDate(iso?: string): string {
  if (!iso) return 'Без даты';
  const value = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const key = toLocalInputDate(value);
  if (key === toLocalInputDate(today)) return 'Сегодня';
  if (key === toLocalInputDate(tomorrow)) return 'Завтра';
  return value.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusOf(task: Pick<Task, 'status' | 'deadlineAt'>): TaskStatus {
  if (task.status === 'done') return 'done';
  if (task.deadlineAt && new Date(task.deadlineAt).getTime() < Date.now()) return 'failed';
  return task.status;
}

export function parseQuickAdd(input: string): ParsedQuickAdd {
  let title = input.trim();
  const tags = Array.from(title.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  title = title.replace(/#[\p{L}\p{N}_-]+/gu, '').replace(/\s+/g, ' ').trim();

  let priority: Priority = 'medium';
  if (/(!важно|!high|!!)/i.test(title)) priority = 'high';
  if (/(!asap|!срочно|!!!)/i.test(title)) priority = 'asap';
  if (/(!низк|!low)/i.test(title)) priority = 'low';
  title = title.replace(/!важно|!high|!!|!asap|!срочно|!!!|!низк\w*|!low/gi, '').replace(/\s+/g, ' ').trim();

  const now = new Date();
  const date = new Date(now);
  let dateFound = false;

  const tomorrowMatch = title.match(/(?:^|\s)(завтра|tomorrow)(?=\s|$)/i);
  if (tomorrowMatch) {
    date.setDate(now.getDate() + 1);
    dateFound = true;
    title = title.replace(tomorrowMatch[0], ' ').trim();
  }

  const inDays = title.match(/(?:^|\s)(?:через|in)\s+(\d{1,2})\s*(?:дн\w*|days?)(?=\s|$)/i);
  if (inDays) {
    date.setDate(now.getDate() + Number(inDays[1]));
    dateFound = true;
    title = title.replace(inDays[0], '').trim();
  }

  const weekdays: Record<string, number> = {
    понедельник: 1,
    вторник: 2,
    среду: 3,
    среда: 3,
    четверг: 4,
    пятницу: 5,
    пятница: 5,
    субботу: 6,
    суббота: 6,
    воскресенье: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  for (const [word, weekday] of Object.entries(weekdays)) {
    const regex = new RegExp(`(?:^|\\s)(?:в|on)?\\s*${word}(?=\\s|$)`, 'i');
    if (regex.test(title)) {
      const diff = (weekday - now.getDay() + 7) % 7 || 7;
      date.setDate(now.getDate() + diff);
      dateFound = true;
      title = title.replace(regex, '').trim();
      break;
    }
  }

  const time = title.match(/\b(?:в|at)?\s*(\d{1,2})(?::|\.|ч)?(\d{2})?\b/i);
  if (time && dateFound) {
    date.setHours(Number(time[1]), Number(time[2] ?? '0'), 0, 0);
    title = title.replace(time[0], '').trim();
  } else if (dateFound) {
    date.setHours(9, 0, 0, 0);
  }

  const area = tags.find((tag) => ['работа', 'work', 'спорт', 'sport', 'личное', 'personal', 'быт', 'home'].includes(tag.toLowerCase()));

  return {
    title: title || input.trim(),
    dueAt: dateFound ? date.toISOString() : undefined,
    priority,
    tags,
    areaHint: area,
  };
}
