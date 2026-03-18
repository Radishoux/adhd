export const DND_ITEM_TYPES = {
  POOL_TASK: 'POOL_TASK',
  COMPLETED_TASK: 'COMPLETED_TASK',
  PLANNED_TASK: 'PLANNED_TASK',
} as const;

export type DndItemType = (typeof DND_ITEM_TYPES)[keyof typeof DND_ITEM_TYPES];

export interface PoolTaskDragItem {
  type: typeof DND_ITEM_TYPES.POOL_TASK;
  taskId: string;
}

export interface CompletedTaskDragItem {
  type: typeof DND_ITEM_TYPES.COMPLETED_TASK;
  taskId: string;
}

export interface PlannedTaskDragItem {
  type: typeof DND_ITEM_TYPES.PLANNED_TASK;
  taskId: string;
  fromDayIndex: number;
}
