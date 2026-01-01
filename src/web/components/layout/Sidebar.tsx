import { useState, useMemo, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';
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
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  // Close sidebar when file is selected on mobile
  const handleFileSelect = (path: string) => {
    onFileSelect(path);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files;
    const lower = filter.toLowerCase();
    return files.filter((file) => {
      const path = file.newPath || file.oldPath;
      return path.toLowerCase().includes(lower);
    });
  }, [files, filter]);

  const sidebarContent = (
    <>
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700">
            Files ({files.length})
          </h2>
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <nav className="p-2 flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <p className="text-sm text-gray-500 px-2">No files to display</p>
        ) : filteredFiles.length === 0 ? (
          <p className="text-sm text-gray-500 px-2">No matching files</p>
        ) : (
          filteredFiles.map((file) => {
            const path = file.newPath || file.oldPath;
            const isSelected = selectedFile === path;
            const isHighlighted = selectedIndex !== undefined && files.indexOf(file) === selectedIndex;

            return (
              <button
                key={path}
                onClick={() => handleFileSelect(path)}
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
    </>
  );

  // Mobile: render toggle button + slide-out drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button */}
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800"
          aria-label="Open file list"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          {files.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
              {files.length}
            </span>
          )}
        </button>

        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Slide-out drawer */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // Desktop: regular sidebar
  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      {sidebarContent}
    </aside>
  );
}
