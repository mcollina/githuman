import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { FileTreeView } from '../browse/FileTreeView'
import { BrowseFileView } from '../browse/BrowseFileView'
import { DiffView } from './DiffView'
import { useCommentContext } from '../../contexts/CommentContext'
import { useFileTree } from '../../hooks/useFileTree'
import { cn } from '../../lib/utils'
import type { DiffFile, DiffFileMetadata, DiffSummary, FileTreeNode } from '../../../shared/types'

interface BrowsableDiffViewProps {
  // Diff data
  files: (DiffFileMetadata | DiffFile)[];
  summary?: DiffSummary;
  selectedFile?: string;
  onFileSelect?: (path: string) => void;
  allowComments?: boolean;
  reviewId?: string; // If provided, enables lazy loading of hunks
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;

  // Staging props (for unstaged view)
  showStageButtons?: boolean;
  onStageFile?: (path: string) => void;
  staging?: boolean;

  // Browse mode props
  browseRef: string;
  changedFilePaths?: string[];
  includeWorkingDir?: boolean;

  // External browse mode control (optional - uses internal state if not provided)
  browseMode?: boolean;
  onBrowseModeChange?: (enabled: boolean) => void;

  // External mobile drawer control (optional - uses internal state if not provided)
  mobileDrawerOpen?: boolean;
  onMobileDrawerChange?: (open: boolean) => void;

  // Header toggle visibility (hidden on mobile, shown in sidebar instead)
  showHeaderToggle?: boolean;

  // Optional content to render above the diff view (e.g., hints)
  contentHeader?: ReactNode;

  // Whether to show contentHeader in browse mode too (default: false, only shows in diff mode)
  showContentHeaderInBrowseMode?: boolean;
}

function FileTreeWithComments ({ tree, selectedFile, onFileSelect, loading, browseMode, onBrowseModeChange, mobileDrawerOpen, onMobileDrawerChange }: {
  tree: FileTreeNode[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  loading?: boolean;
  browseMode?: boolean;
  onBrowseModeChange?: (enabled: boolean) => void;
  mobileDrawerOpen?: boolean;
  onMobileDrawerChange?: (open: boolean) => void;
}) {
  const commentContext = useCommentContext()

  // Compute files that have comments
  const filesWithComments = useMemo(() => {
    const files = new Set<string>()
    if (commentContext?.comments) {
      for (const comment of commentContext.comments) {
        files.add(comment.filePath)
      }
    }
    return files
  }, [commentContext?.comments])

  return (
    <FileTreeView
      tree={tree}
      selectedFile={selectedFile}
      onFileSelect={onFileSelect}
      loading={loading}
      filesWithComments={filesWithComments}
      browseMode={browseMode}
      onBrowseModeChange={onBrowseModeChange}
      mobileDrawerOpen={mobileDrawerOpen}
      onMobileDrawerChange={onMobileDrawerChange}
    />
  )
}

export function BrowsableDiffView ({
  files,
  summary,
  selectedFile,
  onFileSelect,
  allowComments = false,
  reviewId,
  onLineClick,
  showStageButtons,
  onStageFile,
  staging,
  browseRef,
  changedFilePaths,
  includeWorkingDir,
  browseMode: externalBrowseMode,
  onBrowseModeChange: externalOnBrowseModeChange,
  mobileDrawerOpen: externalMobileDrawerOpen,
  onMobileDrawerChange: externalOnMobileDrawerChange,
  showHeaderToggle = true,
  contentHeader,
  showContentHeaderInBrowseMode = false,
}: BrowsableDiffViewProps) {
  // Browse mode state (use external if provided, otherwise internal)
  const [internalBrowseMode, setInternalBrowseMode] = useState(false)
  const browseMode = externalBrowseMode ?? internalBrowseMode
  const setBrowseMode = externalOnBrowseModeChange ?? setInternalBrowseMode

  const [browseSelectedFile, setBrowseSelectedFile] = useState<string | null>(null)

  // Mobile drawer state (use external if provided, otherwise internal)
  const [internalMobileDrawerOpen, setInternalMobileDrawerOpen] = useState(false)
  const mobileDrawerOpen = externalMobileDrawerOpen ?? internalMobileDrawerOpen
  const setMobileDrawerOpen = externalOnMobileDrawerChange ?? setInternalMobileDrawerOpen

  const [internalSelectedFile, setInternalSelectedFile] = useState<string | undefined>()

  // Use external or internal file selection
  const effectiveSelectedFile = selectedFile ?? internalSelectedFile
  const handleFileSelect = onFileSelect ?? setInternalSelectedFile

  // Compute changed file paths from files if not provided
  const effectiveChangedFilePaths = useMemo(() => {
    if (changedFilePaths) return changedFilePaths
    return files.map((f) => f.newPath || f.oldPath)
  }, [changedFilePaths, files])

  // File tree for browse mode
  const { tree, loading: treeLoading } = useFileTree(browseMode ? browseRef : '', effectiveChangedFilePaths, { includeWorkingDir })

  const handleBrowseModeChange = (enabled: boolean) => {
    setBrowseMode(enabled)
    if (!enabled) {
      setBrowseSelectedFile(null)
    }
  }

  // Clear browse selected file when browse mode is turned off (handles external control)
  useEffect(() => {
    if (!browseMode) {
      setBrowseSelectedFile(null)
    }
  }, [browseMode])

  return (
    <div className='flex-1 flex min-w-0'>
      {browseMode
        ? (
          <FileTreeWithComments
            tree={tree}
            selectedFile={browseSelectedFile}
            onFileSelect={setBrowseSelectedFile}
            loading={treeLoading}
            browseMode={browseMode}
            onBrowseModeChange={handleBrowseModeChange}
            mobileDrawerOpen={mobileDrawerOpen}
            onMobileDrawerChange={setMobileDrawerOpen}
          />
          )
        : (
          <Sidebar
            files={files}
            selectedFile={effectiveSelectedFile}
            onFileSelect={handleFileSelect}
            showStageButtons={showStageButtons}
            onStageFile={onStageFile}
            staging={staging}
            browseMode={browseMode}
            onBrowseModeChange={handleBrowseModeChange}
            mobileDrawerOpen={mobileDrawerOpen}
            onMobileDrawerChange={setMobileDrawerOpen}
          />
          )}
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Header with browse toggle */}
        {showHeaderToggle && (
          <div className='hidden sm:flex items-center gap-2 p-2 border-b border-[var(--gh-border)] bg-[var(--gh-bg-secondary)]'>
            <label className='flex items-center gap-2 cursor-pointer ml-auto'>
              <input
                type='checkbox'
                checked={browseMode}
                onChange={(e) => handleBrowseModeChange(e.target.checked)}
                className='sr-only peer'
              />
              <span className={cn(
                'relative w-9 h-5 rounded-full transition-colors',
                'peer-checked:bg-[var(--gh-accent-primary)] bg-[var(--gh-bg-elevated)]',
                'after:content-[""] after:absolute after:top-0.5 after:left-0.5',
                'after:w-4 after:h-4 after:rounded-full after:bg-white',
                'after:transition-transform peer-checked:after:translate-x-4'
              )}
              />
              <span className='text-xs text-[var(--gh-text-secondary)]'>
                Browse full codebase
              </span>
            </label>
          </div>
        )}

        {/* Optional content header */}
        {(showContentHeaderInBrowseMode || !browseMode) && contentHeader}

        {/* Content area */}
        {browseMode
          ? (
              browseSelectedFile
                ? (
                  <BrowseFileView
                    filePath={browseSelectedFile}
                    ref={browseRef}
                    isChangedFile={effectiveChangedFilePaths.includes(browseSelectedFile)}
                    allowComments={allowComments}
                  />
                  )
                : (
                  <div className='flex-1 flex items-center justify-center p-8'>
                    <div className='text-center'>
                      <svg className='w-12 h-12 mx-auto mb-4 text-[var(--gh-text-muted)]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' />
                      </svg>
                      <p className='text-[var(--gh-text-muted)]'>Select a file from the tree to view</p>
                    </div>
                  </div>
                  )
            )
          : (
            <DiffView
              files={files}
              summary={summary}
              selectedFile={effectiveSelectedFile}
              allowComments={allowComments}
              reviewId={reviewId}
              onLineClick={onLineClick}
            />
            )}
      </div>
    </div>
  )
}
