import { useState } from 'react';
import { cn } from '../../lib/utils';
import { DiffHunk } from './DiffHunk';
import { FullFileView } from './FullFileView';
import { ImageDiff, isImageFile } from './ImageDiff';
import { MarkdownDiff, isMarkdownFile } from './MarkdownDiff';
import type { DiffFile as DiffFileType } from '../../../shared/types';

interface DiffFileProps {
  file: DiffFileType;
  defaultExpanded?: boolean;
  forceExpanded?: boolean;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

function getStatusBadge(status: DiffFileType['status']) {
  const styles = {
    added: 'gh-badge gh-badge-success',
    deleted: 'gh-badge gh-badge-error',
    modified: 'gh-badge gh-badge-warning',
    renamed: 'gh-badge gh-badge-purple',
  };

  const labels = {
    added: 'Added',
    deleted: 'Deleted',
    modified: 'Modified',
    renamed: 'Renamed',
  };

  return (
    <span className={styles[status]}>
      {labels[status]}
    </span>
  );
}

export function DiffFile({ file, defaultExpanded = true, forceExpanded, allowComments = false, onLineClick }: DiffFileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // If forceExpanded is true, ensure the file is expanded
  const isExpanded = forceExpanded || expanded;
  const [viewMode, setViewMode] = useState<'diff' | 'full'>('diff');

  const displayPath = file.status === 'renamed'
    ? `${file.oldPath} → ${file.newPath}`
    : file.newPath || file.oldPath;

  const filePath = file.newPath || file.oldPath;

  // Check if this is an image file
  const isImage = isImageFile(filePath);

  // Check if this is a markdown file
  const isMarkdown = isMarkdownFile(filePath);

  // Can only show full file for added or modified files (not deleted) and non-image/non-markdown files
  const canShowFullFile = !isImage && !isMarkdown && (file.status === 'added' || file.status === 'modified' || file.status === 'renamed');

  return (
    <div id={filePath} className="gh-card overflow-hidden">
      <div className="flex items-center bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 hover:bg-[var(--gh-bg-elevated)] text-left transition-colors"
        >
          <svg
            className={cn('w-4 h-4 text-[var(--gh-text-muted)] transition-transform shrink-0', isExpanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-mono text-xs sm:text-sm text-[var(--gh-text-primary)] flex-1 truncate min-w-0">
            {displayPath}
          </span>
          <span className="hidden sm:inline-block">{getStatusBadge(file.status)}</span>
          <span className="text-xs sm:text-sm shrink-0 font-mono">
            <span className="text-[var(--gh-success)]">+{file.additions}</span>
            <span className="text-[var(--gh-text-muted)]">{' / '}</span>
            <span className="text-[var(--gh-error)]">-{file.deletions}</span>
          </span>
        </button>

        {/* View mode toggle */}
        {isExpanded && canShowFullFile && file.hunks.length > 0 && (
          <div className="flex items-center border-l border-[var(--gh-border)] px-2">
            <button
              onClick={() => setViewMode('diff')}
              className={cn(
                'px-2 py-1 text-xs rounded-l border border-[var(--gh-border)] transition-colors',
                viewMode === 'diff'
                  ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)] border-[var(--gh-accent-primary)]'
                  : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)]'
              )}
              title="Show diff hunks only"
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
              title="Show full file"
            >
              Full
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          {isImage ? (
            <ImageDiff file={file} />
          ) : isMarkdown ? (
            <MarkdownDiff file={file} allowComments={allowComments} />
          ) : file.hunks.length === 0 ? (
            <div className="p-4 text-center text-[var(--gh-text-muted)] text-sm">
              {file.status === 'renamed' ? 'File renamed (no content changes)' : 'No changes to display'}
            </div>
          ) : viewMode === 'full' && canShowFullFile ? (
            <FullFileView
              filePath={filePath}
              hunks={file.hunks}
              allowComments={allowComments}
              onLineClick={onLineClick}
            />
          ) : (
            file.hunks.map((hunk, index) => (
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
  );
}
