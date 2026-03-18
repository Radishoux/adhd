import { useEffect } from 'react';

interface ShortcutHandlers {
  onNewTask: () => void;
  onSearch: () => void;
  onCancelEdit: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingInInput = !!target?.closest('input, textarea, [contenteditable=true]');

      if (event.key.toLowerCase() === 'n' && !typingInInput) {
        event.preventDefault();
        handlers.onNewTask();
      }

      if (event.key === '/' && !typingInInput) {
        event.preventDefault();
        handlers.onSearch();
      }

      if (event.key === 'Escape') {
        handlers.onCancelEdit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
