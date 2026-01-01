import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { DiffView } from '../components/diff/DiffView';
import { useStagedDiff } from '../hooks/useStagedDiff';
import { useCreateReview } from '../hooks/useReviews';

export function StagedChangesPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useStagedDiff();
  const { create, loading: creating } = useCreateReview();
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateReview = async () => {
    if (!title.trim()) {
      setCreateError('Title is required');
      return;
    }

    try {
      const review = await create({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setShowModal(false);
      navigate(`/reviews/${review.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading staged changes...</p>
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
              onClick={refetch}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
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
    <>
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
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-600">
                    Review your staged changes before creating a review
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 shrink-0"
                  >
                    <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">Create Review</span>
                    <span className="sm:hidden">Create</span>
                  </button>
                </div>
              )}
              <DiffView
                files={data.files}
                summary={data.summary}
                selectedFile={selectedFile}
              />
            </div>
          </>
        )}
      </div>

      {/* Create Review Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create Review</h2>
            </div>
            <div className="p-4 space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {createError}
                </div>
              )}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter review title"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReview}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
