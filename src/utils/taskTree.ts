import { v4 as uuidv4 } from 'uuid';
import type { Label, Task } from '../types/planner';

export function cloneTask(task: Task): Task {
  return {
    ...task,
    id: uuidv4(),
    labels: task.labels.map((label) => ({ ...label })),
    history: task.history.map((entry) => ({ ...entry, timestamp: new Date(entry.timestamp) })),
    subtasks: task.subtasks.map(cloneTask),
  };
}

export function flattenTasks(tasks: Task[]): Task[] {
  const output: Task[] = [];
  const walk = (nodes: Task[]) => {
    nodes.forEach((node) => {
      output.push(node);
      walk(node.subtasks);
    });
  };
  walk(tasks);
  return output;
}

export function findTaskById(tasks: Task[], taskId: string): Task | undefined {
  for (const task of tasks) {
    if (task.id === taskId) {
      return task;
    }
    const nested = findTaskById(task.subtasks, taskId);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function removeTaskById(tasks: Task[], taskId: string): { next: Task[]; removed?: Task } {
  let removed: Task | undefined;
  const next = tasks
    .filter((task) => {
      const keep = task.id !== taskId;
      if (!keep) {
        removed = task;
      }
      return keep;
    })
    .map((task) => {
      if (removed) {
        return task;
      }
      const result = removeTaskById(task.subtasks, taskId);
      if (result.removed) {
        removed = result.removed;
        return { ...task, subtasks: result.next };
      }
      return task;
    });

  return { next, removed };
}

export function insertTask(
  tasks: Task[],
  task: Task,
  options?: { parentId?: string; index?: number },
): Task[] {
  if (!options?.parentId) {
    const next = [...tasks];
    const targetIndex = options?.index ?? next.length;
    next.splice(targetIndex, 0, task);
    return next;
  }

  return tasks.map((node) => {
    if (node.id === options.parentId) {
      const subtasks = [...node.subtasks];
      const targetIndex = options.index ?? subtasks.length;
      subtasks.splice(targetIndex, 0, task);
      return { ...node, subtasks };
    }

    if (node.subtasks.length === 0) {
      return node;
    }

    return {
      ...node,
      subtasks: insertTask(node.subtasks, task, options),
    };
  });
}

export function updateTaskById(tasks: Task[], taskId: string, updater: (task: Task) => Task): Task[] {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return updater(task);
    }

    if (task.subtasks.length === 0) {
      return task;
    }

    return {
      ...task,
      subtasks: updateTaskById(task.subtasks, taskId, updater),
    };
  });
}

export function areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
  if (task.dependencies.length === 0) {
    return true;
  }

  return task.dependencies.every((depId) => {
    const depTask = allTasks.find((item) => item.id === depId);
    return depTask?.completed;
  });
}

export function ensureBlockedLabel(task: Task, blocked: boolean): Task {
  const blockedLabel: Label = { color: '#facc15', text: 'Blocked' };
  const hasBlocked = task.labels.some((label) => label.text.toLowerCase() === 'blocked');

  if (blocked && !hasBlocked) {
    return { ...task, labels: [...task.labels, blockedLabel] };
  }

  if (!blocked && hasBlocked) {
    return {
      ...task,
      labels: task.labels.filter((label) => label.text.toLowerCase() !== 'blocked'),
    };
  }

  return task;
}

export function toggleRecursiveCompletion(task: Task, completed: boolean): Task {
  return {
    ...task,
    completed,
    subtasks: task.subtasks.map((subtask) => toggleRecursiveCompletion(subtask, completed)),
  };
}

export function canMarkParentComplete(task: Task): boolean {
  if (task.subtasks.length === 0) {
    return true;
  }
  return task.subtasks.every((subtask) => subtask.completed);
}

export function reorderByIds(tasks: Task[], activeId: string, overId: string): Task[] {
  const oldIndex = tasks.findIndex((task) => task.id === activeId);
  const newIndex = tasks.findIndex((task) => task.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return tasks;
  }

  const next = [...tasks];
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}

export function listDependencyGraph(tasks: Task[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  flattenTasks(tasks).forEach((task) => {
    map.set(task.id, [...task.dependencies]);
  });
  return map;
}

export function introducesCycle(
  graph: Map<string, string[]>,
  taskId: string,
  nextDependencies: string[],
): boolean {
  const adjacency = new Map(graph);
  adjacency.set(taskId, nextDependencies);

  const visited = new Set<string>();
  const stack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (stack.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    stack.add(nodeId);

    const dependencies = adjacency.get(nodeId) ?? [];
    for (const depId of dependencies) {
      if (hasCycle(depId)) {
        return true;
      }
    }

    stack.delete(nodeId);
    return false;
  };

  for (const nodeId of adjacency.keys()) {
    if (hasCycle(nodeId)) {
      return true;
    }
  }

  return false;
}
