import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReviewsList } from '../hooks/useReviews';
import { reviewsApi } from '../api/reviews';
import { cn } from '../lib/utils';
import { Logo } from '../components/Logo';
import type { ReviewStatus, ReviewSourceType } from '../../shared/types';

function getStatusBadge(status: ReviewStatus) {
  const styles = {
    in_progress: 'gh-badge gh-badge-warning',
    approved: 'gh-badge gh-badge-success',
    changes_requested: 'gh-badge gh-badge-error',
  };

  const labels = {
    in_progress: 'In Progress',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
  };

  return (
    <span className={styles[status]}>
      {labels[status]}
    </span>
  );
}

function getSourceLabel(sourceType: ReviewSourceType, sourceRef: string | null) {
  if (sourceType === 'staged') {
    return 'Staged changes';
  }
  if (sourceType === 'branch' && sourceRef) {
    return `Branch: ${sourceRef}`;
  }
  if (sourceType === 'commits' && sourceRef) {
    const commits = sourceRef.split(',');
    if (commits.length === 1) {
      return `Commit: ${commits[0].slice(0, 8)}`;
    }
    return `${commits.length} commits`;
  }
  return 'Unknown';
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomePage() {
  const { data, loading, error, refetch } = useReviewsList();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await reviewsApi.delete(deleteId);
      setDeleteId(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete review:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[var(--gh-text-primary)]">Reviews</h1>
          <Link
            to="/new"
            className="gh-btn gh-btn-primary inline-flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Review
          </Link>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="gh-spinner w-8 h-8 mx-auto"></div>
            <p className="mt-4 text-[var(--gh-text-secondary)]">Loading reviews...</p>
          </div>
        )}

        {error && (
          <div className="gh-card p-4 border-[var(--gh-error)]/30">
            <p className="text-[var(--gh-error)]">{error.message}</p>
          </div>
        )}

        {data && data.data.length === 0 && (
          <div className="text-center py-16 gh-card gh-animate-in">
            <div className="mb-6">
              <Logo size="lg" showText={false} className="justify-center opacity-30" />
            </div>
            <p className="text-lg font-semibold text-[var(--gh-text-primary)]">No reviews yet</p>
            <p className="text-[var(--gh-text-secondary)] mt-2 max-w-sm mx-auto">
              Create a new review from staged changes, branches, or commits.
            </p>
            <Link
              to="/new"
              className="gh-btn gh-btn-primary inline-flex items-center mt-6 text-sm"
            >
              Create New Review
            </Link>
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="space-y-3">
            {data.data.map((review, index) => (
              <Link
                key={review.id}
                to={`/reviews/${review.id}`}
                className="gh-card block p-4 hover:border-[var(--gh-accent-primary)]/50 transition-all gh-animate-in group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="gh-badge gh-badge-info">
                        {getSourceLabel(review.sourceType, review.sourceRef)}
                      </span>
                      {getStatusBadge(review.status)}
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-[var(--gh-text-secondary)]">
                      <span className="font-mono">
                        {review.summary.totalFiles} files
                      </span>
                      <span className="font-mono text-[var(--gh-success)]">+{review.summary.totalAdditions}</span>
                      <span className="font-mono text-[var(--gh-error)]">-{review.summary.totalDeletions}</span>
                      <span className="text-[var(--gh-text-muted)]">{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(review.id, e)}
                    className="ml-4 p-2 text-[var(--gh-text-muted)] hover:text-[var(--gh-error)] hover:bg-[var(--gh-error)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete review"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}

        {data && data.total > data.pageSize && (
          <div className="mt-6 text-center text-sm text-[var(--gh-text-muted)]">
            Showing {data.data.length} of {data.total} reviews
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="gh-card w-full max-w-sm mx-4 gh-animate-in">
            <div className="p-5">
              <h2 className="text-lg font-bold text-[var(--gh-text-primary)]">Delete Review</h2>
              <p className="mt-2 text-sm text-[var(--gh-text-secondary)]">
                Are you sure you want to delete this review? This action cannot be undone.
              </p>
            </div>
            <div className="p-4 border-t border-[var(--gh-border)] flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-[var(--gh-error)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--gh-error)]/90 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
