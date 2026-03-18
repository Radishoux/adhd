import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Label } from '../../types/planner';

interface LabelPickerProps {
  value: Label[];
  onChange: (labels: Label[]) => void;
}

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#14b8a6', '#3b82f6', '#ec4899'];

export function LabelPicker({ value, onChange }: LabelPickerProps) {
  const [text, setText] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const taken = useMemo(() => new Set(value.map((label) => label.text.toLowerCase())), [value]);

  const addLabel = () => {
    const trimmed = text.trim();
    if (!trimmed || taken.has(trimmed.toLowerCase())) return;

    onChange([...value, { color, text: trimmed }]);
    setText('');
  };

  const removeLabel = (labelText: string) => {
    onChange(value.filter((label) => label.text !== labelText));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((label) => (
          <button
            key={label.text}
            type="button"
            onClick={() => removeLabel(label.text)}
            className="inline-flex items-center rounded-full border border-white/10 px-2 py-1 text-xs text-white"
            style={{ backgroundColor: label.color }}
            aria-label={`Remove label ${label.text}`}
          >
            {label.text}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          aria-label="Label text"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          placeholder="Add label"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <input
          aria-label="Label color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-10 rounded border border-white/10 bg-transparent"
        />
        <button
          type="button"
          onClick={addLabel}
          className="rounded-lg border border-white/10 bg-white/10 p-2 text-slate-100 transition hover:bg-white/20"
          aria-label="Add label"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
