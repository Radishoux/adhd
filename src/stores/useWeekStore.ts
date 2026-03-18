import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type {
  CompletedTaskRecord,
  Day,
  DepValidationResult,
  HistoryEntry,
  NewTaskDraft,
  Task,
  Week,
} from '../types/planner';
import { getWeekDays } from '../utils/date';
import {
  areDependenciesSatisfied,
  canMarkParentComplete,
  cloneTask,
  ensureBlockedLabel,
  findTaskById,
  flattenTasks,
  insertTask,
  introducesCycle,
  listDependencyGraph,
  removeTaskById,
  reorderByIds,
  toggleRecursiveCompletion,
  updateTaskById,
} from '../utils/taskTree';

const STORAGE_KEY = 'advanced-week-planner-v1';

interface PersistHistoryEntry {
  timestamp: string;
  durationMinutes: number;
  note?: string;
}

interface PersistTask extends Omit<Task, 'subtasks' | 'history'> {
  subtasks: PersistTask[];
  history: PersistHistoryEntry[];
}

interface PersistDay {
  date: string;
  tasksRoot: PersistTask[];
}

interface PersistWeek {
  id: string;
  days: PersistDay[];
}

interface PersistCompletedTaskRecord {
  task: PersistTask;
  sourceWeekId: string;
  sourceDayIndex: number;
  completedAt: string;
}

interface PlannerPersistState {
  weeks: PersistWeek[];
  activeWeekId: string;
  globalTaskPool: PersistTask[];
  completedTasks: PersistCompletedTaskRecord[];
  labelFilters: string[];
  showRecurringOnlyCompleted: boolean;
  darkMode: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeTaskId?: string;
}

interface PlannerState {
  weeks: Week[];
  activeWeekId: string;
  globalTaskPool: Task[];
  completedTasks: CompletedTaskRecord[];
  labelFilters: string[];
  showRecurringOnlyCompleted: boolean;
  darkMode: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeTaskId?: string;
  searchTerm: string;
  createTaskInPool: (draft: NewTaskDraft) => void;
  addHistoryEntry: (dayIndex: number, taskId: string, entry: Omit<HistoryEntry, 'timestamp'> & { timestamp?: Date }) => void;
  placePoolTaskIntoDay: (taskId: string, dayIndex: number) => void;
  moveCompletedTaskToDay: (taskId: string, dayIndex: number) => void;
  returnCompletedTaskToPool: (taskId: string) => void;
  moveTaskToPool: (fromDayIndex: number, taskId: string) => void;
  reorderDayRootTasks: (dayIndex: number, activeTaskId: string, overTaskId: string) => void;
  moveTaskAcrossDays: (fromDayIndex: number, toDayIndex: number, taskId: string) => void;
  updateTask: (dayIndex: number, taskId: string, patch: Partial<Task>) => void;
  updatePoolTask: (taskId: string, patch: Partial<Task>) => void;
  addSubtask: (dayIndex: number, parentTaskId: string, draft: NewTaskDraft) => void;
  toggleTaskCompleted: (dayIndex: number, taskId: string, completed: boolean) => void;
  togglePoolTaskCompleted: (taskId: string, completed: boolean) => void;
  validateDependencies: (taskId: string, deps: string[]) => DepValidationResult;
  setTaskDependencies: (dayIndex: number, taskId: string, deps: string[]) => DepValidationResult;
  setPoolTaskDependencies: (taskId: string, deps: string[]) => DepValidationResult;
  createWeek: () => void;
  copyActiveWeek: () => void;
  setActiveWeek: (weekId: string) => void;
  setLabelFilters: (labels: string[]) => void;
  setShowRecurringOnlyCompleted: (value: boolean) => void;
  toggleDarkMode: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSearchTerm: (value: string) => void;
  setActiveTaskId: (taskId?: string) => void;
  exportActiveWeekAsJson: () => string;
  importWeekFromJson: (json: string) => { ok: boolean; reason?: string };
}

function createTaskFromDraft(draft: NewTaskDraft): Task {
  return {
    id: uuidv4(),
    name: draft.name,
    description: draft.description,
    completed: false,
    subtasks: [],
    dependencies: [],
    labels: draft.labels,
    history: [],
    recurring: draft.recurring,
    estimatedTime: draft.estimatedTime,
  };
}

function createDefaultWeek(): Week {
  return {
    id: uuidv4(),
    days: getWeekDays().map((date): Day => ({
      date,
      tasksRoot: [],
    })),
  };
}

function serializeTask(task: Task): PersistTask {
  return {
    ...task,
    history: task.history.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp).toISOString(),
    })),
    subtasks: task.subtasks.map(serializeTask),
  };
}

function deserializeTask(task: PersistTask): Task {
  return {
    ...task,
    history: task.history.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    })),
    subtasks: task.subtasks.map(deserializeTask),
  };
}

function serializeState(state: PlannerState): PlannerPersistState {
  return {
    weeks: state.weeks.map((week) => ({
      id: week.id,
      days: week.days.map((day) => ({
        date: day.date.toISOString(),
        tasksRoot: day.tasksRoot.map(serializeTask),
      })),
    })),
    activeWeekId: state.activeWeekId,
    globalTaskPool: state.globalTaskPool.map(serializeTask),
    completedTasks: state.completedTasks.map((entry) => ({
      ...entry,
      task: serializeTask(entry.task),
      completedAt: entry.completedAt.toISOString(),
    })),
    labelFilters: state.labelFilters,
    showRecurringOnlyCompleted: state.showRecurringOnlyCompleted,
    darkMode: state.darkMode,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    activeTaskId: state.activeTaskId,
  };
}

function deserializeState(persist: PlannerPersistState): Partial<PlannerState> {
  return {
    weeks: persist.weeks.map((week) => ({
      id: week.id,
      days: week.days.map((day) => ({
        date: new Date(day.date),
        tasksRoot: day.tasksRoot.map(deserializeTask),
      })),
    })),
    activeWeekId: persist.activeWeekId,
    globalTaskPool: persist.globalTaskPool.map(deserializeTask),
    completedTasks: persist.completedTasks.map((entry) => ({
      ...entry,
      task: deserializeTask(entry.task),
      completedAt: new Date(entry.completedAt),
    })),
    labelFilters: persist.labelFilters,
    showRecurringOnlyCompleted: persist.showRecurringOnlyCompleted,
    darkMode: persist.darkMode,
    sidebarCollapsed: persist.sidebarCollapsed,
    sidebarWidth: persist.sidebarWidth,
    activeTaskId: persist.activeTaskId,
  };
}

function safeLoadState(): Partial<PlannerState> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as PlannerPersistState;
    return deserializeState(parsed);
  } catch {
    return {};
  }
}

function saveState(state: PlannerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
}

function collectAllTasks(week: Week, pool: Task[]): Task[] {
  return [...flattenTasks(week.days.flatMap((day) => day.tasksRoot)), ...flattenTasks(pool)];
}

function collectTaskMap(week: Week, pool: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();
  collectAllTasks(week, pool).forEach((task) => {
    map.set(task.id, task);
  });
  return map;
}

function resetCompletedInTree(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    completed: false,
    subtasks: resetCompletedInTree(task.subtasks),
  }));
}

const initialWeek = createDefaultWeek();
const loaded = typeof window !== 'undefined' ? safeLoadState() : {};

export const useWeekStore = create<PlannerState>((set, get) => {
  const initialState: PlannerState = {
    weeks: loaded.weeks?.length ? loaded.weeks : [initialWeek],
    activeWeekId: loaded.activeWeekId ?? initialWeek.id,
    globalTaskPool: loaded.globalTaskPool ?? [],
    completedTasks: loaded.completedTasks ?? [],
    labelFilters: loaded.labelFilters ?? [],
    showRecurringOnlyCompleted: loaded.showRecurringOnlyCompleted ?? true,
    darkMode: loaded.darkMode ?? false,
    sidebarCollapsed: loaded.sidebarCollapsed ?? false,
    sidebarWidth: loaded.sidebarWidth ?? 360,
    activeTaskId: loaded.activeTaskId,
    searchTerm: '',
    createTaskInPool: (draft) => {
      if (!draft.name.trim()) return;

      set((state) => {
        const next = { ...state, globalTaskPool: [...state.globalTaskPool, createTaskFromDraft(draft)] };
        saveState(next);
        return next;
      });
    },
    addHistoryEntry: (dayIndex, taskId, entry) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;
          return {
            ...item,
            days: item.days.map((day, idx) => {
              if (idx !== dayIndex) return day;
              return {
                ...day,
                tasksRoot: updateTaskById(day.tasksRoot, taskId, (task) => ({
                  ...task,
                  history: [
                    ...task.history,
                    {
                      timestamp: entry.timestamp ?? new Date(),
                      durationMinutes: entry.durationMinutes,
                      note: entry.note,
                    },
                  ],
                })),
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    placePoolTaskIntoDay: (taskId, dayIndex) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const template = findTaskById(state.globalTaskPool, taskId);
        if (!template) return state;

        const taskMap = collectTaskMap(week, state.globalTaskPool);
        const toInsert: Task[] = [];

        const visit = (id: string) => {
          const candidate = taskMap.get(id);
          if (!candidate) return;
          candidate.dependencies.forEach(visit);
          toInsert.push(cloneTask(candidate));
        };

        visit(taskId);

        const unique = Array.from(new Map(toInsert.map((task) => [task.name + task.description, task])).values());

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;

          return {
            ...item,
            days: item.days.map((day, index) => {
              if (index !== dayIndex) return day;

              const nextRoot = unique.reduce((acc, task) => insertTask(acc, task), day.tasksRoot);
              return {
                ...day,
                tasksRoot: nextRoot,
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    moveCompletedTaskToDay: (taskId, dayIndex) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const completedRecord = state.completedTasks.find((item) => item.task.id === taskId);
        if (!completedRecord) return state;

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;
          return {
            ...item,
            days: item.days.map((day, idx) => {
              if (idx !== dayIndex) return day;
              return {
                ...day,
                tasksRoot: insertTask(day.tasksRoot, {
                  ...completedRecord.task,
                  completed: false,
                }),
              };
            }),
          };
        });

        const next = {
          ...state,
          weeks: nextWeeks,
          completedTasks: state.completedTasks.filter((entry) => entry.task.id !== taskId),
        };
        saveState(next);
        return next;
      });
    },
    returnCompletedTaskToPool: (taskId) => {
      set((state) => {
        const completedRecord = state.completedTasks.find((item) => item.task.id === taskId);
        if (!completedRecord) return state;

        const next = {
          ...state,
          globalTaskPool: [...state.globalTaskPool, { ...completedRecord.task, completed: false }],
          completedTasks: state.completedTasks.filter((entry) => entry.task.id !== taskId),
        };
        saveState(next);
        return next;
      });
    },
    moveTaskToPool: (fromDayIndex, taskId) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const fromDay = week.days[fromDayIndex];
        const removeResult = removeTaskById(fromDay.tasksRoot, taskId);
        if (!removeResult.removed) return state;

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;
          return {
            ...item,
            days: item.days.map((day, idx) =>
              idx === fromDayIndex ? { ...day, tasksRoot: removeResult.next } : day,
            ),
          };
        });

        const next = {
          ...state,
          weeks: nextWeeks,
          globalTaskPool: [...state.globalTaskPool, { ...removeResult.removed, completed: false }],
        };
        saveState(next);
        return next;
      });
    },
    reorderDayRootTasks: (dayIndex, activeTaskId, overTaskId) => {
      set((state) => {
        const nextWeeks = state.weeks.map((week) => {
          if (week.id !== state.activeWeekId) return week;
          return {
            ...week,
            days: week.days.map((day, idx) => {
              if (idx !== dayIndex) return day;
              return {
                ...day,
                tasksRoot: reorderByIds(day.tasksRoot, activeTaskId, overTaskId),
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    moveTaskAcrossDays: (fromDayIndex, toDayIndex, taskId) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const fromDay = week.days[fromDayIndex];
        const removeResult = removeTaskById(fromDay.tasksRoot, taskId);
        if (!removeResult.removed) return state;
        const removedTask = removeResult.removed;

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;
          return {
            ...item,
            days: item.days.map((day, idx) => {
              if (idx === fromDayIndex) {
                return { ...day, tasksRoot: removeResult.next };
              }

              if (idx === toDayIndex) {
                return { ...day, tasksRoot: insertTask(day.tasksRoot, removedTask) };
              }

              return day;
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    updateTask: (dayIndex, taskId, patch) => {
      set((state) => {
        const activeWeek = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!activeWeek) return state;

        const allTasks = collectAllTasks(activeWeek, state.globalTaskPool);

        const nextWeeks = state.weeks.map((week) => {
          if (week.id !== state.activeWeekId) return week;
          return {
            ...week,
            days: week.days.map((day, idx) => {
              if (idx !== dayIndex) return day;
              return {
                ...day,
                tasksRoot: updateTaskById(day.tasksRoot, taskId, (task) => {
                  const blocked = !areDependenciesSatisfied(task, allTasks);
                  return ensureBlockedLabel({ ...task, ...patch }, blocked);
                }),
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    updatePoolTask: (taskId, patch) => {
      set((state) => {
        const next = {
          ...state,
          globalTaskPool: updateTaskById(state.globalTaskPool, taskId, (task) => ({ ...task, ...patch })),
        };
        saveState(next);
        return next;
      });
    },
    addSubtask: (dayIndex, parentTaskId, draft) => {
      if (!draft.name.trim()) return;

      set((state) => {
        const nextWeeks = state.weeks.map((week) => {
          if (week.id !== state.activeWeekId) return week;
          return {
            ...week,
            days: week.days.map((day, idx) => {
              if (idx !== dayIndex) return day;
              return {
                ...day,
                tasksRoot: insertTask(day.tasksRoot, createTaskFromDraft(draft), {
                  parentId: parentTaskId,
                }),
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    toggleTaskCompleted: (dayIndex, taskId, completed) => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const day = week.days[dayIndex];
        const target = findTaskById(day.tasksRoot, taskId);
        if (!target) return state;

        if (completed) {
          if (!canMarkParentComplete(target)) {
            return state;
          }

          const removeResult = removeTaskById(day.tasksRoot, taskId);
          if (!removeResult.removed) return state;

          const doneTask = toggleRecursiveCompletion(removeResult.removed, true);
          doneTask.history = [
            ...doneTask.history,
            {
              timestamp: new Date(),
              durationMinutes: doneTask.estimatedTime ?? 0,
              note: 'Completed',
            },
          ];

          const nextWeeks = state.weeks.map((item) => {
            if (item.id !== state.activeWeekId) return item;
            return {
              ...item,
              days: item.days.map((dayItem, idx) => (idx === dayIndex ? { ...dayItem, tasksRoot: removeResult.next } : dayItem)),
            };
          });

          const next = {
            ...state,
            weeks: nextWeeks,
            completedTasks: [
              ...state.completedTasks,
              {
                task: doneTask,
                sourceWeekId: state.activeWeekId,
                sourceDayIndex: dayIndex,
                completedAt: new Date(),
              },
            ],
          };
          saveState(next);
          return next;
        }

        const nextWeeks = state.weeks.map((item) => {
          if (item.id !== state.activeWeekId) return item;
          return {
            ...item,
            days: item.days.map((dayItem, idx) => {
              if (idx !== dayIndex) return dayItem;
              return {
                ...dayItem,
                tasksRoot: updateTaskById(dayItem.tasksRoot, taskId, (task) => toggleRecursiveCompletion(task, false)),
              };
            }),
          };
        });

        const next = { ...state, weeks: nextWeeks };
        saveState(next);
        return next;
      });
    },
    togglePoolTaskCompleted: (taskId, completed) => {
      set((state) => {
        if (!completed) {
          return state;
        }

        const removeResult = removeTaskById(state.globalTaskPool, taskId);
        if (!removeResult.removed) return state;

        const doneTask = toggleRecursiveCompletion(removeResult.removed, true);
        doneTask.history = [
          ...doneTask.history,
          {
            timestamp: new Date(),
            durationMinutes: doneTask.estimatedTime ?? 0,
            note: 'Completed from global pool',
          },
        ];

        const next = {
          ...state,
          globalTaskPool: removeResult.next,
          completedTasks: [
            ...state.completedTasks,
            {
              task: doneTask,
              sourceWeekId: state.activeWeekId,
              sourceDayIndex: 0,
              completedAt: new Date(),
            },
          ],
        };
        saveState(next);
        return next;
      });
    },
    validateDependencies: (taskId, deps) => {
      const state = get();
      const week = state.weeks.find((item) => item.id === state.activeWeekId);
      if (!week) {
        return { ok: false, reason: 'No active week.' };
      }

      if (deps.includes(taskId)) {
        return { ok: false, reason: 'Task cannot depend on itself.' };
      }

      const graph = listDependencyGraph([...week.days.flatMap((day) => day.tasksRoot), ...state.globalTaskPool]);
      const hasCycle = introducesCycle(graph, taskId, deps);

      if (hasCycle) {
        return { ok: false, reason: 'Circular dependencies detected.' };
      }

      return { ok: true };
    },
    setTaskDependencies: (dayIndex, taskId, deps) => {
      const result = get().validateDependencies(taskId, deps);
      if (!result.ok) return result;

      get().updateTask(dayIndex, taskId, { dependencies: deps });
      return { ok: true };
    },
    setPoolTaskDependencies: (taskId, deps) => {
      const result = get().validateDependencies(taskId, deps);
      if (!result.ok) return result;

      get().updatePoolTask(taskId, { dependencies: deps });
      return { ok: true };
    },
    createWeek: () => {
      set((state) => {
        const newWeek = createDefaultWeek();
        const next = { ...state, weeks: [...state.weeks, newWeek], activeWeekId: newWeek.id };
        saveState(next);
        return next;
      });
    },
    copyActiveWeek: () => {
      set((state) => {
        const week = state.weeks.find((item) => item.id === state.activeWeekId);
        if (!week) return state;

        const copied: Week = {
          id: uuidv4(),
          days: week.days.map((day) => ({
            date: new Date(day.date),
            tasksRoot: resetCompletedInTree(day.tasksRoot),
          })),
        };

        const next = { ...state, weeks: [...state.weeks, copied], activeWeekId: copied.id };
        saveState(next);
        return next;
      });
    },
    setActiveWeek: (weekId) =>
      set((state) => {
        const next = { ...state, activeWeekId: weekId };
        saveState(next);
        return next;
      }),
    setLabelFilters: (labels) =>
      set((state) => {
        const next = { ...state, labelFilters: labels };
        saveState(next);
        return next;
      }),
    setShowRecurringOnlyCompleted: (value) =>
      set((state) => {
        const next = { ...state, showRecurringOnlyCompleted: value };
        saveState(next);
        return next;
      }),
    toggleDarkMode: () =>
      set((state) => {
        const next = { ...state, darkMode: !state.darkMode };
        saveState(next);
        return next;
      }),
    setSidebarCollapsed: (value) =>
      set((state) => {
        const next = { ...state, sidebarCollapsed: value };
        saveState(next);
        return next;
      }),
    setSidebarWidth: (width) =>
      set((state) => {
        const next = { ...state, sidebarWidth: Math.max(280, Math.min(width, 520)) };
        saveState(next);
        return next;
      }),
    setSearchTerm: (value) =>
      set((state) => {
        const next = { ...state, searchTerm: value };
        saveState(next);
        return next;
      }),
    setActiveTaskId: (taskId) =>
      set((state) => {
        const next = { ...state, activeTaskId: taskId };
        saveState(next);
        return next;
      }),
    exportActiveWeekAsJson: () => {
      const state = get();
      const week = state.weeks.find((item) => item.id === state.activeWeekId);
      if (!week) return '';

      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          label: `Week-${format(week.days[0].date, 'yyyy-MM-dd')}`,
          week: {
            ...week,
            days: week.days.map((day) => ({
              ...day,
              date: day.date.toISOString(),
              tasksRoot: day.tasksRoot.map(serializeTask),
            })),
          },
        },
        null,
        2,
      );
    },
    importWeekFromJson: (json) => {
      try {
        const parsed = JSON.parse(json) as { week?: PersistWeek };
        if (!parsed.week?.days || parsed.week.days.length !== 7) {
          return { ok: false, reason: 'Invalid week data. Expected 7 days.' };
        }

        const importedWeek: Week = {
          id: uuidv4(),
          days: parsed.week.days.map((day) => ({
            date: new Date(day.date),
            tasksRoot: day.tasksRoot.map(deserializeTask),
          })),
        };

        set((state) => {
          const next = {
            ...state,
            weeks: [...state.weeks, importedWeek],
            activeWeekId: importedWeek.id,
          };
          saveState(next);
          return next;
        });

        return { ok: true };
      } catch {
        return { ok: false, reason: 'Failed to parse JSON.' };
      }
    },
  };

  if (typeof window !== 'undefined') {
    saveState(initialState);
  }

  return initialState;
});
