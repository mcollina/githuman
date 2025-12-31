/**
 * Keyboard shortcuts hook for review navigation
 */
import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  onNextFile?: () => void;
  onPrevFile?: () => void;
  onToggleComment?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onNextFile,
  onPrevFile,
  onToggleComment,
  onEscape,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Still handle Escape in inputs
        if (event.key === 'Escape' && onEscape) {
          onEscape();
        }
        return;
      }

      switch (event.key) {
        case 'j':
          // Next file
          event.preventDefault();
          onNextFile?.();
          break;
        case 'k':
          // Previous file
          event.preventDefault();
          onPrevFile?.();
          break;
        case 'c':
          // Toggle comment mode (could be used to focus first uncommented line)
          event.preventDefault();
          onToggleComment?.();
          break;
        case 'Escape':
          event.preventDefault();
          onEscape?.();
          break;
      }
    },
    [onNextFile, onPrevFile, onToggleComment, onEscape]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

// Help text for keyboard shortcuts
export const keyboardShortcuts = [
  { key: 'j', description: 'Next file' },
  { key: 'k', description: 'Previous file' },
  { key: 'c', description: 'Add comment' },
  { key: 'Esc', description: 'Cancel / Close' },
];
