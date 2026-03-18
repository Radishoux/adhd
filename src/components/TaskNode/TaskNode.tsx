import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderTree,
  Link2,
  Pencil,
  Plus,
  SquareSplitHorizontal,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task } from '../../types/planner';
import { areDependenciesSatisfied, flattenTasks } from '../../utils/taskTree';
import { DepEditor } from '../DepEditor/DepEditor';

interface TaskNodeProps {
  task: Task;
  dayIndex: number;
  depth?: number;
  allTasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onUpdate: (taskId: string, patch: Partial<Task>) => void;
  onAddSubtask: (parentTaskId: string, name: string) => void;
  onSetDependencies: (taskId: string, deps: string[]) => { ok: boolean; reason?: string };
}

export function TaskNode({
  task,
  dayIndex,
  depth = 0,
  allTasks,
  onToggleComplete,
  onUpdate,
  onAddSubtask,
  onSetDependencies,
}: TaskNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [draftName, setDraftName] = useState(task.name);
  const [draftDesc, setDraftDesc] = useState(task.description ?? '');
  const [subtaskName, setSubtaskName] = useState('');
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [splitChoice, setSplitChoice] = useState(0);

  const blocked = useMemo(() => !areDependenciesSatisfied(task, allTasks), [task, allTasks]);
  const hasSplitLabel = task.labels.some((label) => label.text.toLowerCase() === 'split');

  const applyEdit = () => {
    onUpdate(task.id, {
      name: draftName.trim() || task.name,
      description: draftDesc,
    });
    setEditing(false);
  };

  const addSubtask = () => {
    const name = subtaskName.trim();
    if (!name) return;
    onAddSubtask(task.id, name);
    setSubtaskName('');
    setExpanded(true);
  };

  const toggleTimer = () => {
    if (!timerStart) {
      setTimerStart(Date.now());
      return;
    }

    const minutes = Math.max(1, Math.round((Date.now() - timerStart) / 60000));
    onUpdate(task.id, {
      history: [
        ...task.history,
        {
          timestamp: new Date(),
          durationMinutes: minutes,
          note: 'Timer session',
        },
      ],
    });
    setTimerStart(null);
  };

  const dependencyNames = useMemo(() => {
    if (!task.dependencies.length) return [];
    const map = new Map(flattenTasks(allTasks).map((item) => [item.id, item.name]));
    return task.dependencies.map((depId) => map.get(depId)).filter(Boolean) as string[];
  }, [allTasks, task.dependencies]);

  const visibleSubtasks = hasSplitLabel && task.subtasks.length > 1 ? [task.subtasks[splitChoice]] : task.subtasks;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
      style={{ marginLeft: depth * 16 }}
    >
      <div
        className={`rounded-xl border p-3 shadow-sm backdrop-blur-sm transition ${
          task.completed
            ? 'border-emerald-400/40 bg-emerald-500/10'
            : blocked
              ? 'border-amber-300/50 bg-amber-500/10'
              : 'border-white/10 bg-slate-900/50'
        }`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-0.5 rounded p-1 text-slate-300 transition hover:bg-white/10"
            aria-label={expanded ? 'Collapse task' : 'Expand task'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <input
            type="checkbox"
            checked={task.completed}
            disabled={blocked}
            onChange={(event) => onToggleComplete(task.id, event.target.checked)}
            className="mt-1 h-4 w-4"
            aria-label={`Mark ${task.name} complete`}
          />

          <div className="min-w-0 flex-1" onDoubleClick={() => setEditing(true)}>
            {editing ? (
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-slate-100"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={applyEdit}
                  autoFocus
                />
                <textarea
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-200"
                  value={draftDesc}
                  onChange={(event) => setDraftDesc(event.target.value)}
                  onBlur={applyEdit}
                  rows={2}
                />
              </div>
            ) : (
              <>
                <p className="truncate text-sm font-medium text-slate-100">{task.name}</p>
                {task.description ? <p className="mt-1 text-xs text-slate-400">{task.description}</p> : null}
              </>
            )}

            <div className="mt-2 flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <span
                  key={`${task.id}-${label.text}`}
                  className="rounded-full px-2 py-0.5 text-[11px] text-slate-950"
                  style={{ backgroundColor: label.color }}
                >
                  {label.text}
                </span>
              ))}
              {task.estimatedTime ? (
                <span className="rounded-full border border-cyan-400/40 px-2 py-0.5 text-[11px] text-cyan-100">
                  {task.estimatedTime}m est
                </span>
              ) : null}
            </div>

            {dependencyNames.length ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-200">
                <Link2 size={12} /> Depends on: {dependencyNames.join(', ')}
              </p>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTimer}
              className={`rounded p-1 transition ${timerStart ? 'bg-rose-500/20 text-rose-200' : 'text-slate-300 hover:bg-white/10'}`}
              aria-label={timerStart ? 'Stop timer' : 'Start timer'}
            >
              <Clock3 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowDeps((prev) => !prev)}
              className="rounded p-1 text-slate-300 transition hover:bg-white/10"
              aria-label="Edit dependencies"
            >
              <FolderTree size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="rounded p-1 text-slate-300 transition hover:bg-white/10"
              aria-label="Edit task"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleComplete(task.id, true)}
              className="rounded p-1 text-slate-300 transition hover:bg-white/10"
              aria-label="Complete task"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {showDeps ? (
          <div className="mt-3">
            <DepEditor
              currentTaskId={task.id}
              allTasks={allTasks}
              selected={task.dependencies}
              onApply={(deps) => onSetDependencies(task.id, deps)}
            />
          </div>
        ) : null}

        {expanded ? (
          <div className="mt-2 space-y-2 border-l border-white/10 pl-3">
            <div className="flex items-center gap-2">
              <input
                value={subtaskName}
                onChange={(event) => setSubtaskName(event.target.value)}
                placeholder="New subtask"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-100"
                aria-label="Add subtask"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="rounded-lg border border-white/10 bg-white/10 p-1 text-slate-100 transition hover:bg-white/20"
                aria-label="Add subtask"
              >
                <Plus size={14} />
              </button>
            </div>

            {hasSplitLabel && task.subtasks.length > 1 ? (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <SquareSplitHorizontal size={13} />
                <span>Choose next branch:</span>
                <select
                  className="rounded border border-white/10 bg-black/30 px-2 py-1"
                  value={splitChoice}
                  onChange={(event) => setSplitChoice(Number(event.target.value))}
                >
                  {task.subtasks.map((sub, index) => (
                    <option key={sub.id} value={index}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {visibleSubtasks.map((subtask) => (
              <TaskNode
                key={subtask.id}
                task={subtask}
                dayIndex={dayIndex}
                depth={depth + 1}
                allTasks={allTasks}
                onToggleComplete={onToggleComplete}
                onUpdate={onUpdate}
                onAddSubtask={onAddSubtask}
                onSetDependencies={onSetDependencies}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
