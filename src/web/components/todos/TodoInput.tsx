/**
 * Todo input component for adding new todos
 */
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

interface TodoInputProps {
  onAdd: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TodoInput({ onAdd, disabled, placeholder = 'Add a todo...' }: TodoInputProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed) {
      onAdd(trimmed);
      setContent('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setContent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'gh-input flex-1 text-sm',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <button
        type="submit"
        disabled={disabled || !content.trim()}
        className={cn(
          'gh-btn gh-btn-primary text-sm',
          (disabled || !content.trim()) && 'opacity-50 cursor-not-allowed'
        )}
      >
        Add
      </button>
    </form>
  );
}
