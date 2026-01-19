import { useState, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'
import { DiffHunk } from './DiffHunk'
import { FullFileView } from './FullFileView'
import { ImageDiff, isImageFile } from './ImageDiff'
import { MarkdownDiff, isMarkdownFile } from './MarkdownDiff'
import { reviewsApi } from '../../api/reviews'
import type { DiffFile as DiffFileType, DiffFileMetadata, DiffHunk as DiffHunkType } from '../../../shared/types'

interface DiffFileProps {
  file: DiffFileMetadata | DiffFileType;
  reviewId?: string; // If provided, enables lazy loading of hunks
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

function hasHunks (file: DiffFileMetadata | DiffFileType): file is DiffFileType {
  return 'hunks' in file && Array.isArray(file.hunks)
}

function getStatusBadge (status: DiffFileMetadata['status']) {
  const styles = {
    added: 'gh-badge gh-badge-success',
    deleted: 'gh-badge gh-badge-error',
    modified: 'gh-badge gh-badge-warning',
    renamed: 'gh-badge gh-badge-purple',
  }

  const labels = {
    added: 'Added',
    deleted: 'Deleted',
    modified: 'Modified',
    renamed: 'Renamed',
  }

  return (
    <span className={styles[status]}>
      {labels[status]}
    </span>
  )
}

export function DiffFile ({ file, reviewId, defaultExpanded = true, forceExpanded, allowComments = false, onLineClick }: DiffFileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [loadedHunks, setLoadedHunks] = useState<DiffHunkType[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If forceExpanded is true, ensure the file is expanded
  const isExpanded = forceExpanded || expanded
  const [viewMode, setViewMode] = useState<'diff' | 'full'>('diff')

  const displayPath = file.status === 'renamed'
    ? `${file.oldPath} → ${file.newPath}`
    : file.newPath || file.oldPath

  const filePath = file.newPath || file.oldPath

  // Determine hunks to display
  const hunks = hasHunks(file) ? file.hunks : loadedHunks

  // Load hunks when expanded if we have a reviewId and no hunks yet
  const loadHunks = useCallback(async () => {
    if (!reviewId || hasHunks(file) || loadedHunks || loading) return

    setLoading(true)
    setError(null)
    try {
      const response = await reviewsApi.getFileHunks(reviewId, filePath)
      setLoadedHunks(response.hunks)
    } catch (err) {
      setError('Failed to load diff')
      console.error('Failed to load hunks:', err)
    } finally {
      setLoading(false)
    }
  }, [reviewId, file, filePath, loadedHunks, loading])

  // Load hunks when file is expanded (for lazy loading)
  useEffect(() => {
    if (isExpanded && reviewId && !hasHunks(file) && !loadedHunks && !loading) {
      loadHunks()
    }
  }, [isExpanded, reviewId, file, loadedHunks, loading, loadHunks])

  // Check if this is an image file
  const isImage = isImageFile(filePath)

  // Check if this is a markdown file
  const isMarkdown = isMarkdownFile(filePath)

  // Can only show full file for added or modified files (not deleted) and non-image/non-markdown files
  const canShowFullFile = !isImage && !isMarkdown && (file.status === 'added' || file.status === 'modified' || file.status === 'renamed')

  // For image and markdown diffs, we need a full DiffFile with hunks
  const fileWithHunks: DiffFileType = hasHunks(file)
    ? file
    : { ...file, hunks: loadedHunks ?? [] }

  return (
    <div id={filePath} className='gh-card overflow-hidden'>
      <div className='flex items-center bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)]'>
        <button
          onClick={() => setExpanded(!expanded)}
          className='flex-1 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 hover:bg-[var(--gh-bg-elevated)] text-left transition-colors'
        >
          <svg
            className={cn('w-4 h-4 text-[var(--gh-text-muted)] transition-transform shrink-0', isExpanded && 'rotate-90')}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
          <span className='font-mono text-xs sm:text-sm text-[var(--gh-text-primary)] flex-1 truncate min-w-0'>
            {displayPath}
          </span>
          <span className='hidden sm:inline-block'>{getStatusBadge(file.status)}</span>
          <span className='text-xs sm:text-sm shrink-0 font-mono'>
            <span className='text-[var(--gh-success)]'>+{file.additions}</span>
            <span className='text-[var(--gh-text-muted)]'>{' / '}</span>
            <span className='text-[var(--gh-error)]'>-{file.deletions}</span>
          </span>
        </button>

        {/* View mode toggle */}
        {isExpanded && canShowFullFile && hunks && hunks.length > 0 && (
          <div className='flex items-center border-l border-[var(--gh-border)] px-2'>
            <button
              onClick={() => setViewMode('diff')}
              className={cn(
                'px-2 py-1 text-xs rounded-l border border-[var(--gh-border)] transition-colors',
                viewMode === 'diff'
                  ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)] border-[var(--gh-accent-primary)]'
                  : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)]'
              )}
              title='Show diff hunks only'
            >
              Diff
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={cn(
                'px-2 py-1 text-xs rounded-r border border-l-0 border-[var(--gh-border)] transition-colors',
                viewMode === 'full'
                  ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)] border-[var(--gh-accent-primary)]'
                  : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)]'
              )}
              title='Show full file'
            >
              Full
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className='overflow-x-auto'>
          {loading
            ? (
              <div className='p-4 text-center text-[var(--gh-text-muted)] text-sm'>
                <div className='gh-spinner w-5 h-5 mx-auto' />
                <p className='mt-2'>Loading diff...</p>
              </div>
              )
            : error
              ? (
                <div className='p-4 text-center text-[var(--gh-error)] text-sm'>
                  <p>{error}</p>
                  <button
                    onClick={loadHunks}
                    className='mt-2 px-3 py-1 text-xs bg-[var(--gh-bg-elevated)] hover:bg-[var(--gh-bg-surface)] rounded transition-colors'
                  >
                    Retry
                  </button>
                </div>
                )
              : isImage
                ? (
                  <ImageDiff file={fileWithHunks} />
                  )
                : isMarkdown
                  ? (
                    <MarkdownDiff file={fileWithHunks} allowComments={allowComments} />
                    )
                  : !hunks || hunks.length === 0
                      ? (
                        <div className='p-4 text-center text-[var(--gh-text-muted)] text-sm'>
                          {file.status === 'renamed' ? 'File renamed (no content changes)' : 'No changes to display'}
                        </div>
                        )
                      : viewMode === 'full' && canShowFullFile
                        ? (
                          <FullFileView
                            filePath={filePath}
                            hunks={hunks}
                            allowComments={allowComments}
                            onLineClick={onLineClick}
                          />
                          )
                        : (
                            hunks.map((hunk, index) => (
                              <DiffHunk
                                key={index}
                                hunk={hunk}
                                filePath={filePath}
                                allowComments={allowComments}
                                onLineClick={onLineClick}
                              />
                            ))
                          )}
        </div>
      )}
    </div>
  )
}
