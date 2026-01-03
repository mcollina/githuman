/**
 * CommentForm - form for adding a new comment
 */
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface CommentFormProps {
  onSubmit: (content: string, suggestion?: string) => void;
  onCancel: () => void;
  loading?: boolean;
  showSuggestion?: boolean;
}

export function CommentForm({ onSubmit, onCancel, loading, showSuggestion = true }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [showSuggestionField, setShowSuggestionField] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim(), showSuggestionField && suggestion.trim() ? suggestion.trim() : undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-2 sm:ml-[6.25rem] sm:mr-4 my-2 gh-card border-[var(--gh-accent-primary)]/30">
      <div className="p-3 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="gh-input w-full text-sm resize-none"
          rows={3}
          autoFocus
          disabled={loading}
        />

        {showSuggestion && !showSuggestionField && (
          <button
            type="button"
            onClick={() => setShowSuggestionField(true)}
            className="text-xs text-[var(--gh-accent-secondary)] hover:text-[var(--gh-accent-secondary)]/80 transition-colors"
          >
            + Add code suggestion
          </button>
        )}

        {showSuggestionField && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--gh-accent-secondary)]">Code suggestion</label>
              <button
                type="button"
                onClick={() => {
                  setShowSuggestionField(false);
                  setSuggestion('');
                }}
                className="text-xs text-[var(--gh-text-muted)] hover:text-[var(--gh-text-secondary)] transition-colors"
              >
                Remove
              </button>
            </div>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Paste or type the suggested code..."
              className="gh-input w-full text-sm font-mono resize-none"
              rows={4}
              disabled={loading}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || loading}
            className={cn(
              'gh-btn gh-btn-primary text-sm py-1.5',
              (!content.trim() || loading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Adding...' : 'Add Comment'}
          </button>
        </div>
      </div>
    </form>
  );
}
