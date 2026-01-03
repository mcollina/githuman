import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gitApi, type BranchInfo, type CommitInfo } from '../api/reviews';
import { useCreateReview } from '../hooks/useReviews';
import { cn } from '../lib/utils';

type ReviewSource = 'staged' | 'branch' | 'commits';

export function NewReviewPage() {
  const navigate = useNavigate();
  const { create, loading: creating } = useCreateReview();
  const [source, setSource] = useState<ReviewSource>('staged');
  const [hasStagedChanges, setHasStagedChanges] = useState<boolean | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [staged, branchList, commitList] = await Promise.all([
          gitApi.hasStagedChanges(),
          gitApi.getBranches(),
          gitApi.getCommits(50),
        ]);
        setHasStagedChanges(staged.hasStagedChanges);
        setBranches(branchList);
        setCommits(commitList);

        // Default to staged if there are staged changes, otherwise branch
        if (!staged.hasStagedChanges && branchList.length > 0) {
          setSource('branch');
          // Select first non-current branch
          const nonCurrent = branchList.find(b => !b.isCurrent);
          if (nonCurrent) {
            setSelectedBranch(nonCurrent.name);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load repository info');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateReview = async () => {
    setCreateError(null);
    try {
      let review;
      if (source === 'staged') {
        review = await create({ sourceType: 'staged' });
      } else if (source === 'branch' && selectedBranch) {
        review = await create({ sourceType: 'branch', sourceRef: selectedBranch });
      } else if (source === 'commits' && selectedCommits.length > 0) {
        review = await create({ sourceType: 'commits', sourceRef: selectedCommits.join(',') });
      } else {
        setCreateError('Please select a source for the review');
        return;
      }
      navigate(`/reviews/${review.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create review');
    }
  };

  const toggleCommit = (sha: string) => {
    setSelectedCommits(prev =>
      prev.includes(sha)
        ? prev.filter(s => s !== sha)
        : [...prev, sha]
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="gh-spinner w-8 h-8 mx-auto"></div>
          <p className="mt-4 text-[var(--gh-text-secondary)]">Loading repository info...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="gh-card p-6 border-[var(--gh-error)]/30">
          <p className="text-[var(--gh-error)]">{error}</p>
        </div>
      </div>
    );
  }

  const canCreate =
    (source === 'staged' && hasStagedChanges) ||
    (source === 'branch' && selectedBranch) ||
    (source === 'commits' && selectedCommits.length > 0);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--gh-text-primary)] mb-6">Create New Review</h1>

        {createError && (
          <div className="mb-6 gh-card p-4 border-[var(--gh-error)]/30">
            <p className="text-[var(--gh-error)]">{createError}</p>
          </div>
        )}

        {/* Source Selection */}
        <div className="gh-card divide-y divide-[var(--gh-border)]">
          {/* Staged Changes */}
          <button
            onClick={() => setSource('staged')}
            className={cn(
              'w-full p-4 text-left hover:bg-[var(--gh-bg-elevated)] flex items-start gap-4 transition-colors',
              source === 'staged' && 'bg-[var(--gh-accent-primary)]/5'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
              source === 'staged' ? 'border-[var(--gh-accent-primary)]' : 'border-[var(--gh-border)]'
            )}>
              {source === 'staged' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--gh-accent-primary)]" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[var(--gh-text-primary)]">Staged Changes</div>
              <div className="text-sm text-[var(--gh-text-secondary)] mt-1">
                {hasStagedChanges
                  ? 'Review the currently staged changes in git'
                  : 'No staged changes available'
                }
              </div>
            </div>
            {hasStagedChanges && (
              <span className="gh-badge gh-badge-success">
                Available
              </span>
            )}
          </button>

          {/* Branch Comparison */}
          <button
            onClick={() => setSource('branch')}
            className={cn(
              'w-full p-4 text-left hover:bg-[var(--gh-bg-elevated)] flex items-start gap-4 transition-colors',
              source === 'branch' && 'bg-[var(--gh-accent-primary)]/5'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
              source === 'branch' ? 'border-[var(--gh-accent-primary)]' : 'border-[var(--gh-border)]'
            )}>
              {source === 'branch' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--gh-accent-primary)]" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[var(--gh-text-primary)]">Branch Comparison</div>
              <div className="text-sm text-[var(--gh-text-secondary)] mt-1">
                Compare current branch against another branch
              </div>
            </div>
          </button>

          {/* Commits */}
          <button
            onClick={() => setSource('commits')}
            className={cn(
              'w-full p-4 text-left hover:bg-[var(--gh-bg-elevated)] flex items-start gap-4 transition-colors',
              source === 'commits' && 'bg-[var(--gh-accent-primary)]/5'
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
              source === 'commits' ? 'border-[var(--gh-accent-primary)]' : 'border-[var(--gh-border)]'
            )}>
              {source === 'commits' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--gh-accent-primary)]" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[var(--gh-text-primary)]">Specific Commits</div>
              <div className="text-sm text-[var(--gh-text-secondary)] mt-1">
                Select one or more commits to review
              </div>
            </div>
          </button>
        </div>

        {/* Branch Selection */}
        {source === 'branch' && (
          <div className="mt-6 gh-card p-4">
            <label className="block text-sm font-semibold text-[var(--gh-text-primary)] mb-2">
              Compare against branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="gh-input w-full"
            >
              <option value="">Select a branch...</option>
              {branches.filter(b => !b.isCurrent).map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name} {branch.isRemote && '(remote)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--gh-text-muted)] mt-2">
              Shows changes from the selected branch to current HEAD
            </p>
          </div>
        )}

        {/* Commit Selection */}
        {source === 'commits' && (
          <div className="mt-6 gh-card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-[var(--gh-text-primary)]">
                Select commits to review
              </label>
              {selectedCommits.length > 0 && (
                <span className="text-xs text-[var(--gh-accent-primary)]">
                  {selectedCommits.length} selected
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto border border-[var(--gh-border)] rounded-lg divide-y divide-[var(--gh-border)]">
              {commits.map((commit) => (
                <button
                  key={commit.sha}
                  onClick={() => toggleCommit(commit.sha)}
                  className={cn(
                    'w-full p-3 text-left hover:bg-[var(--gh-bg-elevated)] flex items-start gap-3 transition-colors',
                    selectedCommits.includes(commit.sha) && 'bg-[var(--gh-accent-primary)]/5'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center mt-0.5 transition-colors',
                    selectedCommits.includes(commit.sha)
                      ? 'border-[var(--gh-accent-primary)] bg-[var(--gh-accent-primary)]'
                      : 'border-[var(--gh-border)]'
                  )}>
                    {selectedCommits.includes(commit.sha) && (
                      <svg className="w-3 h-3 text-[var(--gh-bg-primary)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--gh-accent-primary)]">{commit.sha.slice(0, 7)}</span>
                      <span className="text-xs text-[var(--gh-text-muted)]">{commit.author}</span>
                    </div>
                    <div className="text-sm text-[var(--gh-text-primary)] truncate mt-0.5">{commit.message}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-elevated)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateReview}
            disabled={!canCreate || creating}
            className={cn(
              'gh-btn gh-btn-primary text-sm',
              (!canCreate || creating) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {creating ? 'Creating...' : 'Create Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
