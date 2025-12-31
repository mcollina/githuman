import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useCommentContext, getLineKey } from '../../contexts/CommentContext';
import { LineComment } from './LineComment';
import { CommentForm } from './CommentForm';
import type { DiffLine as DiffLineType } from '../../../shared/types';

interface DiffLineProps {
  line: DiffLineType;
  filePath: string;
  showLineNumbers?: boolean;
  allowComments?: boolean;
}

export function DiffLine({ line, filePath, showLineNumbers = true, allowComments = false }: DiffLineProps) {
  const [hovered, setHovered] = useState(false);
  const commentContext = allowComments ? useCommentContext() : null;

  const lineKey = getLineKey(filePath, line.newLineNumber ?? line.oldLineNumber, line.type);
  const lineComments = commentContext?.commentsByLine.get(lineKey) || [];
  const isAddingComment = commentContext?.activeCommentLine === lineKey;

  const bgClass = {
    added: 'bg-green-50 border-l-4 border-green-400',
    removed: 'bg-red-50 border-l-4 border-red-400',
    context: 'bg-white border-l-4 border-transparent',
  }[line.type];

  const textClass = {
    added: 'text-green-800',
    removed: 'text-red-800',
    context: 'text-gray-800',
  }[line.type];

  const prefix = {
    added: '+',
    removed: '-',
    context: ' ',
  }[line.type];

  const handleAddComment = () => {
    commentContext?.setActiveCommentLine(lineKey);
  };

  const handleSubmitComment = async (content: string, suggestion?: string) => {
    await commentContext?.addComment({
      filePath,
      lineNumber: line.newLineNumber ?? line.oldLineNumber ?? undefined,
      lineType: line.type,
      content,
      suggestion,
    });
  };

  const handleCancelComment = () => {
    commentContext?.setActiveCommentLine(null);
  };

  return (
    <div>
      <div
        className={cn('flex font-mono text-sm group relative', bgClass)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {showLineNumbers && (
          <>
            <span className="w-12 px-2 py-0.5 text-right text-gray-400 select-none bg-gray-50 border-r border-gray-200 shrink-0">
              {line.oldLineNumber ?? ''}
            </span>
            <span className="w-12 px-2 py-0.5 text-right text-gray-400 select-none bg-gray-50 border-r border-gray-200 shrink-0">
              {line.newLineNumber ?? ''}
            </span>
          </>
        )}
        <span className={cn('w-5 px-1 py-0.5 text-center select-none shrink-0', textClass)}>
          {prefix}
        </span>
        <pre className={cn('flex-1 py-0.5 pr-4 overflow-x-auto', textClass)}>
          <code>{line.content || ' '}</code>
        </pre>

        {/* Add comment button */}
        {allowComments && hovered && !isAddingComment && (
          <button
            onClick={handleAddComment}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-blue-600 text-white rounded hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add comment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Comment count badge */}
        {lineComments.length > 0 && !hovered && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
            {lineComments.length}
          </span>
        )}
      </div>

      {/* Display existing comments */}
      {lineComments.map((comment) => (
        <LineComment
          key={comment.id}
          comment={comment}
          onResolve={commentContext?.resolveComment}
          onUnresolve={commentContext?.unresolveComment}
          onEdit={commentContext?.updateComment}
          onDelete={commentContext?.deleteComment}
        />
      ))}

      {/* Comment form */}
      {isAddingComment && (
        <CommentForm
          onSubmit={handleSubmitComment}
          onCancel={handleCancelComment}
        />
      )}
    </div>
  );
}
