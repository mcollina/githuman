import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { DiffView } from '../components/diff/DiffView';
import { CommentProvider, useCommentContext } from '../contexts/CommentContext';
import { useCommentStats } from '../hooks/useComments';
import { useReview, useUpdateReview } from '../hooks/useReviews';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { reviewsApi } from '../api/reviews';
import { cn } from '../lib/utils';
import type { ReviewStatus } from '../../shared/types';

const statusOptions: { value: ReviewStatus; label: string; color: string }[] = [
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { value: 'changes_requested', label: 'Changes Requested', color: 'bg-red-100 text-red-700' },
];

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

function CommentStats({ reviewId }: { reviewId: string }) {
  const { stats } = useCommentStats(reviewId);

  if (!stats || stats.total === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500">
        <span className="font-medium">{stats.total}</span> comments
      </span>
      {stats.unresolved > 0 && (
        <span className="text-orange-600">
          <span className="font-medium">{stats.unresolved}</span> unresolved
        </span>
      )}
      {stats.resolved > 0 && (
        <span className="text-green-600">
          <span className="font-medium">{stats.resolved}</span> resolved
        </span>
      )}
    </div>
  );
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useReview(id!);
  const { update, loading: updating } = useUpdateReview();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleNextFile = useCallback(() => {
    if (!data?.files.length) return;
    const nextIndex = Math.min(selectedFileIndex + 1, data.files.length - 1);
    setSelectedFileIndex(nextIndex);
    const file = data.files[nextIndex];
    const path = file.newPath || file.oldPath;
    setSelectedFile(path);
    // Scroll the file into view
    document.getElementById(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data?.files, selectedFileIndex]);

  const handlePrevFile = useCallback(() => {
    if (!data?.files.length) return;
    const prevIndex = Math.max(selectedFileIndex - 1, 0);
    setSelectedFileIndex(prevIndex);
    const file = data.files[prevIndex];
    const path = file.newPath || file.oldPath;
    setSelectedFile(path);
    document.getElementById(path)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data?.files, selectedFileIndex]);

  const handleEscape = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  useKeyboardShortcuts({
    onNextFile: handleNextFile,
    onPrevFile: handlePrevFile,
    onEscape: handleEscape,
    enabled: !loading && !!data,
  });

  const handleStatusChange = async (status: ReviewStatus) => {
    if (!id) return;
    await update(id, { status });
    refetch();
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await reviewsApi.delete(id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete review:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-700 mb-4">{error.message}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
            >
              Back to Reviews
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const currentStatus = statusOptions.find((s) => s.value === data.status);

  return (
    <CommentProvider reviewId={id!}>
      <div className="flex-1 flex">
        <Sidebar
          files={data.files}
          selectedFile={selectedFile}
          onFileSelect={(path) => {
            setSelectedFile(path);
            const index = data.files.findIndex((f) => (f.newPath || f.oldPath) === path);
            if (index >= 0) setSelectedFileIndex(index);
          }}
          selectedIndex={selectedFileIndex}
        />
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{data.title}</h1>
                {data.description && (
                  <p className="mt-1 text-sm text-gray-500">{data.description}</p>
                )}
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>Created {formatDate(data.createdAt)}</span>
                  {data.baseRef && (
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {data.baseRef.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <CommentStats reviewId={id!} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={data.status}
                  onChange={(e) => handleStatusChange(e.target.value as ReviewStatus)}
                  disabled={updating}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg border-0 cursor-pointer',
                    currentStatus?.color
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
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          <DiffView
            files={data.files}
            summary={data.summary}
            selectedFile={selectedFile}
            allowComments={true}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900">Delete Review</h2>
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete this review? This action cannot be undone.
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CommentProvider>
  );
}
