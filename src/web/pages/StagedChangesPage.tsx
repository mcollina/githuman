import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { DiffView } from '../components/diff/DiffView';
import { CommentProvider, useCommentContext, getLineKey } from '../contexts/CommentContext';
import { useStagedDiff } from '../hooks/useStagedDiff';
import { useCreateReview } from '../hooks/useReviews';

// Component to set active comment line after review is created
function PendingLineActivator({ pendingLine, onActivated }: {
  pendingLine: { filePath: string; lineNumber: number; lineType: 'added' | 'removed' | 'context' } | null;
  onActivated: () => void;
}) {
  const { setActiveCommentLine, reviewId } = useCommentContext();

  useEffect(() => {
    // Only activate when we have both a reviewId and a pending line
    if (reviewId && pendingLine) {
      const lineKey = getLineKey(pendingLine.filePath, pendingLine.lineNumber, pendingLine.lineType);
      setActiveCommentLine(lineKey);
      onActivated();

      // Scroll to the file
      setTimeout(() => {
        document.getElementById(pendingLine.filePath)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [reviewId, pendingLine, setActiveCommentLine, onActivated]);

  return null;
}

export function StagedChangesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useStagedDiff();
  const { create, loading: creating } = useCreateReview();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [createError, setCreateError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [pendingLine, setPendingLine] = useState<{
    filePath: string;
    lineNumber: number;
    lineType: 'added' | 'removed' | 'context';
  } | null>(null);

  const handleCreateReview = async () => {
    try {
      setCreateError(null);
      const review = await create({ sourceType: 'staged' });
      navigate(`/reviews/${review.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review');
    }
  };

  const handleLineClick = async (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => {
    // If we already have a review, don't create another one
    if (reviewId) return;

    try {
      setCreateError(null);
      // Store the pending line to activate after review is created
      setPendingLine({ filePath, lineNumber, lineType });
      const review = await create({ sourceType: 'staged' });
      setReviewId(review.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review');
      setPendingLine(null);
    }
  };

  const handlePendingLineActivated = useCallback(() => {
    setPendingLine(null);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="gh-spinner w-8 h-8 mx-auto"></div>
          <p className="mt-4 text-[var(--gh-text-secondary)]">Loading staged changes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="gh-card p-6 border-[var(--gh-error)]/30">
            <p className="text-[var(--gh-error)] mb-4">{error.message}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-[var(--gh-error)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--gh-error)]/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasChanges = data && data.files.length > 0;

  return (
    <CommentProvider reviewId={reviewId}>
      <PendingLineActivator pendingLine={pendingLine} onActivated={handlePendingLineActivated} />
      <div className="flex-1 flex min-w-0">
        {data && (
          <>
            <Sidebar
              files={data.files}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
            />
            <div className="flex-1 flex flex-col min-w-0">
              {hasChanges && (
                <div className="p-3 sm:p-4 border-b border-[var(--gh-border)] bg-[var(--gh-bg-secondary)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs sm:text-sm text-[var(--gh-text-secondary)]">
                      {reviewId
                        ? 'Click on any line to add comments'
                        : 'Click on a line to start a review, or use the button'}
                    </div>
                    {createError && (
                      <div className="mt-2 text-xs sm:text-sm text-[var(--gh-error)]">
                        {createError}
                      </div>
                    )}
                  </div>
                  {reviewId ? (
                    <button
                      onClick={() => navigate(`/reviews/${reviewId}`)}
                      className="inline-flex items-center px-3 sm:px-4 py-2 bg-[var(--gh-success)] text-[var(--gh-bg-primary)] text-xs sm:text-sm font-semibold rounded-lg hover:bg-[var(--gh-success)]/90 shrink-0 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline">Go to Review</span>
                      <span className="sm:hidden">Review</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateReview}
                      disabled={creating}
                      className="gh-btn gh-btn-primary inline-flex items-center text-xs sm:text-sm shrink-0"
                    >
                      <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden sm:inline">{creating ? 'Creating...' : 'Create Review'}</span>
                      <span className="sm:hidden">{creating ? '...' : 'Create'}</span>
                    </button>
                  )}
                </div>
              )}
              <DiffView
                files={data.files}
                summary={data.summary}
                selectedFile={selectedFile}
                allowComments={!!reviewId}
                onLineClick={reviewId ? undefined : handleLineClick}
              />
            </div>
          </>
        )}
      </div>
    </CommentProvider>
  );
}
