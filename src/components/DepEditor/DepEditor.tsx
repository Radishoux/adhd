import { useMemo, useState } from 'react';
import type { Task } from '../../types/planner';

interface DepEditorProps {
  currentTaskId: string;
  allTasks: Task[];
  selected: string[];
  onApply: (deps: string[]) => { ok: boolean; reason?: string };
}

export function DepEditor({ currentTaskId, allTasks, selected, onApply }: DepEditorProps) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);
  const [error, setError] = useState<string | undefined>();

  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allTasks
      .filter((task) => task.id !== currentTaskId)
      .filter((task) => task.name.toLowerCase().includes(normalized))
      .slice(0, 20);
  }, [allTasks, currentTaskId, query]);

  const toggle = (id: string) => {
    setDraft((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const apply = () => {
    const result = onApply(draft);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(undefined);
  };

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-400"
        placeholder="Search dependencies"
        aria-label="Search dependencies"
      />
      <div className="max-h-32 space-y-1 overflow-auto">
        {candidates.map((task) => (
          <label key={task.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
            <input type="checkbox" checked={draft.includes(task.id)} onChange={() => toggle(task.id)} />
            <span className="truncate">{task.name}</span>
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      <button
        type="button"
        onClick={apply}
        className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30"
      >
        Apply dependencies
      </button>
    </div>
  );
}
