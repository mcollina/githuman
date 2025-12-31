import { cn } from '../../lib/utils';
import type { DiffFile } from '../../../shared/types';

interface SidebarProps {
  files: DiffFile[];
  selectedFile?: string;
  onFileSelect: (path: string) => void;
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

export function Sidebar({ files, selectedFile, onFileSelect }: SidebarProps) {
  if (files.length === 0) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 p-4">
        <p className="text-sm text-gray-500">No files to display</p>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700">
          Files ({files.length})
        </h2>
      </div>
      <nav className="p-2">
        {files.map((file) => {
          const path = file.newPath || file.oldPath;
          const isSelected = selectedFile === path;

          return (
            <button
              key={path}
              onClick={() => onFileSelect(path)}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                isSelected && 'bg-blue-50 text-blue-700'
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
        })}
      </nav>
    </aside>
  );
}
