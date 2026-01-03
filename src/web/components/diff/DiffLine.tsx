import { cn } from '../../lib/utils';
import { useCommentContext, getLineKey } from '../../contexts/CommentContext';
import { useHighlighterContext } from '../../contexts/HighlighterContext';
import { LineComment } from './LineComment';
import { CommentForm } from './CommentForm';
import type { DiffLine as DiffLineType } from '../../../shared/types';

interface DiffLineProps {
  line: DiffLineType;
  filePath: string;
  showLineNumbers?: boolean;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

export function DiffLine({ line, filePath, showLineNumbers = true, allowComments = false, onLineClick }: DiffLineProps) {
  const commentContext = allowComments ? useCommentContext() : null;
  const highlighter = useHighlighterContext();
  const highlightedHtml = highlighter?.getHighlightedLine(filePath, line.content);

  const lineKey = getLineKey(filePath, line.newLineNumber ?? line.oldLineNumber, line.type);
  const lineComments = commentContext?.commentsByLine.get(lineKey) || [];
  const isAddingComment = commentContext?.activeCommentLine === lineKey;

  const bgClass = {
    added: 'bg-[var(--diff-added-bg)] border-l-4 border-[var(--diff-added-border)]',
    removed: 'bg-[var(--diff-removed-bg)] border-l-4 border-[var(--diff-removed-border)]',
    context: 'bg-[var(--gh-bg-elevated)] border-l-4 border-transparent',
  }[line.type];

  const textClass = {
    added: 'text-[var(--gh-success)]',
    removed: 'text-[var(--gh-error)]',
    context: 'text-[var(--gh-text-primary)]',
  }[line.type];

  const prefix = {
    added: '+',
    removed: '-',
    context: ' ',
  }[line.type];

  const lineNumber = line.newLineNumber ?? line.oldLineNumber;
  const isClickable = allowComments || onLineClick;

  const handleLineClick = () => {
    // If there's an onLineClick callback (e.g., to create a review first), call it
    if (onLineClick && lineNumber !== null) {
      onLineClick(filePath, lineNumber, line.type);
      return;
    }
    // Otherwise, use the normal comment context flow
    if (!allowComments || isAddingComment) return;
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
        className={cn(
          'flex font-mono text-sm group relative min-w-max',
          bgClass,
          isClickable && !isAddingComment && 'cursor-pointer hover:brightness-110'
        )}
        onClick={handleLineClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleLineClick() : undefined}
      >
        {showLineNumbers && (
          <>
            <span className="w-12 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0">
              {line.oldLineNumber ?? ''}
            </span>
            <span className="w-12 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0">
              {line.newLineNumber ?? ''}
            </span>
          </>
        )}
        <span className={cn('w-5 px-1 py-0.5 text-center select-none shrink-0 font-semibold', textClass)}>
          {prefix}
        </span>
        <pre className={cn('flex-1 py-0.5 pr-4 whitespace-pre', textClass)}>
          {highlightedHtml ? (
            <code
              className="shiki-line"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <code>{line.content || ' '}</code>
          )}
        </pre>

        {/* Comment count badge */}
        {lineComments.length > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs bg-[var(--gh-accent-primary)]/20 text-[var(--gh-accent-primary)] rounded font-semibold">
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
