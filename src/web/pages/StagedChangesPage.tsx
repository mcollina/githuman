import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { DiffView } from '../components/diff/DiffView'
import { CommentProvider, useCommentContext, getLineKey } from '../contexts/CommentContext'
import { useStagedDiff, useUnstagedDiff, useGitStaging } from '../hooks/useStagedDiff'
import { useCreateReview } from '../hooks/useReviews'
import { useServerEvents } from '../hooks/useServerEvents'

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
              <div className='flex-1 flex min-w-0'>
                {currentData && (
                  <>
                    <Sidebar
                      files={currentFiles}
                      selectedFile={selectedFile}
                      onFileSelect={setSelectedFile}
                      showStageButtons={activeTab === 'unstaged'}
                      onStageFile={handleStageFile}
                      staging={staging}
                    />
                    <div className='flex-1 flex flex-col min-w-0'>
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
                            Click the <span className='font-medium text-[var(--gh-accent-primary)]'>+</span> button next to a file to stage it, or use Stage All
                          </div>
                        </div>
                      )}
                      <DiffView
                        files={currentFiles}
                        summary={currentData.summary}
                        selectedFile={selectedFile}
                        allowComments={activeTab === 'staged' && !!reviewId}
                        onLineClick={activeTab === 'staged' && !reviewId ? handleLineClick : undefined}
                      />
                    </div>
                  </>
                )}
              </div>
              )}
      </div>
    </CommentProvider>
  )
}
