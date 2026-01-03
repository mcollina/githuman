/**
 * LineComment - displays a comment on a diff line
 */
import { useState } from 'react';
import { cn } from '../../lib/utils';
import type { Comment } from '../../../shared/types';

interface LineCommentProps {
  comment: Comment;
  onResolve?: (commentId: string) => void;
  onUnresolve?: (commentId: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LineComment({
  comment,
  onResolve,
  onUnresolve,
  onEdit,
  onDelete,
}: LineCommentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete?.(comment.id);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setDeleting(false);
    }
  };

  const toggleActions = () => {
    setShowActions(!showActions);
  };

  return (
    <div
      className={cn(
        'mx-2 sm:ml-[6.25rem] sm:mr-4 my-2 gh-card',
        comment.resolved ? 'opacity-60' : 'border-[var(--gh-accent-primary)]/30'
      )}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] rounded-t-lg cursor-pointer"
        onClick={toggleActions}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--gh-text-muted)]">{formatDate(comment.createdAt)}</span>
          {comment.resolved && (
            <span className="gh-badge gh-badge-success">
              Resolved
            </span>
          )}
          {comment.suggestion && (
            <span className="gh-badge gh-badge-purple">
              Suggestion
            </span>
          )}
        </div>
        <svg
          className={cn('w-4 h-4 text-[var(--gh-text-muted)] transition-transform', showActions && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Actions bar - shown on toggle */}
      {showActions && (
        <div className="flex items-center gap-1 px-3 py-2 bg-[var(--gh-bg-elevated)] border-b border-[var(--gh-border)]">
          {comment.resolved ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnresolve?.(comment.id);
              }}
              className="px-2 py-1 text-xs text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)] rounded transition-colors"
            >
              Unresolve
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResolve?.(comment.id);
              }}
              className="px-2 py-1 text-xs text-[var(--gh-success)] hover:bg-[var(--gh-success)]/10 rounded transition-colors"
            >
              Resolve
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setShowActions(false);
            }}
            className="px-2 py-1 text-xs text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)] rounded transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={deleting}
            className="px-2 py-1 text-xs text-[var(--gh-error)] hover:bg-[var(--gh-error)]/10 rounded transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="gh-input w-full text-sm resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 text-xs text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="gh-btn gh-btn-primary text-xs py-1"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--gh-text-primary)] whitespace-pre-wrap break-words">{comment.content}</p>
            {comment.suggestion && (
              <div className="mt-3 p-3 bg-[var(--gh-bg-primary)] rounded-lg overflow-x-auto border border-[var(--gh-border)]">
                <div className="text-xs text-[var(--gh-accent-secondary)] mb-2 font-semibold">Suggested change:</div>
                <pre className="text-sm text-[var(--gh-success)] font-mono">
                  <code>{comment.suggestion}</code>
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
