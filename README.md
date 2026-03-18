# Advanced Week Planner Todo

Power-user weekly planning app built with Bun, Vite, React, and TypeScript.

The app combines:
1. A 7-day planner grid
2. Per-day task trees with subtasks
3. Dependencies and blocked-state logic
4. Global task creation pool
5. Completed-task workflow with drag-back behavior

## Highlights

1. Strong TypeScript models for tasks, days, weeks, labels, and history
2. Local persistence using browser localStorage
3. Drag and drop using:
   1. react-dnd for cross-zone movement
   2. dnd-kit for sortable day root lists
4. Recursive task nodes with inline editing
5. Dependency editor with circular dependency validation
6. Week lifecycle controls:
   1. Create week
   2. Copy week
   3. Switch between weeks
7. JSON export and import for week data
8. Keyboard shortcuts
9. Dark mode toggle
10. Motion and transitions with Framer Motion

## Tech Stack

1. Runtime and package manager: Bun
2. Frontend: React 19 + TypeScript
3. Bundler: Vite
4. Styling: Tailwind CSS
5. State: Zustand
6. Drag and drop: react-dnd + dnd-kit
7. Icons: Lucide React
8. Animation: Framer Motion
9. Date handling: date-fns
10. IDs: uuid

## Quick Start

Requirements:
1. Bun 1.0+

Install and run:

1. bun install
2. bun dev

Build:

1. bun run build

Preview production build:

1. bun run preview

## Keyboard Shortcuts

1. N: open/focus new task flow
2. /: focus search
3. Esc: blur/cancel current edit focus

## Data Model

Core model used in source:

1. Label with color and text
2. HistoryEntry with timestamp, durationMinutes, and optional note
3. Task with:
   1. name and description
   2. completion status
   3. recursive subtasks
   4. dependencies list
   5. labels
   6. history
   7. optional estimatedTime and recurring flags
4. Day with date and root task nodes
5. Week with seven day entries

See source models in src/types/planner.ts.

## Main UX Flows

1. Create tasks in the right sidebar and keep them in the global pool
2. Drag pool tasks into any day in the planner
3. Organize day tasks in tree form with subtasks
4. Add and validate dependencies between tasks
5. Complete tasks and review them in the Completed panel
6. Drag completed tasks back into planner days
7. Copy a week to carry structure forward while resetting completion
8. Export or import week JSON snapshots

## Project Structure

1. src/App.tsx: app shell, providers, top-level layout, week controls
2. src/stores/useWeekStore.ts: global planner state, actions, persistence
3. src/components/Planner: planner container and week grid orchestration
4. src/components/DayTree: day column and root-level sorting/drop behavior
5. src/components/TaskNode: recursive task UI and inline edits
6. src/components/DepEditor: dependency selection + validation feedback
7. src/components/Sidebar: creation bar and completed panel
8. src/components/LabelPicker: label creation and color selection
9. src/utils/taskTree.ts: immutable tree utilities and dependency helpers
10. src/hooks/useKeyboardShortcuts.ts: global hotkey handling

## Persistence

Planner state is stored in localStorage under:

1. advanced-week-planner-v1

Saved state includes:
1. weeks and active week id
2. global task pool
3. completed tasks records
4. UI preferences such as dark mode and sidebar width

## Accessibility Notes

The app includes:
1. ARIA labels on core controls
2. Keyboard shortcuts for key flows
3. Touch-compatible drag backend fallback

Further accessibility improvements are possible, especially for full keyboard drag simulation and richer announcements.

## Current Limits and Next Improvements

Current behavior:
1. Root task ordering inside a day is sortable
2. Nested subtasks are rendered and editable recursively
3. Cross-day drag supports moving planned tasks at task-root level

Potential next upgrades:
1. Full nested drag-and-drop reorder for subtasks
2. Visual dependency connectors between nodes
3. Multi-select/group drag interactions
4. Advanced time-slot scheduling UI beyond tree layout

## Scripts

1. bun dev: run local Vite dev server
2. bun run build: type-check and build production bundle
3. bun run preview: preview production build
4. bun run lint: run ESLint

## License

No license file is currently included in this repository.
