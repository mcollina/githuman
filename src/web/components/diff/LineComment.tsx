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

  return (
    <div
      className={cn(
        'ml-[6.25rem] mr-4 my-2 bg-white border rounded-lg shadow-sm',
        comment.resolved ? 'border-gray-200 opacity-60' : 'border-blue-200'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
          {comment.resolved && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              Resolved
            </span>
          )}
          {comment.suggestion && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
              Suggestion
            </span>
          )}
        </div>
        {showActions && (
          <div className="flex items-center gap-1">
            {comment.resolved ? (
              <button
                onClick={() => onUnresolve?.(comment.id)}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
              >
                Unresolve
              </button>
            ) : (
              <button
                onClick={() => onResolve?.(comment.id)}
                className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
              >
                Resolve
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete?.(comment.id)}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            {comment.suggestion && (
              <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                <div className="text-xs text-gray-400 mb-2">Suggested change:</div>
                <pre className="text-sm text-green-400 font-mono overflow-x-auto">
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
