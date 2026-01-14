import { useState, useMemo, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { filterTree } from '../../hooks/useFileTree'
import type { FileTreeNode } from '../../../shared/types'

interface FileTreeViewProps {
  tree: FileTreeNode[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  loading?: boolean;
  filesWithComments?: Set<string>;
  browseMode?: boolean;
  onBrowseModeChange?: (enabled: boolean) => void;
  mobileDrawerOpen?: boolean;
  onMobileDrawerChange?: (open: boolean) => void;
}

interface TreeNodeProps {
  node: FileTreeNode;
  selectedFile: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
  level: number;
  filesWithComments?: Set<string>;
}

function TreeNode ({ node, selectedFile, expandedFolders, onToggleFolder, onFileSelect, level, filesWithComments }: TreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = node.path === selectedFile
  const hasComments = filesWithComments?.has(node.path) ?? false
  const indent = level * 12

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className={cn(
            'w-full text-left px-2 py-1 rounded-lg text-sm flex items-center gap-1 transition-colors',
            'text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] hover:text-[var(--gh-text-primary)]'
          )}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <svg
            className={cn('w-4 h-4 shrink-0 transition-transform', isExpanded && 'rotate-90')}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
          <svg className='w-4 h-4 shrink-0 text-[var(--gh-warning)]' fill='currentColor' viewBox='0 0 20 20'>
            <path d='M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' />
          </svg>
          <span className='truncate font-mono text-xs'>{node.name}</span>
          {node.children && (
            <span className='text-xs text-[var(--gh-text-muted)] ml-auto'>
              {node.children.length}
            </span>
          )}
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                selectedFile={selectedFile}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                level={level + 1}
                filesWithComments={filesWithComments}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onFileSelect(node.path)}
      className={cn(
        'w-full text-left px-2 py-1 rounded-lg text-sm flex items-center gap-1 transition-colors',
        isSelected
          ? 'bg-[var(--gh-accent-primary)]/10 text-[var(--gh-accent-primary)]'
          : 'text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] hover:text-[var(--gh-text-primary)]',
        node.isChanged && 'changed'
      )}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
      </svg>
      <span className='truncate font-mono text-xs'>{node.name}</span>
      <span className='flex items-center gap-1 ml-auto shrink-0'>
        {hasComments && (
          <span className='w-2 h-2 rounded-full bg-[var(--gh-accent-primary)]' title='Has comments' />
        )}
        {node.isChanged && (
          <span className='w-2 h-2 rounded-full bg-[var(--gh-warning)]' title='Changed in this review' />
        )}
      </span>
    </button>
  )
}

export function FileTreeView ({ tree, selectedFile, onFileSelect, loading, filesWithComments, browseMode, onBrowseModeChange, mobileDrawerOpen, onMobileDrawerChange }: FileTreeViewProps) {
  const [filter, setFilter] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [localIsOpen, setLocalIsOpen] = useState(false)
  const isMobile = useIsMobile()

  // Use external state if provided, otherwise use local state
  const isOpen = mobileDrawerOpen ?? localIsOpen
  const setIsOpen = onMobileDrawerChange ?? setLocalIsOpen

  // Auto-expand folders containing changed files or files with comments
  useEffect(() => {
    const foldersToExpand = new Set<string>()

    const hasRelevantChild = (node: FileTreeNode): boolean => {
      if (node.type === 'file') {
        return node.isChanged || (filesWithComments?.has(node.path) ?? false)
      }
      return node.children?.some(hasRelevantChild) ?? false
    }

    const findRelevantPaths = (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory' && node.children) {
          if (hasRelevantChild(node)) {
            foldersToExpand.add(node.path)
          }
          findRelevantPaths(node.children)
        }
      }
    }

    findRelevantPaths(tree)
    setExpandedFolders(foldersToExpand)
  }, [tree, filesWithComments])

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false)
    }
  }, [isMobile, setIsOpen])

  const handleFileSelect = (path: string) => {
    onFileSelect(path)
    if (isMobile) {
      setIsOpen(false)
    }
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const filteredTree = useMemo(() => {
    return filterTree(tree, filter)
  }, [tree, filter])

  const totalFiles = useMemo(() => {
    let count = 0
    const countFiles = (nodes: FileTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          count++
        } else if (node.children) {
          countFiles(node.children)
        }
      }
    }
    countFiles(tree)
    return count
  }, [tree])

  const sidebarContent = (
    <>
      <div className='p-3 border-b border-[var(--gh-border)]'>
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-sm font-semibold text-[var(--gh-text-primary)]'>
            All Files <span className='text-[var(--gh-accent-primary)]'>({totalFiles})</span>
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
          placeholder='Search files...'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className='gh-input w-full text-base'
        />
      </div>
      <nav className='p-2 flex-1 overflow-y-auto'>
        {loading
          ? (
            <div className='flex items-center justify-center py-8'>
              <div className='gh-spinner w-6 h-6' />
            </div>
            )
          : filteredTree.length === 0
            ? (
              <p className='text-sm text-[var(--gh-text-muted)] px-2'>
                {filter ? 'No matching files' : 'No files to display'}
              </p>
              )
            : (
                filteredTree.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    selectedFile={selectedFile}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onFileSelect={handleFileSelect}
                    level={0}
                    filesWithComments={filesWithComments}
                  />
                ))
              )}
      </nav>
      <div className='p-2 border-t border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)] flex flex-wrap gap-x-3 gap-y-1'>
        <span className='inline-flex items-center gap-1'>
          <span className='w-2 h-2 rounded-full bg-[var(--gh-warning)]' /> changed
        </span>
        <span className='inline-flex items-center gap-1'>
          <span className='w-2 h-2 rounded-full bg-[var(--gh-accent-primary)]' /> comments
        </span>
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
          aria-label='Open file tree'
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' />
          </svg>
          {totalFiles > 0 && (
            <span className='absolute -top-1 -right-1 bg-[var(--gh-accent-tertiary)] text-[var(--gh-bg-primary)] text-xs w-5 h-5 flex items-center justify-center rounded-full font-semibold'>
              {totalFiles > 99 ? '99+' : totalFiles}
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
