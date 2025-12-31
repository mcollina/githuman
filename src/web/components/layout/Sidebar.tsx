import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import type { DiffFile } from '../../../shared/types';

interface SidebarProps {
  files: DiffFile[];
  selectedFile?: string;
  onFileSelect: (path: string) => void;
  selectedIndex?: number;
}

function getStatusColor(status: DiffFile['status']) {
  switch (status) {
    case 'added':
      return 'text-green-600';
    case 'deleted':
      return 'text-red-600';
    case 'modified':
      return 'text-yellow-600';
    case 'renamed':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

function getStatusLabel(status: DiffFile['status']) {
  switch (status) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'modified':
      return 'M';
    case 'renamed':
      return 'R';
    default:
      return '?';
  }
}

export function Sidebar({ files, selectedFile, onFileSelect, selectedIndex }: SidebarProps) {
  const [filter, setFilter] = useState('');

  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files;
    const lower = filter.toLowerCase();
    return files.filter((file) => {
      const path = file.newPath || file.oldPath;
      return path.toLowerCase().includes(lower);
    });
  }, [files, filter]);

  if (files.length === 0) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 p-4">
        <p className="text-sm text-gray-500">No files to display</p>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700 mb-2">
          Files ({files.length})
        </h2>
        <input
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <nav className="p-2 flex-1 overflow-y-auto">
        {filteredFiles.length === 0 ? (
          <p className="text-sm text-gray-500 px-2">No matching files</p>
        ) : (
          filteredFiles.map((file, index) => {
            const path = file.newPath || file.oldPath;
            const isSelected = selectedFile === path;
            const isHighlighted = selectedIndex !== undefined && files.indexOf(file) === selectedIndex;

            return (
              <button
                key={path}
                onClick={() => onFileSelect(path)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                  isSelected && 'bg-blue-50 text-blue-700',
                  isHighlighted && !isSelected && 'ring-2 ring-blue-300'
                )}
              >
                <span className={cn('font-mono text-xs', getStatusColor(file.status))}>
                  {getStatusLabel(file.status)}
                </span>
                <span className="truncate flex-1" title={path}>
                  {path.split('/').pop()}
                </span>
                <span className="text-xs text-gray-400">
                  <span className="text-green-600">+{file.additions}</span>
                  {' '}
                  <span className="text-red-600">-{file.deletions}</span>
                </span>
              </button>
            );
          })
        )}
      </nav>
      <div className="p-2 border-t border-gray-200 text-xs text-gray-400">
        <span className="font-mono">j</span>/<span className="font-mono">k</span> navigate
        {' · '}
        <span className="font-mono">c</span> comment
      </div>
    </aside>
  );
}
