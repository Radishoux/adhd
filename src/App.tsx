import { useMemo, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Moon, PanelRightClose, PanelRightOpen, Plus, Sun, Upload } from 'lucide-react';
import { WeekPlanner, collectAllLabels } from './components/Planner/WeekPlanner';
import { CompletedTasksPanel } from './components/Sidebar/CompletedTasksPanel';
import { TaskCreationBar } from './components/Sidebar/TaskCreationBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWeekStore } from './stores/useWeekStore';

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function App() {
  const {
    weeks,
    activeWeekId,
    globalTaskPool,
    completedTasks,
    labelFilters,
    showRecurringOnlyCompleted,
    darkMode,
    sidebarCollapsed,
    sidebarWidth,
    searchTerm,
    createTaskInPool,
    placePoolTaskIntoDay,
    moveCompletedTaskToDay,
    moveTaskAcrossDays,
    reorderDayRootTasks,
    toggleTaskCompleted,
    updateTask,
    addSubtask,
    setTaskDependencies,
    createWeek,
    copyActiveWeek,
    setActiveWeek,
    setLabelFilters,
    setShowRecurringOnlyCompleted,
    toggleDarkMode,
    setSidebarCollapsed,
    setSidebarWidth,
    setSearchTerm,
    exportActiveWeekAsJson,
    importWeekFromJson,
    togglePoolTaskCompleted,
    returnCompletedTaskToPool,
    moveTaskToPool,
  } = useWeekStore();

  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
  const resizeOrigin = useRef<{ startX: number; startWidth: number } | null>(null);

  const activeWeek = useMemo(
    () => weeks.find((week) => week.id === activeWeekId) ?? weeks[0],
    [weeks, activeWeekId],
  );

  const allLabels = useMemo(
    () =>
      collectAllLabels([
        ...globalTaskPool,
        ...(activeWeek?.days.flatMap((day) => day.tasksRoot) ?? []),
      ]),
    [globalTaskPool, activeWeek],
  );

  const filteredCompleted = useMemo(() => {
    return completedTasks.filter((entry) => {
      if (!showRecurringOnlyCompleted) return true;
      return entry.task.recurring || entry.task.labels.some((label) => label.text.toLowerCase() === 'recurring');
    });
  }, [completedTasks, showRecurringOnlyCompleted]);

  useKeyboardShortcuts({
    onNewTask: () => {
      setSidebarCollapsed(false);
      window.requestAnimationFrame(() => {
        const element = document.querySelector('input[aria-label="Task name"]') as HTMLInputElement | null;
        element?.focus();
      });
    },
    onSearch: () => {
      setSidebarCollapsed(false);
      window.requestAnimationFrame(() => {
        const element = document.querySelector('input[aria-label="Search tasks"]') as HTMLInputElement | null;
        element?.focus();
      });
    },
    onCancelEdit: () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
  });

  const onResizeMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    resizeOrigin.current = { startX: event.clientX, startWidth: sidebarWidth };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeOrigin.current) return;
      const delta = resizeOrigin.current.startX - moveEvent.clientX;
      setSidebarWidth(resizeOrigin.current.startWidth + delta);
    };

    const onMouseUp = () => {
      resizeOrigin.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const downloadWeek = () => {
    const json = exportActiveWeekAsJson();
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'week-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyImport = () => {
    const result = importWeekFromJson(importValue);
    if (result.ok) {
      setImportValue('');
      setImportOpen(false);
    } else {
      alert(result.reason);
    }
  };

  return (
    <DndProvider backend={isTouchDevice() ? TouchBackend : HTML5Backend} options={{ enableMouseEvents: true }}>
      <div className={darkMode ? 'dark min-h-screen bg-board-dark text-slate-100' : 'min-h-screen bg-board text-slate-100'}>
        <div className="app-shell mx-auto flex min-h-screen max-w-[1800px] gap-3 px-3 py-3 lg:px-5 lg:py-5">
          <main className="relative min-w-0 flex-1 rounded-3xl border border-white/10 bg-slate-950/40 p-3 lg:p-4">
            <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">Advanced Week Planner</p>
                <h1 className="font-heading text-3xl leading-tight text-white lg:text-4xl">Notion-style tree + dependency scheduling</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={createWeek}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100"
                >
                  <Plus size={15} /> New week
                </button>
                <button
                  type="button"
                  onClick={copyActiveWeek}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100"
                >
                  Copy week
                </button>
                <button
                  type="button"
                  onClick={downloadWeek}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100"
                >
                  <Download size={14} /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-slate-100"
                >
                  <Upload size={14} /> Import
                </button>
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="rounded-lg border border-white/20 bg-white/10 p-2 text-slate-100"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </header>

            <div className="mb-4 flex gap-2 overflow-auto pb-1">
              {weeks.map((week, index) => (
                <button
                  key={week.id}
                  type="button"
                  onClick={() => setActiveWeek(week.id)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    week.id === activeWeekId
                      ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  Week {index + 1}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {importOpen ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  <textarea
                    value={importValue}
                    onChange={(event) => setImportValue(event.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100"
                    placeholder="Paste exported week JSON"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={applyImport}
                      className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm text-cyan-100"
                    >
                      Import week
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {activeWeek ? (
              <WeekPlanner
                week={activeWeek}
                globalTasks={globalTaskPool}
                labelFilters={labelFilters}
                searchTerm={searchTerm}
                onDropPoolTask={placePoolTaskIntoDay}
                onDropCompletedTask={moveCompletedTaskToDay}
                onMoveAcrossDays={moveTaskAcrossDays}
                onReorderRoot={reorderDayRootTasks}
                onToggleComplete={toggleTaskCompleted}
                onUpdateTask={updateTask}
                onAddSubtask={(dayIndex, parentTaskId, name) =>
                  addSubtask(dayIndex, parentTaskId, { name, labels: [] })
                }
                onSetDependencies={setTaskDependencies}
              />
            ) : null}
          </main>

          <aside
            className={`relative transition-all duration-300 ${sidebarCollapsed ? 'w-[52px]' : ''}`}
            style={{ width: sidebarCollapsed ? 52 : sidebarWidth }}
          >
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute -left-3 top-3 z-20 rounded-full border border-white/20 bg-slate-950/90 p-1 text-slate-200"
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
            </button>

            {!sidebarCollapsed ? (
              <button
                type="button"
                onMouseDown={onResizeMouseDown}
                className="absolute -left-1 top-0 h-full w-2 cursor-col-resize"
                aria-label="Resize sidebar"
              />
            ) : null}

            <AnimatePresence>
              {!sidebarCollapsed ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex h-full flex-col gap-3"
                >
                  <TaskCreationBar
                    tasks={globalTaskPool}
                    availableLabels={allLabels}
                    selectedFilters={labelFilters}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onChangeFilters={setLabelFilters}
                    onCreateTask={createTaskInPool}
                    onTogglePoolTaskCompleted={togglePoolTaskCompleted}
                    onMoveCompletedToPool={returnCompletedTaskToPool}
                    onMovePlannedToPool={moveTaskToPool}
                  />

                  <CompletedTasksPanel
                    tasks={filteredCompleted}
                    recurringOnly={showRecurringOnlyCompleted}
                    onToggleRecurringOnly={setShowRecurringOnlyCompleted}
                    onUncompleteToSourceDay={moveCompletedTaskToDay}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </aside>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
