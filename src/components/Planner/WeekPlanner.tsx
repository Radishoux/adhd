import { useMemo } from 'react';
import type { Label, Task, Week } from '../../types/planner';
import { flattenTasks } from '../../utils/taskTree';
import { DayTree } from '../DayTree/DayTree';

interface WeekPlannerProps {
  week: Week;
  globalTasks: Task[];
  labelFilters: string[];
  searchTerm: string;
  onDropPoolTask: (taskId: string, dayIndex: number) => void;
  onDropCompletedTask: (taskId: string, dayIndex: number) => void;
  onMoveAcrossDays: (fromDay: number, toDay: number, taskId: string) => void;
  onReorderRoot: (dayIndex: number, activeTaskId: string, overTaskId: string) => void;
  onToggleComplete: (dayIndex: number, taskId: string, completed: boolean) => void;
  onUpdateTask: (dayIndex: number, taskId: string, patch: Partial<Task>) => void;
  onAddSubtask: (dayIndex: number, parentTaskId: string, name: string) => void;
  onSetDependencies: (dayIndex: number, taskId: string, deps: string[]) => { ok: boolean; reason?: string };
  onCreateSlot: (dayIndex: number, mode: 'single' | 'split') => void;
}

function matchesFilters(task: Task, filters: string[], searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const textMatch =
    !normalizedSearch ||
    task.name.toLowerCase().includes(normalizedSearch) ||
    task.description?.toLowerCase().includes(normalizedSearch);

  if (!textMatch) return false;

  if (!filters.length) return true;
  const set = new Set(task.labels.map((label) => label.text));
  return filters.every((label) => set.has(label));
}

function filterTree(tasks: Task[], filters: string[], searchTerm: string): Task[] {
  return tasks
    .map((task) => {
      const subtasks = filterTree(task.subtasks, filters, searchTerm);
      const includeSelf = matchesFilters(task, filters, searchTerm);

      if (includeSelf || subtasks.length) {
        return { ...task, subtasks };
      }
      return null;
    })
    .filter(Boolean) as Task[];
}

export function collectAllLabels(tasks: Task[]): Label[] {
  const map = new Map<string, Label>();
  flattenTasks(tasks).forEach((task) => {
    task.labels.forEach((label) => {
      map.set(label.text, label);
    });
  });
  return Array.from(map.values());
}

export function WeekPlanner({
  week,
  globalTasks,
  labelFilters,
  searchTerm,
  onDropPoolTask,
  onDropCompletedTask,
  onMoveAcrossDays,
  onReorderRoot,
  onToggleComplete,
  onUpdateTask,
  onAddSubtask,
  onSetDependencies,
  onCreateSlot,
}: WeekPlannerProps) {
  const allTasks = useMemo(() => {
    const inWeek = week.days.flatMap((day) => day.tasksRoot);
    return [...flattenTasks(inWeek), ...flattenTasks(globalTasks)];
  }, [week, globalTasks]);

  return (
    <div className="grid min-h-[70vh] grid-cols-7 gap-3 overflow-x-auto pb-6">
      {week.days.map((day, dayIndex) => (
        <DayTree
          key={day.date.toISOString()}
          dayIndex={dayIndex}
          date={day.date}
          tasks={filterTree(day.tasksRoot, labelFilters, searchTerm)}
          allTasks={allTasks}
          onDropPoolTask={onDropPoolTask}
          onDropCompletedTask={onDropCompletedTask}
          onMoveAcrossDays={onMoveAcrossDays}
          onReorderRoot={onReorderRoot}
          onToggleComplete={(taskId, completed) => onToggleComplete(dayIndex, taskId, completed)}
          onUpdateTask={(taskId, patch) => onUpdateTask(dayIndex, taskId, patch)}
          onAddSubtask={(parentTaskId, name) =>
            onAddSubtask(dayIndex, parentTaskId, name)
          }
          onSetDependencies={(taskId, deps) => onSetDependencies(dayIndex, taskId, deps)}
          onCreateSlot={onCreateSlot}
        />
      ))}
    </div>
  );
}
