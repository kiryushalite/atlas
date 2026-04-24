export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type Priority = 'low' | 'medium' | 'high' | 'asap';
export type TaskStatus = 'active' | 'done' | 'failed';
export type RiskLevel = 'safe' | 'confirm' | 'dangerous';

export interface Area {
  id: ID;
  name: string;
  icon: string;
  color: string;
  order: number;
  archivedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Task {
  id: ID;
  title: string;
  note: string;
  areaId: ID;
  priority: Priority;
  status: TaskStatus;
  dueAt?: ISODateTime;
  deadlineAt?: ISODateTime;
  startAt?: ISODateTime;
  estimateMinutes?: number;
  parentId?: ID;
  goalId?: ID;
  ritualId?: ID;
  tags: string[];
  energy?: 'low' | 'mid' | 'high';
  contextTags: string[];
  xpAwarded?: number;
  completedAt?: ISODateTime;
  actualMinutes?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export interface Note {
  id: ID;
  title?: string;
  body: string;
  date: ISODate;
  kind: 'free' | 'journal' | 'review' | 'idea';
  linkedTaskIds: ID[];
  linkedGoalIds: ID[];
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ContextSnapshot {
  id: ID;
  at: ISODateTime;
  energy?: 1 | 2 | 3 | 4 | 5;
  mood?: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  note?: string;
}

export interface DomainEvent {
  id: ID;
  kind: string;
  payload: {
    entity?: 'task' | 'note' | 'context' | 'settings';
    entityId?: ID;
    before?: unknown;
    after?: unknown;
    meta?: Record<string, unknown>;
  };
  at: ISODateTime;
  actor: 'user' | 'system' | 'ai';
  undone?: boolean;
}

export interface AuditEvent {
  id: ID;
  kind: string;
  label: string;
  risk: RiskLevel;
  at: ISODateTime;
  actor: 'user' | 'system' | 'ai';
  status: 'proposed' | 'confirmed' | 'executed' | 'cancelled' | 'blocked';
  details?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface AssistantSettings {
  assistantName: string;
  aiEnabled: boolean;
  provider: 'local' | 'openai' | 'anthropic' | 'custom';
  model: string;
}

export interface ToolAction {
  id: ID;
  kind: string;
  label: string;
  risk: RiskLevel;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface VoiceSession {
  id: ID;
  wakePhrase: string;
  transcript: string;
  state: 'idle' | 'listening' | 'thinking' | 'confirming' | 'speaking';
  proposedAction?: ToolAction;
}

export interface ParsedQuickAdd {
  title: string;
  dueAt?: ISODateTime;
  priority: Priority;
  tags: string[];
  areaHint?: string;
}
