import { useState, useMemo, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useMediaQuery'
import type { DiffFile } from '../../../shared/types'

interface SidebarProps {
  files: DiffFile[];
  selectedFile?: string;
  onFileSelect: (path: string) => void;
  selectedIndex?: number;
  showStageButtons?: boolean;
  onStageFile?: (path: string) => void;
  staging?: boolean;
  browseMode?: boolean;
  onBrowseModeChange?: (enabled: boolean) => void;
  mobileDrawerOpen?: boolean;
  onMobileDrawerChange?: (open: boolean) => void;
}

function getStatusColor (status: DiffFile['status']) {
  switch (status) {
    case 'added':
      return 'text-[var(--gh-success)]'
    case 'deleted':
      return 'text-[var(--gh-error)]'
    case 'modified':
      return 'text-[var(--gh-warning)]'
    case 'renamed':
      return 'text-[var(--gh-accent-secondary)]'
    default:
      return 'text-[var(--gh-text-muted)]'
  }
}

function getStatusLabel (status: DiffFile['status']) {
  switch (status) {
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'modified':
      return 'M'
    case 'renamed':
      return 'R'
    default:
      return '?'
  }
}

export function Sidebar ({ files, selectedFile, onFileSelect, selectedIndex, showStageButtons, onStageFile, staging, browseMode, onBrowseModeChange, mobileDrawerOpen, onMobileDrawerChange }: SidebarProps) {
  const [filter, setFilter] = useState('')
  const [localIsOpen, setLocalIsOpen] = useState(false)
  const isMobile = useIsMobile()

  // Use external state if provided, otherwise use local state
  const isOpen = mobileDrawerOpen ?? localIsOpen
  const setIsOpen = onMobileDrawerChange ?? setLocalIsOpen

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false)
    }
  }, [isMobile, setIsOpen])

  // Close sidebar when file is selected on mobile
  const handleFileSelect = (path: string) => {
    onFileSelect(path)
    if (isMobile) {
      setIsOpen(false)
    }
  }

  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return files
    const lower = filter.toLowerCase()
    return files.filter((file) => {
      const path = file.newPath || file.oldPath
      return path.toLowerCase().includes(lower)
    })
  }, [files, filter])

  const sidebarContent = (
    <>
      <div className='p-3 border-b border-[var(--gh-border)]'>
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-sm font-semibold text-[var(--gh-text-primary)]'>
            Files <span className='text-[var(--gh-accent-primary)]'>({files.length})</span>
          </h2>
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className='p-1 text-[var(--gh-text-muted)] hover:text-[var(--gh-text-primary)] hover:bg-[var(--gh-bg-elevated)] rounded'
              aria-label='Close sidebar'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          )}
        </div>
        <input
          type='text'
          placeholder='Filter files...'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className='gh-input w-full text-base'
        />
      </div>
      <nav className='p-2 flex-1 overflow-y-auto'>
        {files.length === 0
          ? (
            <p className='text-sm text-[var(--gh-text-muted)] px-2'>No files to display</p>
            )
          : filteredFiles.length === 0
            ? (
              <p className='text-sm text-[var(--gh-text-muted)] px-2'>No matching files</p>
              )
            : (
                filteredFiles.map((file) => {
                  const path = file.newPath || file.oldPath
                  const isSelected = selectedFile === path
                  const isHighlighted = selectedIndex !== undefined && files.indexOf(file) === selectedIndex

                  return (
                    <div key={path} className='flex items-center gap-1'>
                      <button
                        onClick={() => handleFileSelect(path)}
                        className={cn(
                          'flex-1 text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors min-w-0',
                          isSelected
                            ? 'bg-[var(--gh-accent-primary)]/10 text-[var(--gh-accent-primary)]'
                            : 'text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] hover:text-[var(--gh-text-primary)]',
                          isHighlighted && !isSelected && 'ring-1 ring-[var(--gh-accent-primary)]'
                        )}
                      >
                        <span className={cn('font-mono text-xs font-semibold shrink-0', getStatusColor(file.status))}>
                          {getStatusLabel(file.status)}
                        </span>
                        <span className='truncate flex-1 font-mono text-xs' title={path}>
                          {path}
                        </span>
                        <span className='text-xs shrink-0'>
                          <span className='text-[var(--gh-success)]'>+{file.additions}</span>
                          {' '}
                          <span className='text-[var(--gh-error)]'>-{file.deletions}</span>
                        </span>
                      </button>
                      {showStageButtons && onStageFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onStageFile(path)
                          }}
                          disabled={staging}
                          className={cn(
                            'shrink-0 p-1.5 rounded-lg transition-colors',
                            staging
                              ? 'text-[var(--gh-text-muted)] cursor-not-allowed'
                              : 'text-[var(--gh-accent-primary)] hover:bg-[var(--gh-accent-primary)]/10'
                          )}
                          title='Stage this file'
                        >
                          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })
              )}
      </nav>
      <div className='p-2 border-t border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)]'>
        <span className='font-mono text-[var(--gh-accent-primary)]'>j</span>/<span className='font-mono text-[var(--gh-accent-primary)]'>k</span> navigate
        {' · '}
        <span className='font-mono text-[var(--gh-accent-primary)]'>c</span> comment
      </div>
      {/* Mobile browse mode toggle */}
      {isMobile && onBrowseModeChange && (
        <div className='p-3 border-t border-[var(--gh-border)]'>
          <label className='flex items-center justify-between cursor-pointer'>
            <span className='text-sm text-[var(--gh-text-secondary)]'>Browse full codebase</span>
            <span className='relative'>
              <input
                type='checkbox'
                checked={browseMode}
                onChange={(e) => onBrowseModeChange(e.target.checked)}
                className='sr-only peer'
              />
              <span className={cn(
                'block w-10 h-6 rounded-full transition-colors',
                'peer-checked:bg-[var(--gh-accent-primary)] bg-[var(--gh-bg-elevated)]'
              )}
              />
              <span className={cn(
                'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
                'peer-checked:translate-x-4'
              )}
              />
            </span>
          </label>
        </div>
      )}
    </>
  )

  // Mobile: render toggle button + slide-out drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button */}
        <button
          onClick={() => setIsOpen(true)}
          className='fixed bottom-4 left-4 z-40 p-3 gh-btn-primary rounded-full'
          aria-label='Open file list'
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h7' />
          </svg>
          {files.length > 0 && (
            <span className='absolute -top-1 -right-1 bg-[var(--gh-accent-tertiary)] text-[var(--gh-bg-primary)] text-xs w-5 h-5 flex items-center justify-center rounded-full font-semibold'>
              {files.length}
            </span>
          )}
        </button>

        {/* Overlay */}
        {isOpen && (
          <div
            className='fixed inset-0 bg-black/60 backdrop-blur-sm z-40'
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Slide-out drawer */}
        <aside
          className={cn(
            'fixed inset-0 z-50 bg-[var(--gh-bg-secondary)] shadow-xl flex flex-col',
            'transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
      </>
    )
  }

  // Desktop: regular sidebar
  return (
    <aside className='w-64 bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] overflow-y-auto flex flex-col'>
      {sidebarContent}
    </aside>
  )
}
