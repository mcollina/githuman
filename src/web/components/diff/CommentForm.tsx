/**
 * CommentForm - form for adding a new comment
 * On mobile, renders as a bottom sheet for better keyboard handling
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface CommentFormProps {
  onSubmit: (content: string, suggestion?: string) => void;
  onCancel: () => void;
  loading?: boolean;
  showSuggestion?: boolean;
  lineContent?: string;
  lineNumber?: number | null;
}

export function CommentForm({ onSubmit, onCancel, loading, showSuggestion = true, lineContent, lineNumber }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [showSuggestionField, setShowSuggestionField] = useState(false);
  const isMobile = useIsMobile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim(), showSuggestionField && suggestion.trim() ? suggestion.trim() : undefined);
  };

  const formContent = (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'gh-card border-[var(--gh-accent-primary)]/30',
        isMobile ? 'mx-0 my-0 rounded-b-none' : 'mx-2 sm:ml-[6.25rem] sm:mr-4 my-2'
      )}
    >
      <div className="p-3 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="gh-input w-full text-base resize-none"
          rows={isMobile ? 4 : 3}
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
              className="gh-input w-full text-base font-mono resize-none"
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

  // On mobile, render as a bottom sheet modal
  if (isMobile) {
    return createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={onCancel}
        />
        {/* Bottom sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--gh-bg-secondary)] rounded-t-xl shadow-xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between p-3 border-b border-[var(--gh-border)]">
            <div className="flex-1 min-w-0 mr-2">
              <h3 className="font-semibold text-[var(--gh-text-primary)]">
                Add Comment
                {lineNumber != null && (
                  <span className="ml-2 text-xs font-normal text-[var(--gh-text-muted)]">
                    Line {lineNumber}
                  </span>
                )}
              </h3>
              {lineContent && (
                <pre className="mt-1 text-xs font-mono text-[var(--gh-text-secondary)] bg-[var(--gh-bg-primary)] px-2 py-1 rounded truncate overflow-hidden">
                  {lineContent}
                </pre>
              )}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 text-[var(--gh-text-muted)] hover:text-[var(--gh-text-primary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {formContent}
        </div>
      </>,
      document.body
    );
  }

  return formContent;
}
