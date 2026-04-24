import { nanoid } from 'nanoid';
import type { AssistantSettings, ContextSnapshot, Note, Task, ToolAction } from '../types';
import { formatDate, isSameLocalDay, statusOf } from '../lib/date';

export interface AssistantContext {
  tasks: Task[];
  notes: Note[];
  contextSnapshots: ContextSnapshot[];
  settings: AssistantSettings;
}

export interface AssistantProvider {
  id: AssistantSettings['provider'];
  name: string;
  send(input: string, context: AssistantContext): Promise<string>;
}

export function buildPromptPreview(input: string, context: AssistantContext): string {
  const activeTasks = context.tasks
    .filter((task) => !task.deletedAt && statusOf(task) === 'active')
    .slice(0, 12)
    .map((task) => `- ${task.title} (${formatDate(task.dueAt)}, ${task.priority})`)
    .join('\n');
  const notes = context.notes
    .slice(0, 5)
    .map((note) => `- ${note.title ?? note.body.slice(0, 60)}`)
    .join('\n');
  const snapshots = context.contextSnapshots
    .slice(0, 5)
    .map((snapshot) => `- energy=${snapshot.energy ?? '?'} mood=${snapshot.mood ?? '?'} ${snapshot.note ?? ''}`)
    .join('\n');

  return [
    `Ты — ${context.settings.assistantName}, личный ассистент пользователя.`,
    'Отвечай кратко, точно и без выдуманных фактов.',
    '',
    'Активные задачи:',
    activeTasks || '- нет',
    '',
    'Последние заметки:',
    notes || '- нет',
    '',
    'Контекст состояния:',
    snapshots || '- нет',
    '',
    `Вопрос пользователя: ${input}`,
  ].join('\n');
}

export function proposeActionFromText(input: string): ToolAction | null {
  const normalized = input.trim();
  const taskMatch = normalized.match(/(?:создай|добавь|запиши|create|add)\s+(?:задачу\s+)?(.+)/i);
  if (taskMatch) {
    return {
      id: nanoid(),
      kind: 'task.create',
      label: `Создать задачу: ${taskMatch[1]}`,
      risk: 'confirm',
      payload: { title: taskMatch[1] },
      requiresConfirmation: true,
    };
  }
  const noteMatch = normalized.match(/(?:заметка|запомни|note)\s+(.+)/i);
  if (noteMatch) {
    return {
      id: nanoid(),
      kind: 'note.create',
      label: 'Создать заметку из голосовой команды',
      risk: 'confirm',
      payload: { body: noteMatch[1] },
      requiresConfirmation: true,
    };
  }
  const contextMatch = normalized.match(/(?:энергия|energy)\s*(\d)/i);
  if (contextMatch) {
    return {
      id: nanoid(),
      kind: 'context.create',
      label: `Записать энергию ${contextMatch[1]}/5`,
      risk: 'confirm',
      payload: { energy: Number(contextMatch[1]), note: normalized },
      requiresConfirmation: true,
    };
  }
  return null;
}

export const localProvider: AssistantProvider = {
  id: 'local',
  name: 'Local heuristic',
  async send(input, context) {
    const todayTasks = context.tasks.filter((task) => !task.deletedAt && isSameLocalDay(task.dueAt) && statusOf(task) === 'active');
    const activeTasks = context.tasks.filter((task) => !task.deletedAt && statusOf(task) === 'active');
    const asap = activeTasks.find((task) => task.priority === 'asap' || task.priority === 'high');
    const lastContext = context.contextSnapshots[0];

    if (/что сегодня|today|день/i.test(input)) {
      const next = asap ?? todayTasks[0] ?? activeTasks[0];
      return [
        `Сегодня активных задач: ${todayTasks.length}. Всего открытых: ${activeTasks.length}.`,
        next ? `Следующий разумный шаг: ${next.title}.` : 'Пока нет открытых задач. Можно поймать первую мысль через Quick Add.',
        lastContext ? `Последний контекст: энергия ${lastContext.energy ?? '?'}/5, настроение ${lastContext.mood ?? '?'}/5.` : 'Контекст состояния ещё не записан.',
      ].join(' ');
    }

    const action = proposeActionFromText(input);
    if (action) {
      return `Я могу подготовить действие: "${action.label}". Перед выполнением покажу подтверждение.`;
    }

    if (!context.settings.aiEnabled) {
      return 'AI-слой выключен. Локальное ядро работает: задачи, заметки, поиск, Today и журнал действий доступны офлайн.';
    }

    return 'В v0 я работаю локально и осторожно: вижу задачи, заметки и контекст, могу предложить следующий шаг или подготовить действие на подтверждение.';
  },
};

export async function askAssistant(input: string, context: AssistantContext): Promise<{ answer: string; preview: string; action: ToolAction | null }> {
  const preview = buildPromptPreview(input, context);
  const action = proposeActionFromText(input);
  const answer = await localProvider.send(input, context);
  return { answer, preview, action };
}
