/**
 * MarkdownDiff - renders markdown files with preview toggle
 */
import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { DiffHunk } from './DiffHunk'
import { MarkdownPreview, isMarkdownFile } from './MarkdownPreview'
import { diffApi, type FileContent } from '../../api/diff'
import type { DiffFile, DiffHunk as DiffHunkType } from '../../../shared/types'

export { isMarkdownFile }

interface MarkdownDiffProps {
  file: DiffFile;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
  version?: 'staged' | 'working';
}

type ViewMode = 'diff' | 'preview' | 'split'

export function MarkdownDiff ({ file, allowComments = false, onLineClick, version = 'staged' }: MarkdownDiffProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)

  const filePath = file.newPath || file.oldPath
  const canShowPreview = file.status !== 'deleted'

  useEffect(() => {
    if (viewMode === 'diff') {
      return
    }

    if (fileContent) {
      return
    }

    setLoading(true)
    setError(null)

    diffApi
      .getFileContent(filePath, version)
      .then(setFileContent)
      .catch((err) => setError(err.message || 'Failed to load markdown'))
      .finally(() => setLoading(false))
  }, [filePath, viewMode, fileContent, version])

  const markdownContent = fileContent?.lines.join('\n') ?? ''

  return (
    <div>
      {/* View mode toggle */}
      <div className='flex items-center gap-2 p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)]'>
        <span className='text-xs text-[var(--gh-text-muted)] mr-2'>View:</span>
        <div className='flex rounded-lg border border-[var(--gh-border)] overflow-hidden'>
          <button
            type='button'
            onClick={() => setViewMode('diff')}
            className={cn(
              'px-3 py-1 text-xs transition-colors',
              viewMode === 'diff'
                ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
            )}
          >
            Diff
          </button>
          {canShowPreview && (
            <>
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
              <button
                type='button'
                onClick={() => setViewMode('split')}
                className={cn(
                  'px-3 py-1 text-xs border-l border-[var(--gh-border)] transition-colors',
                  viewMode === 'split'
                    ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                    : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
                )}
              >
                Split
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      {viewMode === 'diff'
        ? (
          <DiffContent hunks={file.hunks} filePath={filePath} allowComments={allowComments} onLineClick={onLineClick} />
          )
        : viewMode === 'preview'
          ? (
            <MarkdownPreview
              content={markdownContent}
              loading={loading}
              error={error}
              version={version}
            />
            )
          : (
            <div className='flex flex-col lg:flex-row'>
              <div className='flex-1 lg:border-r border-[var(--gh-border)] min-w-0'>
                <div className='p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)] font-medium'>
                  Diff
                </div>
                <DiffContent hunks={file.hunks} filePath={filePath} allowComments={allowComments} onLineClick={onLineClick} />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)] font-medium'>
                  Preview
                </div>
                <MarkdownPreview
                  content={markdownContent}
                  loading={loading}
                  error={error}
                  version={version}
                />
              </div>
            </div>
            )}
    </div>
  )
}

interface DiffContentProps {
  hunks: DiffHunkType[];
  filePath: string;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

function DiffContent ({ hunks, filePath, allowComments, onLineClick }: DiffContentProps) {
  if (hunks.length === 0) {
    return (
      <div className='p-4 text-center text-[var(--gh-text-muted)] text-sm'>
        No changes to display
      </div>
    )
  }

  return (
    <div className='overflow-x-auto'>
      {hunks.map((hunk, index) => (
        <DiffHunk
          key={index}
          hunk={hunk}
          filePath={filePath}
          allowComments={allowComments}
          onLineClick={onLineClick}
        />
      ))}
    </div>
  )
}
