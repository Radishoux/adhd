import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, RotateCcw } from 'lucide-react';
import { useDrag } from 'react-dnd';
import type { CompletedTaskRecord } from '../../types/planner';
import { DND_ITEM_TYPES } from '../../types/dnd';

interface CompletedTasksPanelProps {
  tasks: CompletedTaskRecord[];
  recurringOnly: boolean;
  onToggleRecurringOnly: (value: boolean) => void;
  onUncompleteToSourceDay: (taskId: string, dayIndex: number) => void;
}

function CompletedTaskCard({
  entry,
  onUncompleteToSourceDay,
}: {
  entry: CompletedTaskRecord;
  onUncompleteToSourceDay: (taskId: string, dayIndex: number) => void;
}) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: DND_ITEM_TYPES.COMPLETED_TASK,
      item: { type: DND_ITEM_TYPES.COMPLETED_TASK, taskId: entry.task.id },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [entry.task.id],
  );

  return (
    <motion.div
      ref={(node) => {
        dragRef(node);
      }}
      layout
      className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-emerald-100">{entry.task.name}</p>
          <p className="text-[11px] text-emerald-200/80">
            done {formatDistanceToNow(entry.completedAt, { addSuffix: true })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUncompleteToSourceDay(entry.task.id, entry.sourceDayIndex)}
          className="rounded-lg border border-white/20 bg-black/20 p-1 text-emerald-100"
          aria-label={`Send ${entry.task.name} back`}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export function CompletedTasksPanel({
  tasks,
  recurringOnly,
  onToggleRecurringOnly,
  onUncompleteToSourceDay,
}: CompletedTasksPanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCheck size={16} className="text-emerald-200" />
          <h2 className="text-sm uppercase tracking-[0.22em] text-emerald-100">Completed</h2>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Recurring only
          <input
            type="checkbox"
            checked={recurringOnly}
            onChange={(event) => onToggleRecurringOnly(event.target.checked)}
          />
        </label>
      </div>

      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        <AnimatePresence>
          {tasks.map((entry) => (
            <CompletedTaskCard
              key={entry.task.id}
              entry={entry}
              onUncompleteToSourceDay={onUncompleteToSourceDay}
            />
          ))}
        </AnimatePresence>
        {!tasks.length ? <p className="text-sm text-slate-400">No completed tasks yet.</p> : null}
      </div>
    </section>
  );
}
