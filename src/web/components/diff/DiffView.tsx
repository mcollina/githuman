import { DiffFile } from './DiffFile'
import type { DiffFile as DiffFileType, DiffFileMetadata, DiffSummary } from '../../../shared/types'

interface DiffViewProps {
  files: (DiffFileMetadata | DiffFileType)[];
  summary?: DiffSummary;
  selectedFile?: string;
  forceExpandedFile?: string;
  allowComments?: boolean;
  reviewId?: string; // If provided, enables lazy loading of hunks
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

export function DiffView ({ files, summary, selectedFile, forceExpandedFile, allowComments = false, reviewId, onLineClick }: DiffViewProps) {
  if (files.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center text-[var(--gh-text-muted)]'>
        <div className='text-center'>
          <svg
            className='w-16 h-16 mx-auto mb-4 text-[var(--gh-text-muted)] opacity-30'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
          <p className='text-lg font-semibold text-[var(--gh-text-primary)]'>No changes to display</p>
          <p className='text-sm text-[var(--gh-text-secondary)]'>Stage some changes to see them here</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex-1 overflow-y-auto p-4 min-w-0'>
      {summary && (
        <div className='mb-4 gh-card p-4'>
          <div className='flex items-center gap-6 text-sm flex-wrap'>
            <span className='text-[var(--gh-text-secondary)]'>
              <span className='font-semibold text-[var(--gh-text-primary)]'>{summary.totalFiles}</span> files changed
            </span>
            <span className='text-[var(--gh-success)]'>
              <span className='font-semibold'>+{summary.totalAdditions}</span> additions
            </span>
            <span className='text-[var(--gh-error)]'>
              <span className='font-semibold'>-{summary.totalDeletions}</span> deletions
            </span>
            {summary.filesAdded > 0 && (
              <span className='hidden sm:inline text-[var(--gh-text-muted)]'>{summary.filesAdded} added</span>
            )}
            {summary.filesModified > 0 && (
              <span className='hidden sm:inline text-[var(--gh-text-muted)]'>{summary.filesModified} modified</span>
            )}
            {summary.filesDeleted > 0 && (
              <span className='hidden sm:inline text-[var(--gh-text-muted)]'>{summary.filesDeleted} deleted</span>
            )}
            {summary.filesRenamed > 0 && (
              <span className='hidden sm:inline text-[var(--gh-text-muted)]'>{summary.filesRenamed} renamed</span>
            )}
          </div>
        </div>
      )}

      <div className='space-y-4'>
        {files.map((file) => {
          const filePath = file.newPath || file.oldPath
          // Force expand if this file is selected or explicitly forced
          const shouldForceExpand = selectedFile === filePath || forceExpandedFile === filePath
          return (
            <DiffFile
              key={filePath}
              file={file}
              reviewId={reviewId}
              defaultExpanded={files.length <= 5}
              forceExpanded={shouldForceExpand}
              allowComments={allowComments}
              onLineClick={onLineClick}
            />
          )
        })}
      </div>
    </div>
  )
}
