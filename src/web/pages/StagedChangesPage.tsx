import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrowsableDiffView } from '../components/diff/BrowsableDiffView'
import { CommentProvider, useCommentContext, getLineKey } from '../contexts/CommentContext'
import { useStagedDiff, useUnstagedDiff, useGitStaging } from '../hooks/useStagedDiff'
import { useCreateReview } from '../hooks/useReviews'
import { useServerEvents } from '../hooks/useServerEvents'
import { cn } from '../lib/utils'

type TabType = 'staged' | 'unstaged'

// Component to set active comment line after review is created
function PendingLineActivator ({ pendingLine, onActivated }: {
  pendingLine: { filePath: string; lineNumber: number; lineType: 'added' | 'removed' | 'context' } | null;
  onActivated: () => void;
}) {
  const { setActiveCommentLine, reviewId } = useCommentContext()

  useEffect(() => {
    // Only activate when we have both a reviewId and a pending line
    if (reviewId && pendingLine) {
      const lineKey = getLineKey(pendingLine.filePath, pendingLine.lineNumber, pendingLine.lineType)
      setActiveCommentLine(lineKey)
      onActivated()

      // Scroll to the file
      setTimeout(() => {
        document.getElementById(pendingLine.filePath)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [reviewId, pendingLine, setActiveCommentLine, onActivated])

  return null
}

export function StagedChangesPage () {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('staged')
  const staged = useStagedDiff()
  const unstaged = useUnstagedDiff()
  const { create, loading: creating } = useCreateReview()
  const [selectedFile, setSelectedFile] = useState<string | undefined>()
  const [createError, setCreateError] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [pendingLine, setPendingLine] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: 'added' | 'removed' | 'context';
  } | null>(null)

  // State for confirmation dialog when clicking lines on unstaged tab
  const [pendingUnstagedComment, setPendingUnstagedComment] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: 'added' | 'removed' | 'context';
  } | null>(null)

  // Browse mode state (controlled by parent, passed to BrowsableDiffView)
  const [browseMode, setBrowseMode] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Changed file paths for highlighting in tree (combine staged and unstaged)
  const changedFilePaths = useMemo(() => {
    const paths: string[] = []
    if (staged.data?.files) {
      paths.push(...staged.data.files.map((f) => f.newPath || f.oldPath))
    }
    if (unstaged.data?.files) {
      paths.push(...unstaged.data.files.map((f) => f.newPath || f.oldPath))
    }
    return paths
  }, [staged.data?.files, unstaged.data?.files])

  // Refresh both when staging changes
  const handleStagingSuccess = useCallback(() => {
    staged.refetch()
    unstaged.refetch()
  }, [staged, unstaged])

  const { stageFiles, stageAll, staging } = useGitStaging(handleStagingSuccess)

  // Listen for file changes and auto-refresh
  useServerEvents({
    eventTypes: ['files', 'connected'],
    onEvent: useCallback(() => {
      staged.refetch()
      unstaged.refetch()
    }, [staged, unstaged]),
  })

  // Auto-switch to staged tab when all files are staged
  useEffect(() => {
    if (activeTab === 'unstaged' && unstaged.data && unstaged.data.files.length === 0 && staged.data && staged.data.files.length > 0) {
      setActiveTab('staged')
    }
  }, [activeTab, unstaged.data, staged.data])

  // Auto-switch to unstaged tab when there are no staged changes but there are unstaged
  useEffect(() => {
    if (activeTab === 'staged' && staged.data && staged.data.files.length === 0 && unstaged.data && unstaged.data.files.length > 0) {
      setActiveTab('unstaged')
    }
  }, [activeTab, staged.data, unstaged.data])

  const handleCreateReview = async () => {
    try {
      setCreateError(null)
      const review = await create({ sourceType: 'staged' })
      navigate(`/reviews/${review.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review')
    }
  }

  const handleLineClick = async (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => {
    // If we already have a review, don't create another one
    if (reviewId) return

    try {
      setCreateError(null)
      // Store the pending line to activate after review is created
      setPendingLine({ filePath, lineNumber, lineType })
      const review = await create({ sourceType: 'staged' })
      setReviewId(review.id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review')
      setPendingLine(null)
    }
  }

  const handlePendingLineActivated = useCallback(() => {
    setPendingLine(null)
  }, [])

  // Handler for clicking lines on unstaged tab - shows confirmation dialog
  const handleUnstagedLineClick = (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => {
    setPendingUnstagedComment({ filePath, lineNumber, lineType })
  }

  // Handler for confirming staging and commenting
  const handleConfirmStageAndComment = async () => {
    if (!pendingUnstagedComment) return

    try {
      setCreateError(null)
      // 1. Stage the file
      await stageFiles([pendingUnstagedComment.filePath])

      // 2. Store the pending line for activation after review creation
      setPendingLine(pendingUnstagedComment)

      // 3. Create review if needed
      if (!reviewId) {
        const review = await create({ sourceType: 'staged' })
        setReviewId(review.id)
      }

      // 4. Switch to staged tab
      setActiveTab('staged')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to stage file')
    } finally {
      setPendingUnstagedComment(null)
    }
  }

  const handleStageFile = async (filePath: string) => {
    try {
      await stageFiles([filePath])
    } catch {
      // Error already handled in hook
    }
  }

  const handleStageAll = async () => {
    try {
      await stageAll()
    } catch {
      // Error already handled in hook
    }
  }

  const loading = staged.loading || unstaged.loading
  const error = staged.error || unstaged.error

  if (loading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='gh-spinner w-8 h-8 mx-auto' />
          <p className='mt-4 text-[var(--gh-text-secondary)]'>Loading changes...</p>
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
              onClick={() => { staged.refetch(); unstaged.refetch() }}
              className='px-4 py-2 bg-[var(--gh-error)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--gh-error)]/90 transition-colors'
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const stagedFiles = staged.data?.files ?? []
  const unstagedFiles = unstaged.data?.files ?? []
  const hasStagedChanges = stagedFiles.length > 0
  const hasUnstagedChanges = unstagedFiles.length > 0
  const hasAnyChanges = hasStagedChanges || hasUnstagedChanges

  const currentData = activeTab === 'staged' ? staged.data : unstaged.data
  const currentFiles = activeTab === 'staged' ? stagedFiles : unstagedFiles

  return (
    <CommentProvider reviewId={reviewId}>
      <PendingLineActivator pendingLine={pendingLine} onActivated={handlePendingLineActivated} />
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Tab bar */}
        <div className='border-b border-[var(--gh-border)] bg-[var(--gh-bg-secondary)]'>
          <div className='flex items-center px-4'>
            <div className='flex'>
              <button
                onClick={() => setActiveTab('staged')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'staged'
                    ? 'border-[var(--gh-accent-primary)] text-[var(--gh-accent-primary)]'
                    : 'border-transparent text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)]'
                }`}
              >
                Staged
                {hasStagedChanges && (
                  <span className='ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--gh-success)]/20 text-[var(--gh-success)]'>
                    {stagedFiles.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('unstaged')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'unstaged'
                    ? 'border-[var(--gh-accent-primary)] text-[var(--gh-accent-primary)]'
                    : 'border-transparent text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)]'
                }`}
              >
                Unstaged
                {hasUnstagedChanges && (
                  <span className='ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--gh-warning)]/20 text-[var(--gh-warning)]'>
                    {unstagedFiles.length}
                  </span>
                )}
              </button>
            </div>
            {/* Browse mode toggle */}
            <label className='hidden sm:flex items-center gap-2 cursor-pointer ml-4'>
              <input
                type='checkbox'
                checked={browseMode}
                onChange={(e) => setBrowseMode(e.target.checked)}
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
            <div className='flex-1' />
            {/* Action buttons */}
            {activeTab === 'unstaged' && hasUnstagedChanges && (
              <button
                onClick={handleStageAll}
                disabled={staging}
                className='gh-btn gh-btn-primary text-xs sm:text-sm'
              >
                {staging ? 'Staging...' : 'Stage All'}
              </button>
            )}
            {activeTab === 'staged' && hasStagedChanges && !reviewId && (
              <button
                onClick={handleCreateReview}
                disabled={creating}
                className='gh-btn gh-btn-primary inline-flex items-center text-xs sm:text-sm'
              >
                <svg className='w-4 h-4 mr-1 sm:mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                </svg>
                <span className='hidden sm:inline'>{creating ? 'Creating...' : 'Create Review'}</span>
                <span className='sm:hidden'>{creating ? '...' : 'Create'}</span>
              </button>
            )}
            {activeTab === 'staged' && reviewId && (
              <button
                onClick={() => navigate(`/reviews/${reviewId}`)}
                className='inline-flex items-center px-3 sm:px-4 py-2 bg-[var(--gh-success)] text-[var(--gh-bg-primary)] text-xs sm:text-sm font-semibold rounded-lg hover:bg-[var(--gh-success)]/90 transition-colors'
              >
                <svg className='w-4 h-4 mr-1 sm:mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
                <span className='hidden sm:inline'>Go to Review</span>
                <span className='sm:hidden'>Review</span>
              </button>
            )}
          </div>
        </div>

        {createError && (
          <div className='px-4 py-2 bg-[var(--gh-error)]/10 border-b border-[var(--gh-error)]/30'>
            <p className='text-sm text-[var(--gh-error)]'>{createError}</p>
          </div>
        )}

        {/* Content */}
        {!hasAnyChanges
          ? (
            <div className='flex-1 flex items-center justify-center text-[var(--gh-text-muted)]'>
              <div className='text-center'>
                <svg
                  className='w-16 h-16 mx-auto mb-4 text-[var(--gh-text-muted)] opacity-30'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.5}
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
                <p className='text-lg font-semibold text-[var(--gh-text-primary)]'>No changes to display</p>
                <p className='text-sm text-[var(--gh-text-secondary)]'>Make some changes to see them here</p>
              </div>
            </div>
            )
          : currentFiles.length === 0
            ? (
              <div className='flex-1 flex items-center justify-center text-[var(--gh-text-muted)]'>
                <div className='text-center'>
                  <svg
                    className='w-16 h-16 mx-auto mb-4 text-[var(--gh-text-muted)] opacity-30'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={1.5}
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                  <p className='text-lg font-semibold text-[var(--gh-text-primary)]'>
                    {activeTab === 'staged' ? 'No staged changes' : 'No unstaged changes'}
                  </p>
                  <p className='text-sm text-[var(--gh-text-secondary)]'>
                    {activeTab === 'staged'
                      ? 'Switch to the Unstaged tab to stage some changes'
                      : 'All changes are staged and ready for review'}
                  </p>
                </div>
              </div>
              )
            : (
                currentData && (
                  <BrowsableDiffView
                    files={currentFiles}
                    summary={currentData.summary}
                    selectedFile={selectedFile}
                    onFileSelect={setSelectedFile}
                    allowComments={activeTab === 'staged' && !!reviewId}
                    onLineClick={
                      activeTab === 'unstaged'
                        ? handleUnstagedLineClick
                        : (activeTab === 'staged' && !reviewId ? handleLineClick : undefined)
                    }
                    showStageButtons={activeTab === 'unstaged'}
                    onStageFile={handleStageFile}
                    staging={staging}
                    browseRef='HEAD'
                    changedFilePaths={changedFilePaths}
                    includeWorkingDir
                    browseMode={browseMode}
                    onBrowseModeChange={setBrowseMode}
                    mobileDrawerOpen={mobileDrawerOpen}
                    onMobileDrawerChange={setMobileDrawerOpen}
                    showHeaderToggle={false}
                    contentHeader={
                      <>
                        {activeTab === 'staged' && hasStagedChanges && (
                          <div className='p-3 sm:p-4 border-b border-[var(--gh-border)] bg-[var(--gh-bg-tertiary)]'>
                            <div className='text-xs sm:text-sm text-[var(--gh-text-secondary)]'>
                              {reviewId
                                ? 'Click on any line to add comments'
                                : 'Click on a line to start a review, or use the Create Review button'}
                            </div>
                          </div>
                        )}
                        {activeTab === 'unstaged' && hasUnstagedChanges && (
                          <div className='p-3 sm:p-4 border-b border-[var(--gh-border)] bg-[var(--gh-bg-tertiary)]'>
                            <div className='text-xs sm:text-sm text-[var(--gh-text-secondary)]'>
                              Click the <span className='font-medium text-[var(--gh-accent-primary)]'>+</span> button to stage a file, or click a line to stage and add a comment
                            </div>
                          </div>
                        )}
                      </>
                  }
                  />
                )
              )}
      </div>

      {/* Confirmation dialog for staging and commenting */}
      {pendingUnstagedComment && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-[var(--gh-bg-primary)] rounded-lg p-6 max-w-md mx-4 border border-[var(--gh-border)]'>
            <h3 className='text-lg font-semibold text-[var(--gh-text-primary)] mb-2'>
              Stage File to Add Comment
            </h3>
            <p className='text-sm text-[var(--gh-text-secondary)] mb-4'>
              To add a comment, the file{' '}
              <code className='px-1 py-0.5 bg-[var(--gh-bg-surface)] rounded text-[var(--gh-text-primary)]'>
                {pendingUnstagedComment.filePath}
              </code>{' '}
              will be staged for commit.
            </p>
            <div className='flex gap-3 justify-end'>
              <button
                onClick={() => setPendingUnstagedComment(null)}
                className='px-4 py-2 text-sm font-medium text-[var(--gh-text-secondary)] hover:text-[var(--gh-text-primary)] transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStageAndComment}
                disabled={staging || creating}
                className='gh-btn gh-btn-primary'
              >
                {staging || creating ? 'Staging...' : 'Stage and Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CommentProvider>
  )
}
