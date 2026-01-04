import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { useCommentContext, getLineKey } from '../../contexts/CommentContext';
import { useHighlighterContext } from '../../contexts/HighlighterContext';
import { LineComment } from './LineComment';
import { CommentForm } from './CommentForm';
import { diffApi, type FileContent } from '../../api/diff';
import type { DiffHunk, DiffLine as DiffLineType } from '../../../shared/types';

interface FullFileViewProps {
  filePath: string;
  hunks: DiffHunk[];
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

interface ChangedLineInfo {
  type: 'added' | 'removed' | 'context';
  hunkIndex: number;
}

export function FullFileView({ filePath, hunks, allowComments = false, onLineClick }: FullFileViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const highlighter = useHighlighterContext();

  useEffect(() => {
    setLoading(true);
    setError(null);

    diffApi
      .getFileContent(filePath, 'staged')
      .then(setFileContent)
      .catch((err) => setError(err.message || 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [filePath]);

  // Trigger highlighting when file content is loaded
  useEffect(() => {
    if (fileContent && highlighter?.isReady) {
      highlighter.highlightFile(filePath, fileContent.lines);
    }
  }, [fileContent, filePath, highlighter?.isReady, highlighter]);

  // Build a map of line numbers to their change status
  const changedLines = useMemo(() => {
    const map = new Map<number, ChangedLineInfo>();

    hunks.forEach((hunk, hunkIndex) => {
      hunk.lines.forEach((line) => {
        if (line.type === 'added' && line.newLineNumber !== null) {
          map.set(line.newLineNumber, { type: 'added', hunkIndex });
        }
      });
    });

    return map;
  }, [hunks]);

  if (loading) {
    return (
      <div className="p-4 text-center text-[var(--gh-text-muted)]">
        <div className="gh-spinner w-5 h-5 mx-auto mb-2"></div>
        Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-[var(--gh-error)]">
        {error}
      </div>
    );
  }

  if (!fileContent) {
    return null;
  }

  return (
    <div className="font-mono text-sm min-w-max">
      {fileContent.lines.map((lineContent, index) => {
        const lineNumber = index + 1;
        const changeInfo = changedLines.get(lineNumber);

        return (
          <FullFileLine
            key={lineNumber}
            lineNumber={lineNumber}
            content={lineContent}
            changeType={changeInfo?.type}
            filePath={filePath}
            allowComments={allowComments}
            onLineClick={onLineClick}
          />
        );
      })}
    </div>
  );
}

interface FullFileLineProps {
  lineNumber: number;
  content: string;
  changeType?: 'added' | 'removed' | 'context';
  filePath: string;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

function FullFileLine({ lineNumber, content, changeType, filePath, allowComments = false, onLineClick }: FullFileLineProps) {
  const commentContext = allowComments ? useCommentContext() : null;
  const highlighter = useHighlighterContext();
  const highlightedHtml = highlighter?.getHighlightedLine(filePath, content);

  const lineType = changeType || 'context';
  const lineKey = getLineKey(filePath, lineNumber, lineType);
  const lineComments = commentContext?.commentsByLine.get(lineKey) || [];
  const isAddingComment = commentContext?.activeCommentLine === lineKey;

  const bgClass = {
    added: 'bg-[var(--gh-diff-add-bg)] border-l-4 border-[var(--gh-diff-add-accent)]',
    removed: 'bg-[var(--gh-diff-remove-bg)] border-l-4 border-[var(--gh-diff-remove-accent)]',
    context: 'bg-[var(--gh-bg-primary)] border-l-4 border-transparent',
  }[lineType];

  const textClass = {
    added: 'text-[var(--gh-diff-add-text)]',
    removed: 'text-[var(--gh-diff-remove-text)]',
    context: 'text-[var(--gh-text-primary)]',
  }[lineType];

  const isClickable = allowComments || onLineClick;

  const handleLineClick = () => {
    // If there's an onLineClick callback (e.g., to create a review first), call it
    if (onLineClick) {
      onLineClick(filePath, lineNumber, lineType);
      return;
    }
    // Otherwise, use the normal comment context flow
    if (!allowComments || isAddingComment) return;
    commentContext?.setActiveCommentLine(lineKey);
  };

  const handleSubmitComment = async (commentContent: string, suggestion?: string) => {
    await commentContext?.addComment({
      filePath,
      lineNumber,
      lineType,
      content: commentContent,
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
          isClickable && !isAddingComment && 'cursor-pointer hover:bg-[var(--gh-bg-surface)]'
        )}
        onClick={handleLineClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleLineClick() : undefined}
      >
        {/* Single line number for full file view */}
        <span className="w-14 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0">
          {lineNumber}
        </span>
        <pre className={cn('flex-1 py-0.5 px-4 whitespace-pre', textClass)}>
          {highlightedHtml ? (
            <code
              className="shiki-line"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <code>{content || ' '}</code>
          )}
        </pre>

        {/* Change indicator */}
        {changeType === 'added' && (
          <span className="absolute left-16 top-0 bottom-0 w-1 bg-[var(--gh-diff-add-accent)]" />
        )}

        {/* Comment count badge */}
        {lineComments.length > 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs bg-[var(--gh-accent-primary)]/20 text-[var(--gh-accent-primary)] rounded">
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
