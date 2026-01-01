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
  allowComments?: boolean;
}

function getStatusBadge(status: DiffFileType['status']) {
  const styles = {
    added: 'bg-green-100 text-green-700',
    deleted: 'bg-red-100 text-red-700',
    modified: 'bg-yellow-100 text-yellow-700',
    renamed: 'bg-blue-100 text-blue-700',
  };

  const labels = {
    added: 'Added',
    deleted: 'Deleted',
    modified: 'Modified',
    renamed: 'Renamed',
  };

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', styles[status])}>
      {labels[status]}
    </span>
  );
}

export function DiffFile({ file, defaultExpanded = true, allowComments = false }: DiffFileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
    <div id={filePath} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center bg-gray-50 border-b border-gray-200">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 hover:bg-gray-100 text-left"
        >
          <svg
            className={cn('w-4 h-4 text-gray-500 transition-transform shrink-0', expanded && 'rotate-90')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-mono text-xs sm:text-sm text-gray-700 flex-1 truncate min-w-0">
            {displayPath}
          </span>
          <span className="hidden sm:inline-block">{getStatusBadge(file.status)}</span>
          <span className="text-xs sm:text-sm text-gray-500 shrink-0">
            <span className="text-green-600">+{file.additions}</span>
            <span className="hidden sm:inline">{' / '}</span>
            <span className="sm:hidden">/</span>
            <span className="text-red-600">-{file.deletions}</span>
          </span>
        </button>

        {/* View mode toggle */}
        {expanded && canShowFullFile && file.hunks.length > 0 && (
          <div className="flex items-center border-l border-gray-200 px-2">
            <button
              onClick={() => setViewMode('diff')}
              className={cn(
                'px-2 py-1 text-xs rounded-l border border-gray-300',
                viewMode === 'diff'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              )}
              title="Show diff hunks only"
            >
              Diff
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={cn(
                'px-2 py-1 text-xs rounded-r border border-l-0 border-gray-300',
                viewMode === 'full'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              )}
              title="Show full file"
            >
              Full
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          {isImage ? (
            <ImageDiff file={file} />
          ) : isMarkdown ? (
            <MarkdownDiff file={file} allowComments={allowComments} />
          ) : file.hunks.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {file.status === 'renamed' ? 'File renamed (no content changes)' : 'No changes to display'}
            </div>
          ) : viewMode === 'full' && canShowFullFile ? (
            <FullFileView
              filePath={filePath}
              hunks={file.hunks}
              allowComments={allowComments}
            />
          ) : (
            file.hunks.map((hunk, index) => (
              <DiffHunk
                key={index}
                hunk={hunk}
                filePath={filePath}
                allowComments={allowComments}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
