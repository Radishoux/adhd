import { motion } from 'framer-motion';
import { Filter, Plus, Search, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { Label, NewTaskDraft, Task } from '../../types/planner';
import { DND_ITEM_TYPES } from '../../types/dnd';
import { LabelPicker } from '../LabelPicker/LabelPicker';

interface TaskCreationBarProps {
  tasks: Task[];
  availableLabels: Label[];
  savedLabels: Label[];
  selectedFilters: string[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onChangeFilters: (labels: string[]) => void;
  onSaveLabelTemplate: (label: Label) => void;
  onCreateTask: (draft: NewTaskDraft) => void;
  onTogglePoolTaskCompleted: (taskId: string, completed: boolean) => void;
  onMoveCompletedToPool: (taskId: string) => void;
  onMovePlannedToPool: (dayIndex: number, taskId: string) => void;
}

interface PoolTaskItemProps {
  task: Task;
  onComplete: (taskId: string) => void;
}

function PoolTaskItem({ task, onComplete }: PoolTaskItemProps) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: DND_ITEM_TYPES.POOL_TASK,
      item: { type: DND_ITEM_TYPES.POOL_TASK, taskId: task.id },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [task.id],
  );

  return (
    <div
      ref={(node) => {
        dragRef(node);
      }}
      className="rounded-xl border border-white/10 bg-slate-900/40 p-3"
      style={{ opacity: isDragging ? 0.5 : 1 }}
      aria-label={`Pool task ${task.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-100">{task.name}</p>
          {task.description ? <p className="text-xs text-slate-400">{task.description}</p> : null}
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
          </div>
        </div>
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function TaskCreationBar({
  tasks,
  availableLabels,
  savedLabels,
  selectedFilters,
  searchTerm,
  onSearchChange,
  onChangeFilters,
  onSaveLabelTemplate,
  onCreateTask,
  onTogglePoolTaskCompleted,
  onMoveCompletedToPool,
  onMovePlannedToPool,
}: TaskCreationBarProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [estimated, setEstimated] = useState<number | ''>('');
  const [recurring, setRecurring] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);

  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: [DND_ITEM_TYPES.COMPLETED_TASK, DND_ITEM_TYPES.PLANNED_TASK],
      drop: (item: { type: string; taskId: string; fromDayIndex?: number }) => {
        if (item.type === DND_ITEM_TYPES.COMPLETED_TASK) {
          onMoveCompletedToPool(item.taskId);
          return;
        }

        if (item.type === DND_ITEM_TYPES.PLANNED_TASK && item.fromDayIndex !== undefined) {
          onMovePlannedToPool(item.fromDayIndex, item.taskId);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
      }),
    }),
    [onMoveCompletedToPool, onMovePlannedToPool],
  );

  const filteredTasks = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (normalized && !task.name.toLowerCase().includes(normalized)) return false;
        if (!selectedFilters.length) return true;
        const labelsSet = new Set(task.labels.map((label) => label.text));
        return selectedFilters.every((filter) => labelsSet.has(filter));
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, searchTerm, selectedFilters]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    onCreateTask({
      name: trimmed,
      description: description.trim(),
      labels,
      estimatedTime: estimated === '' ? undefined : Number(estimated),
      recurring,
    });

    setName('');
    setDescription('');
    setEstimated('');
    setRecurring(false);
    setLabels([]);
  };

  const toggleFilter = (text: string) => {
    if (selectedFilters.includes(text)) {
      onChangeFilters(selectedFilters.filter((filter) => filter !== text));
      return;
    }
    onChangeFilters([...selectedFilters, text]);
  };

  return (
    <section
      ref={(node) => {
        dropRef(node);
      }}
      className={`space-y-4 rounded-2xl border p-4 ${
        isOver ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40'
      }`}
      aria-label="Task creation and pool"
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.25em] text-cyan-100">Task Creation</h2>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300">Drop back here</span>
        </div>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Task name"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
          aria-label="Task name"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
          aria-label="Task description"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
            <Timer size={14} />
            <input
              aria-label="Estimated time in minutes"
              type="number"
              min={0}
              value={estimated}
              onChange={(event) => setEstimated(event.target.value ? Number(event.target.value) : '')}
              className="w-full bg-transparent outline-none"
              placeholder="Estimated min"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200">
            Recurring
            <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
          </label>
        </div>

        <LabelPicker
          value={labels}
          onChange={setLabels}
          savedLabels={savedLabels}
          onSaveLabelTemplate={onSaveLabelTemplate}
        />

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-500/30"
        >
          <Plus size={15} /> Add to global pool
        </button>
      </form>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-200">
          <Search size={14} />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks (shortcut /)"
            className="w-full bg-transparent outline-none"
            aria-label="Search tasks"
          />
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs text-slate-200">
          <Filter size={14} />
          <div className="flex flex-wrap gap-1">
            {availableLabels.length ? (
              availableLabels.map((label) => (
                <button
                  key={label.text}
                  type="button"
                  onClick={() => toggleFilter(label.text)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    selectedFilters.includes(label.text) ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/20 text-slate-300'
                  }`}
                >
                  {label.text}
                </button>
              ))
            ) : (
              <span className="text-[11px] text-slate-400">No labels yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-h-[34vh] space-y-2 overflow-auto pr-1">
        {filteredTasks.map((task, index) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
            <PoolTaskItem task={task} onComplete={(taskId) => onTogglePoolTaskCompleted(taskId, true)} />
          </motion.div>
        ))}
        {!filteredTasks.length ? <p className="text-sm text-slate-400">No tasks match current filters.</p> : null}
      </div>
    </section>
  );
}
