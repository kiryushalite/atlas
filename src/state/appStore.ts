import { create } from 'zustand';
import type { Area, AssistantSettings, AuditEvent, ContextSnapshot, DomainEvent, Note, Task } from '../types';
import { db } from '../data/db';
import { defaultAssistantSettings, getAssistantSettings, listActiveTasks, listAreas, listAuditEvents, listContextSnapshots, listDomainEvents, listNotes } from '../data/repositories';

interface AppState {
  booted: boolean;
  view: 'today' | 'inbox' | 'notes' | 'ask' | 'settings';
  theme: 'light' | 'dark';
  search: string;
  areas: Area[];
  tasks: Task[];
  notes: Note[];
  contextSnapshots: ContextSnapshot[];
  auditEvents: AuditEvent[];
  domainEvents: DomainEvent[];
  assistant: AssistantSettings;
  setView: (view: AppState['view']) => void;
  setSearch: (search: string) => void;
  setTheme: (theme: AppState['theme']) => void;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  booted: false,
  view: 'today',
  theme: 'dark',
  search: '',
  areas: [],
  tasks: [],
  notes: [],
  contextSnapshots: [],
  auditEvents: [],
  domainEvents: [],
  assistant: defaultAssistantSettings,
  setView: (view) => set({ view }),
  setSearch: (search) => set({ search }),
  setTheme: (theme) => set({ theme }),
  refresh: async () => {
    const [areas, tasks, notes, contextSnapshots, auditEvents, domainEvents, assistant, themeSetting] = await Promise.all([
      listAreas(),
      listActiveTasks(),
      listNotes(),
      listContextSnapshots(),
      listAuditEvents(),
      listDomainEvents(),
      getAssistantSettings(),
      db.settings.get('theme'),
    ]);
    set({
      booted: true,
      areas,
      tasks,
      notes,
      contextSnapshots,
      auditEvents,
      domainEvents,
      assistant,
      theme: themeSetting?.value === 'light' ? 'light' : 'dark',
    });
  },
}));
