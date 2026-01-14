import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useCommentContext, getLineKey } from '../../contexts/CommentContext'
import { useHighlighterContext } from '../../contexts/HighlighterContext'
import { LineComment } from '../diff/LineComment'
import { CommentForm } from '../diff/CommentForm'
import { MarkdownPreview, isMarkdownFile } from '../diff/MarkdownPreview'
import { useFileContent } from '../../hooks/useFileTree'

interface BrowseFileViewProps {
  filePath: string;
  ref: string;
  isChangedFile?: boolean;
  allowComments?: boolean;
}

type ViewMode = 'source' | 'preview'

export function BrowseFileView ({ filePath, ref, isChangedFile = false, allowComments = true }: BrowseFileViewProps) {
  const { content, lines, isBinary, loading, error } = useFileContent(filePath, ref)
  const highlighter = useHighlighterContext()
  const isMarkdown = isMarkdownFile(filePath)
  const [viewMode, setViewMode] = useState<ViewMode>(isMarkdown ? 'preview' : 'source')

  // Reset view mode when file changes
  useEffect(() => {
    setViewMode(isMarkdown ? 'preview' : 'source')
  }, [filePath, isMarkdown])

  // Trigger highlighting when file content is loaded
  useEffect(() => {
    if (lines.length > 0 && highlighter?.isReady) {
      highlighter.highlightFile(filePath, lines)
    }
  }, [lines, filePath, highlighter?.isReady, highlighter])

  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='text-center'>
          <div className='gh-spinner w-6 h-6 mx-auto mb-2' />
          <p className='text-[var(--gh-text-muted)]'>Loading file...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='gh-card p-6 border-[var(--gh-error)]/30'>
          <p className='text-[var(--gh-error)]'>{error.message}</p>
        </div>
      </div>
    )
  }

  if (isBinary) {
    return (
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='gh-card p-8 text-center'>
          <svg className='w-12 h-12 mx-auto mb-4 text-[var(--gh-text-muted)]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
          </svg>
          <p className='text-[var(--gh-text-muted)]'>Binary file not displayed</p>
          <p className='text-sm text-[var(--gh-text-muted)] mt-1'>{filePath}</p>
        </div>
      </div>
    )
  }

  if (content === null) {
    return null
  }

  return (
    <div className='flex-1 overflow-auto'>
      {/* File header */}
      <div className='sticky top-0 z-10 px-4 py-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] flex items-center gap-2'>
        <span className='font-mono text-sm text-[var(--gh-text-primary)] truncate'>{filePath}</span>
        {isChangedFile && (
          <span className='gh-badge gh-badge-warning shrink-0'>Changed</span>
        )}
        {isMarkdown && (
          <div className='flex rounded-lg border border-[var(--gh-border)] overflow-hidden ml-2'>
            <button
              type='button'
              onClick={() => setViewMode('source')}
              className={cn(
                'px-3 py-1 text-xs transition-colors',
                viewMode === 'source'
                  ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                  : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
              )}
            >
              Source
            </button>
            <button
              type='button'
              onClick={() => setViewMode('preview')}
              className={cn(
                'px-3 py-1 text-xs border-l border-[var(--gh-border)] transition-colors',
                viewMode === 'preview'
                  ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                  : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
              )}
            >
              Preview
            </button>
          </div>
        )}
        <span className='text-sm text-[var(--gh-text-muted)] ml-auto'>{lines.length} lines</span>
      </div>

      {/* File content */}
      {isMarkdown && viewMode === 'preview'
        ? (
          <MarkdownPreview content={content ?? ''} />
          )
        : (
          <div className='font-mono text-sm min-w-max'>
            {lines.map((lineContent, index) => (
              <BrowseLine
                key={index}
                lineNumber={index + 1}
                content={lineContent}
                filePath={filePath}
                allowComments={allowComments}
              />
            ))}
          </div>
          )}
    </div>
  )
}

interface BrowseLineProps {
  lineNumber: number;
  content: string;
  filePath: string;
  allowComments?: boolean;
}

function BrowseLine ({ lineNumber, content, filePath, allowComments = true }: BrowseLineProps) {
  const commentContext = useCommentContext()
  const highlighter = useHighlighterContext()
  const highlightedHtml = highlighter?.getHighlightedLine(filePath, content)

  const lineType = 'context' as const
  const lineKey = getLineKey(filePath, lineNumber, lineType)
  const lineComments = allowComments ? (commentContext.commentsByLine.get(lineKey) || []) : []
  const isAddingComment = allowComments && commentContext.activeCommentLine === lineKey

  const handleLineClick = () => {
    if (!allowComments || isAddingComment) return
    commentContext.setActiveCommentLine(lineKey)
  }

  const handleSubmitComment = async (commentContent: string, suggestion?: string) => {
    await commentContext.addComment({
      filePath,
      lineNumber,
      lineType,
      content: commentContent,
      suggestion,
    })
  }

  const handleCancelComment = () => {
    commentContext.setActiveCommentLine(null)
  }

  return (
    <div>
      <div
        className={cn(
          'browse-line flex font-mono text-sm group relative min-w-max',
          'bg-[var(--gh-bg-primary)] border-l-4 border-transparent',
          allowComments && !isAddingComment && 'cursor-pointer hover:bg-[var(--gh-bg-surface)]'
        )}
        onClick={handleLineClick}
        role={allowComments ? 'button' : undefined}
        tabIndex={allowComments ? 0 : undefined}
        onKeyDown={allowComments ? (e) => e.key === 'Enter' && handleLineClick() : undefined}
      >
        {/* Line number */}
        <span className='w-14 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0'>
          {lineNumber}
        </span>
        <pre className='flex-1 py-0.5 px-4 whitespace-pre text-[var(--gh-text-primary)]'>
          {highlightedHtml
            ? (
              <code
                className='shiki-line'
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
              )
            : (
              <code>{content || ' '}</code>
              )}
        </pre>

        {/* Comment count badge */}
        {lineComments.length > 0 && (
          <span className='absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs bg-[var(--gh-accent-primary)]/20 text-[var(--gh-accent-primary)] rounded'>
            {lineComments.length}
          </span>
        )}
      </div>

      {/* Display existing comments */}
      {lineComments.map((comment) => (
        <LineComment
          key={comment.id}
          comment={comment}
          onResolve={(id) => commentContext.resolveComment(id)}
          onUnresolve={(id) => commentContext.unresolveComment(id)}
          onEdit={(id, content) => commentContext.updateComment(id, content)}
          onDelete={(id) => commentContext.deleteComment(id)}
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
  )
}
