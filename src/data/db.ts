import Dexie, { type Table } from 'dexie';
import type { AppSetting, Area, AuditEvent, ContextSnapshot, DomainEvent, Note, Task } from '../types';

export class AtlasDB extends Dexie {
  tasks!: Table<Task, string>;
  areas!: Table<Area, string>;
  notes!: Table<Note, string>;
  contextSnapshots!: Table<ContextSnapshot, string>;
  events!: Table<DomainEvent, string>;
  settings!: Table<AppSetting, string>;
  auditEvents!: Table<AuditEvent, string>;

  constructor() {
    super('atlas-v0');
    this.version(1).stores({
      tasks: 'id, areaId, status, dueAt, deadlineAt, createdAt, updatedAt, deletedAt',
      areas: 'id, order, archivedAt',
      notes: 'id, date, kind, createdAt, updatedAt',
      contextSnapshots: 'id, at',
      events: 'id, kind, at, actor, undone',
      settings: 'key',
      auditEvents: 'id, kind, at, actor, status, risk',
    });
  }
}

export const db = new AtlasDB();
