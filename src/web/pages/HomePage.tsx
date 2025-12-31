import { Link } from 'react-router-dom';
import { useReviewsList } from '../hooks/useReviews';
import { cn } from '../lib/utils';
import type { ReviewStatus } from '../../shared/types';

function getStatusBadge(status: ReviewStatus) {
  const styles = {
    in_progress: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    changes_requested: 'bg-red-100 text-red-700',
  };

  const labels = {
    in_progress: 'In Progress',
    approved: 'Approved',
    changes_requested: 'Changes Requested',
  };

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', styles[status])}>
      {labels[status]}
    </span>
  );
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
  const { data, loading, error } = useReviewsList();

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Reviews</h1>
          <Link
            to="/staged"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Review
          </Link>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading reviews...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error.message}</p>
          </div>
        )}

        {data && data.data.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium text-gray-700">No reviews yet</p>
            <p className="text-gray-500 mt-1">
              Stage some changes and create a new review to get started.
            </p>
            <Link
              to="/staged"
              className="inline-flex items-center mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              View Staged Changes
            </Link>
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            {data.data.map((review) => (
              <Link
                key={review.id}
                to={`/reviews/${review.id}`}
                className="block p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-medium text-gray-900 truncate">
                      {review.title}
                    </h2>
                    {review.description && (
                      <p className="mt-1 text-sm text-gray-500 truncate">
                        {review.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        {review.summary.totalFiles} files
                      </span>
                      <span className="text-green-600">+{review.summary.totalAdditions}</span>
                      <span className="text-red-600">-{review.summary.totalDeletions}</span>
                      <span>{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(review.status)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {data && data.total > data.pageSize && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing {data.data.length} of {data.total} reviews
          </div>
        )}
      </div>
    </div>
  );
}
