import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { DiffView } from '../components/diff/DiffView'
import { FileTreeView } from '../components/browse/FileTreeView'
import { BrowseFileView } from '../components/browse/BrowseFileView'
import { CommentProvider, useCommentContext, getLineKey } from '../contexts/CommentContext'
import { useCommentStats } from '../hooks/useComments'
import { useReview, useUpdateReview } from '../hooks/useReviews'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFileTree } from '../hooks/useFileTree'
import { reviewsApi } from '../api/reviews'
import { cn } from '../lib/utils'
import type { ReviewStatus, ReviewSourceType } from '../../shared/types'

function getSourceLabel (sourceType: ReviewSourceType, sourceRef: string | null) {
  if (sourceType === 'staged') {
    return 'Staged changes'
  }
  if (sourceType === 'branch' && sourceRef) {
    return `Branch: ${sourceRef}`
  }
  if (sourceType === 'commits' && sourceRef) {
    const commits = sourceRef.split(',')
    if (commits.length === 1) {
      return `Commit: ${commits[0].slice(0, 8)}`
    }
    return `${commits.length} commits`
  }
  return 'Unknown'
}

const statusOptions: { value: ReviewStatus; label: string; className: string }[] = [
  { value: 'in_progress', label: 'In Progress', className: 'bg-[var(--gh-warning)]/15 text-[var(--gh-warning)] border-[var(--gh-warning)]/30' },
  { value: 'approved', label: 'Approved', className: 'bg-[var(--gh-success)]/15 text-[var(--gh-success)] border-[var(--gh-success)]/30' },
  { value: 'changes_requested', label: 'Changes Requested', className: 'bg-[var(--gh-error)]/15 text-[var(--gh-error)] border-[var(--gh-error)]/30' },
]

function formatDate (dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InitialLineSelector () {
  const [searchParams, setSearchParams] = useSearchParams()
  const { setActiveCommentLine, loading } = useCommentContext()

  useEffect(() => {
    if (loading) return

    const file = searchParams.get('file')
    const line = searchParams.get('line')
    const lineType = searchParams.get('lineType') as 'added' | 'removed' | 'context' | null

    if (file && line && lineType) {
      const lineKey = getLineKey(file, parseInt(line, 10), lineType)
      setActiveCommentLine(lineKey)

      // Clear the URL params after setting the active line
      setSearchParams({}, { replace: true })

      // Scroll to the file
      setTimeout(() => {
        document.getElementById(file)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [searchParams, setSearchParams, setActiveCommentLine, loading])

  return null
}

function FileTreeWithComments ({ tree, selectedFile, onFileSelect, loading, browseMode, onBrowseModeChange, mobileDrawerOpen, onMobileDrawerChange }: {
  tree: import('../../shared/types').FileTreeNode[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  loading?: boolean;
  browseMode?: boolean;
  onBrowseModeChange?: (enabled: boolean) => void;
  mobileDrawerOpen?: boolean;
  onMobileDrawerChange?: (open: boolean) => void;
}) {
  const { comments } = useCommentContext()

  // Compute files that have comments
  const filesWithComments = useMemo(() => {
    const files = new Set<string>()
    for (const comment of comments) {
      files.add(comment.filePath)
    }
    return files
  }, [comments])

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

function CommentStats ({ reviewId }: { reviewId: string }) {
  const { stats } = useCommentStats(reviewId)

  if (!stats || stats.total === 0) {
    return null
  }

  return (
    <div className='flex items-center gap-3 text-sm'>
      <span className='text-[var(--gh-text-secondary)]'>
        <span className='font-semibold text-[var(--gh-text-primary)]'>{stats.total}</span> comments
      </span>
      {stats.unresolved > 0 && (
        <span className='text-[var(--gh-warning)]'>
          <span className='font-semibold'>{stats.unresolved}</span> unresolved
        </span>
      )}
      {stats.resolved > 0 && (
        <span className='text-[var(--gh-success)]'>
          <span className='font-semibold'>{stats.resolved}</span> resolved
        </span>
      )}
    </div>
  )
}

export function ReviewPage () {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useReview(id!)
  const { update, loading: updating } = useUpdateReview()
  const [selectedFile, setSelectedFile] = useState<string | undefined>()
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Browse mode state
  const [browseMode, setBrowseMode] = useState(false)
  const [browseSelectedFile, setBrowseSelectedFile] = useState<string | null>(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Compute ref for browse mode
  const browseRef = useMemo(() => {
    if (!data) return 'HEAD'
    if (data.sourceType === 'staged') return 'HEAD'
    if (data.sourceType === 'branch' && data.sourceRef) return data.sourceRef
    if (data.sourceType === 'commits' && data.sourceRef) {
      // For commit reviews, use the first commit
      return data.sourceRef.split(',')[0] || 'HEAD'
    }
    return data.baseRef || 'HEAD'
  }, [data])

  // Changed file paths for highlighting in tree
  const changedFilePaths = useMemo(() => {
    if (!data?.files) return []
    return data.files.map((f) => f.newPath || f.oldPath)
  }, [data?.files])

  // File tree hook
  const { tree, loading: treeLoading } = useFileTree(browseMode ? browseRef : '', changedFilePaths)

  const handleNextFile = useCallback(() => {
    if (!data?.files.length) return
    const nextIndex = Math.min(selectedFileIndex + 1, data.files.length - 1)
    setSelectedFileIndex(nextIndex)
    const file = data.files[nextIndex]
    const path = file.newPath || file.oldPath
    setSelectedFile(path)
    // Scroll the file into view
    document.getElementById(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [data?.files, selectedFileIndex])

  const handlePrevFile = useCallback(() => {
    if (!data?.files.length) return
    const prevIndex = Math.max(selectedFileIndex - 1, 0)
    setSelectedFileIndex(prevIndex)
    const file = data.files[prevIndex]
    const path = file.newPath || file.oldPath
    setSelectedFile(path)
    document.getElementById(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [data?.files, selectedFileIndex])

  const handleEscape = useCallback(() => {
    setShowDeleteConfirm(false)
  }, [])

  useKeyboardShortcuts({
    onNextFile: handleNextFile,
    onPrevFile: handlePrevFile,
    onEscape: handleEscape,
    enabled: !loading && !!data,
  })

  const handleStatusChange = async (status: ReviewStatus) => {
    if (!id) return
    await update(id, { status })
    refetch()
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await reviewsApi.delete(id)
      navigate('/')
    } catch (err) {
      console.error('Failed to delete review:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='gh-spinner w-8 h-8 mx-auto' />
          <p className='mt-4 text-[var(--gh-text-secondary)]'>Loading review...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='gh-card p-6 border-[var(--gh-error)]/30'>
            <p className='text-[var(--gh-error)] mb-4'>{error.message}</p>
            <button
              onClick={() => navigate('/')}
              className='px-4 py-2 bg-[var(--gh-bg-elevated)] text-[var(--gh-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--gh-bg-surface)] transition-colors'
            >
              Back to Reviews
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const currentStatus = statusOptions.find((s) => s.value === data.status)

  return (
    <CommentProvider reviewId={id!}>
      <InitialLineSelector />
      <div className='flex-1 flex min-w-0'>
        {browseMode
          ? (
            <FileTreeWithComments
              tree={tree}
              selectedFile={browseSelectedFile}
              onFileSelect={setBrowseSelectedFile}
              loading={treeLoading}
              browseMode={browseMode}
              onBrowseModeChange={(enabled) => {
                setBrowseMode(enabled)
                if (!enabled) {
                  setBrowseSelectedFile(null)
                }
              }}
              mobileDrawerOpen={mobileDrawerOpen}
              onMobileDrawerChange={setMobileDrawerOpen}
            />
            )
          : (
            <Sidebar
              files={data.files}
              selectedFile={selectedFile}
              onFileSelect={(path) => {
                setSelectedFile(path)
                const index = data.files.findIndex((f) => (f.newPath || f.oldPath) === path)
                if (index >= 0) setSelectedFileIndex(index)
              }}
              selectedIndex={selectedFileIndex}
              browseMode={browseMode}
              onBrowseModeChange={(enabled) => {
                setBrowseMode(enabled)
                if (!enabled) {
                  setBrowseSelectedFile(null)
                }
              }}
              mobileDrawerOpen={mobileDrawerOpen}
              onMobileDrawerChange={setMobileDrawerOpen}
            />
            )}
        <div className='flex-1 flex flex-col min-w-0'>
          <div className='p-3 sm:p-4 border-b border-[var(--gh-border)] bg-[var(--gh-bg-secondary)]'>
            <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
              <div className='min-w-0'>
                <div className='flex items-center gap-3'>
                  <span className='gh-badge gh-badge-info'>
                    {getSourceLabel(data.sourceType, data.sourceRef)}
                  </span>
                  {data.baseRef && (
                    <span className='font-mono text-xs text-[var(--gh-text-muted)] bg-[var(--gh-bg-elevated)] px-2 py-0.5 rounded'>
                      {data.baseRef.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className='mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[var(--gh-text-secondary)]'>
                  <span>Created {formatDate(data.createdAt)}</span>
                  <span className='font-mono'>{data.summary.totalFiles} files</span>
                  <span className='font-mono text-[var(--gh-success)]'>+{data.summary.totalAdditions}</span>
                  <span className='font-mono text-[var(--gh-error)]'>-{data.summary.totalDeletions}</span>
                </div>
                <div className='mt-2'>
                  <CommentStats reviewId={id!} />
                </div>
              </div>
              <div className='flex items-center gap-2 sm:gap-3 shrink-0'>
                {/* Browse mode toggle - hidden on mobile, shown in sidebar instead */}
                <label className='hidden sm:flex items-center gap-2 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={browseMode}
                    onChange={(e) => {
                      setBrowseMode(e.target.checked)
                      if (!e.target.checked) {
                        setBrowseSelectedFile(null)
                      }
                    }}
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
                <select
                  value={data.status}
                  onChange={(e) => handleStatusChange(e.target.value as ReviewStatus)}
                  disabled={updating}
                  className={cn(
                    'px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border cursor-pointer transition-colors',
                    currentStatus?.className
                  )}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className='px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--gh-error)] hover:bg-[var(--gh-error)]/10 rounded-lg transition-colors'
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          {browseMode
            ? (
                browseSelectedFile
                  ? (
                    <BrowseFileView
                      filePath={browseSelectedFile}
                      ref={browseRef}
                      isChangedFile={changedFilePaths.includes(browseSelectedFile)}
                      allowComments
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
                files={data.files}
                summary={data.summary}
                selectedFile={selectedFile}
                allowComments
              />
              )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50'>
          <div className='gh-card w-full max-w-sm mx-4 gh-animate-in'>
            <div className='p-5'>
              <h2 className='text-lg font-bold text-[var(--gh-text-primary)]'>Delete Review</h2>
              <p className='mt-2 text-sm text-[var(--gh-text-secondary)]'>
                Are you sure you want to delete this review? This action cannot be undone.
              </p>
            </div>
            <div className='p-4 border-t border-[var(--gh-border)] flex justify-end gap-3'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className='px-4 py-2 text-sm font-medium text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] rounded-lg transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className='px-4 py-2 bg-[var(--gh-error)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--gh-error)]/90 disabled:opacity-50 transition-colors'
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CommentProvider>
  )
}
