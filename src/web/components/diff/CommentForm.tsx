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
    <form onSubmit={handleSubmit} className="ml-[6.25rem] mr-4 my-2 bg-white border border-blue-200 rounded-lg shadow-sm">
      <div className="p-3 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          autoFocus
          disabled={loading}
        />

        {showSuggestion && !showSuggestionField && (
          <button
            type="button"
            onClick={() => setShowSuggestionField(true)}
            className="text-xs text-purple-600 hover:text-purple-700"
          >
            + Add code suggestion
          </button>
        )}

        {showSuggestionField && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Code suggestion</label>
              <button
                type="button"
                onClick={() => {
                  setShowSuggestionField(false);
                  setSuggestion('');
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Remove
              </button>
            </div>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Paste or type the suggested code..."
              className="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={4}
              disabled={loading}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || loading}
            className={cn(
              'px-3 py-1.5 text-sm font-medium text-white rounded-lg',
              content.trim() && !loading
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            {loading ? 'Adding...' : 'Add Comment'}
          </button>
        </div>
      </div>
    </form>
  );
}
