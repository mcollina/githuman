import { useState } from 'react';
import { cn } from '../../lib/utils';
import { DiffHunk } from './DiffHunk';
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

  const displayPath = file.status === 'renamed'
    ? `${file.oldPath} → ${file.newPath}`
    : file.newPath || file.oldPath;

  const filePath = file.newPath || file.oldPath;

  return (
    <div id={filePath} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-200 text-left"
      >
        <svg
          className={cn('w-4 h-4 text-gray-500 transition-transform', expanded && 'rotate-90')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-mono text-sm text-gray-700 flex-1 truncate">
          {displayPath}
        </span>
        {getStatusBadge(file.status)}
        <span className="text-sm text-gray-500">
          <span className="text-green-600">+{file.additions}</span>
          {' / '}
          <span className="text-red-600">-{file.deletions}</span>
        </span>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          {file.hunks.length > 0 ? (
            file.hunks.map((hunk, index) => (
              <DiffHunk
                key={index}
                hunk={hunk}
                filePath={filePath}
                allowComments={allowComments}
              />
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              {file.status === 'renamed' ? 'File renamed (no content changes)' : 'No changes to display'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
