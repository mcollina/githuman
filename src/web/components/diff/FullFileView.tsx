import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { useCommentContext, getLineKey } from '../../contexts/CommentContext';
import { LineComment } from './LineComment';
import { CommentForm } from './CommentForm';
import { diffApi, type FileContent } from '../../api/diff';
import type { DiffHunk, DiffLine as DiffLineType } from '../../../shared/types';

interface FullFileViewProps {
  filePath: string;
  hunks: DiffHunk[];
  allowComments?: boolean;
}

interface ChangedLineInfo {
  type: 'added' | 'removed' | 'context';
  hunkIndex: number;
}

export function FullFileView({ filePath, hunks, allowComments = false }: FullFileViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    diffApi
      .getFileContent(filePath, 'staged')
      .then(setFileContent)
      .catch((err) => setError(err.message || 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [filePath]);

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
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (!fileContent) {
    return null;
  }

  return (
    <div className="font-mono text-sm">
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
}

function FullFileLine({ lineNumber, content, changeType, filePath, allowComments = false }: FullFileLineProps) {
  const commentContext = allowComments ? useCommentContext() : null;

  const lineType = changeType || 'context';
  const lineKey = getLineKey(filePath, lineNumber, lineType);
  const lineComments = commentContext?.commentsByLine.get(lineKey) || [];
  const isAddingComment = commentContext?.activeCommentLine === lineKey;

  const bgClass = {
    added: 'bg-green-50 border-l-4 border-green-400',
    removed: 'bg-red-50 border-l-4 border-red-400',
    context: 'bg-white border-l-4 border-transparent',
  }[lineType];

  const textClass = {
    added: 'text-green-800',
    removed: 'text-red-800',
    context: 'text-gray-800',
  }[lineType];

  const handleLineClick = () => {
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
          'flex font-mono text-sm group relative',
          bgClass,
          allowComments && !isAddingComment && 'cursor-pointer hover:bg-blue-50/50'
        )}
        onClick={handleLineClick}
        role={allowComments ? 'button' : undefined}
        tabIndex={allowComments ? 0 : undefined}
        onKeyDown={allowComments ? (e) => e.key === 'Enter' && handleLineClick() : undefined}
      >
        {/* Single line number for full file view */}
        <span className="w-14 px-2 py-0.5 text-right text-gray-400 select-none bg-gray-50 border-r border-gray-200 shrink-0">
          {lineNumber}
        </span>
        <pre className={cn('flex-1 py-0.5 px-4 whitespace-pre', textClass)}>
          <code>{content || ' '}</code>
        </pre>

        {/* Change indicator */}
        {changeType === 'added' && (
          <span className="absolute left-16 top-0 bottom-0 w-1 bg-green-400" />
        )}

        {/* Comment count badge */}
        {lineComments.length > 0 && (
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
