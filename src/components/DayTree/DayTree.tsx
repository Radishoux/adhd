import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Columns2, PlusSquare } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import type { Task } from '../../types/planner';
import { DND_ITEM_TYPES } from '../../types/dnd';
import { TaskNode } from '../TaskNode/TaskNode';

interface DayTreeProps {
  dayIndex: number;
  date: Date;
  tasks: Task[];
  allTasks: Task[];
  onDropPoolTask: (taskId: string, dayIndex: number) => void;
  onDropCompletedTask: (taskId: string, dayIndex: number) => void;
  onMoveAcrossDays: (fromDay: number, toDay: number, taskId: string) => void;
  onReorderRoot: (dayIndex: number, activeTaskId: string, overTaskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onAddSubtask: (parentTaskId: string, name: string) => void;
  onSetDependencies: (taskId: string, deps: string[]) => { ok: boolean; reason?: string };
  onCreateSlot: (dayIndex: number, mode: 'single' | 'split') => void;
}

interface SortableTaskCardProps {
  task: Task;
  dayIndex: number;
  allTasks: Task[];
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onAddSubtask: (parentTaskId: string, name: string) => void;
  onSetDependencies: (taskId: string, deps: string[]) => { ok: boolean; reason?: string };
}

function SortableTaskCard({
  task,
  dayIndex,
  allTasks,
  onToggleComplete,
  onUpdateTask,
  onAddSubtask,
  onSetDependencies,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: DND_ITEM_TYPES.PLANNED_TASK,
      item: { type: DND_ITEM_TYPES.PLANNED_TASK, taskId: task.id, fromDayIndex: dayIndex },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [task.id, dayIndex],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        ref={(node) => {
          dragRef(node);
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mb-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300"
          aria-label={`Drag handle for ${task.name}`}
        >
          Drag
        </button>
        <TaskNode
          task={task}
          dayIndex={dayIndex}
          allTasks={allTasks}
          onToggleComplete={onToggleComplete}
          onUpdate={onUpdateTask}
          onAddSubtask={onAddSubtask}
          onSetDependencies={onSetDependencies}
        />
      </div>
    </div>
  );
}

export function DayTree({
  dayIndex,
  date,
  tasks,
  allTasks,
  onDropPoolTask,
  onDropCompletedTask,
  onMoveAcrossDays,
  onReorderRoot,
  onToggleComplete,
  onUpdateTask,
  onAddSubtask,
  onSetDependencies,
  onCreateSlot,
}: DayTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: [DND_ITEM_TYPES.POOL_TASK, DND_ITEM_TYPES.COMPLETED_TASK, DND_ITEM_TYPES.PLANNED_TASK],
      drop: (item: { type: string; taskId: string; fromDayIndex?: number }) => {
        if (item.type === DND_ITEM_TYPES.POOL_TASK) {
          onDropPoolTask(item.taskId, dayIndex);
          return;
        }

        if (item.type === DND_ITEM_TYPES.COMPLETED_TASK) {
          onDropCompletedTask(item.taskId, dayIndex);
          return;
        }

        if (item.type === DND_ITEM_TYPES.PLANNED_TASK && item.fromDayIndex !== undefined && item.fromDayIndex !== dayIndex) {
          onMoveAcrossDays(item.fromDayIndex, dayIndex, item.taskId);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
      }),
    }),
    [dayIndex, onDropPoolTask, onDropCompletedTask, onMoveAcrossDays],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderRoot(dayIndex, String(active.id), String(over.id));
  };

  return (
    <div
      ref={(node) => {
        dropRef(node);
      }}
    >
      <motion.section
        layout
        className={`min-h-[420px] rounded-2xl border p-3 transition ${
          isOver ? 'border-cyan-400/70 bg-cyan-500/10' : 'border-white/10 bg-slate-950/30'
        }`}
        aria-label={`Planner for ${format(date, 'EEEE')}`}
      >
      <header className="mb-3 border-b border-white/10 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">{format(date, 'EEE')}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onCreateSlot(dayIndex, 'single')}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200"
              aria-label="Add single slot"
              title="Add slot"
            >
              <PlusSquare size={12} /> Slot
            </button>
            <button
              type="button"
              onClick={() => onCreateSlot(dayIndex, 'split')}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200"
              aria-label="Add split slot"
              title="Add split slot"
            >
              <Columns2 size={12} /> Split
            </button>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-100">{format(date, 'dd MMM')}</h3>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                dayIndex={dayIndex}
                allTasks={allTasks}
                onToggleComplete={onToggleComplete}
                onUpdateTask={onUpdateTask}
                onAddSubtask={onAddSubtask}
                onSetDependencies={onSetDependencies}
              />
            ))}
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-slate-400">
                Drag tasks here from pool or completed panel
              </div>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>
      </motion.section>
    </div>
  );
}
