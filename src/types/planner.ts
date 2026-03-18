export interface Label {
  color: string;
  text: string;
}

export interface HistoryEntry {
  timestamp: Date;
  durationMinutes: number;
  note?: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  completed: boolean;
  subtasks: Task[];
  dependencies: string[];
  labels: Label[];
  history: HistoryEntry[];
  orderIndex?: number;
  recurring?: boolean;
  estimatedTime?: number;
}

export interface Day {
  date: Date;
  tasksRoot: Task[];
}

export interface Week {
  id: string;
  days: Day[];
}

export interface CompletedTaskRecord {
  task: Task;
  sourceWeekId: string;
  sourceDayIndex: number;
  completedAt: Date;
}

export interface NewTaskDraft {
  name: string;
  description?: string;
  labels: Label[];
  estimatedTime?: number;
  recurring?: boolean;
}

export interface DepValidationResult {
  ok: boolean;
  reason?: string;
}
