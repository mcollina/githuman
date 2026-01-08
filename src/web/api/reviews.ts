/**
 * Reviews API
 */
import { api } from './client'
import type {
  Review,
  DiffFile,
  DiffSummary,
  RepositoryInfo,
  CreateReviewRequest,
  UpdateReviewRequest,
  PaginatedResponse,
} from '../../shared/types'

export interface ReviewWithDetails extends Omit<Review, 'snapshotData'> {
  files: DiffFile[];
  summary: DiffSummary;
  repository: RepositoryInfo;
}

export interface ReviewListItem extends Omit<Review, 'snapshotData'> {
  summary: DiffSummary;
}

export interface ReviewStats {
  total: number;
  inProgress: number;
  approved: number;
  changesRequested: number;
}

export interface StagedDiffResponse {
  files: DiffFile[];
  summary: DiffSummary;
  repository: RepositoryInfo;
}

export interface UnstagedDiffResponse {
  files: DiffFile[];
  summary: DiffSummary;
  repository: RepositoryInfo;
}

export interface UnstagedFile {
  path: string;
  status: 'modified' | 'deleted' | 'untracked';
}

export interface UnstagedStatusResponse {
  hasUnstagedChanges: boolean;
  files: UnstagedFile[];
}

export interface StageResponse {
  success: boolean;
  staged: string[];
}

export interface UnstageResponse {
  success: boolean;
  unstaged: string[];
}

export interface StagedFilesResponse {
  files: Array<{
    path: string;
    oldPath?: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
  }>;
  hasStagedChanges: boolean;
}

// Reviews API
export const reviewsApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return api.get<PaginatedResponse<ReviewListItem>>(`/reviews${query ? `?${query}` : ''}`)
  },

  get: (id: string) => api.get<ReviewWithDetails>(`/reviews/${id}`),

  create: (data: CreateReviewRequest) => api.post<ReviewWithDetails, CreateReviewRequest>('/reviews', data),

  update: (id: string, data: UpdateReviewRequest) =>
    api.patch<ReviewWithDetails, UpdateReviewRequest>(`/reviews/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/reviews/${id}`),

  getStats: () => api.get<ReviewStats>('/reviews/stats'),
}

// Diff API
export const diffApi = {
  getStaged: () => api.get<StagedDiffResponse>('/diff/staged'),

  getStagedFiles: () => api.get<StagedFilesResponse>('/diff/files'),

  getUnstaged: () => api.get<UnstagedDiffResponse>('/diff/unstaged'),
}

// Repository Info API
export const repoApi = {
  getInfo: () => api.get<RepositoryInfo>('/info'),
}

// Git API types
export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface CommitsResponse {
  commits: CommitInfo[];
  hasMore: boolean;
}

export interface GetCommitsParams {
  limit?: number;
  offset?: number;
  search?: string;
}

// Git API
export const gitApi = {
  getInfo: () => api.get<RepositoryInfo>('/git/info'),
  getBranches: () => api.get<BranchInfo[]>('/git/branches'),
  getCommits: (params: GetCommitsParams = {}) => {
    const searchParams = new URLSearchParams()
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.offset) searchParams.set('offset', params.offset.toString())
    if (params.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return api.get<CommitsResponse>(`/git/commits${query ? `?${query}` : ''}`)
  },
  hasStagedChanges: () => api.get<{ hasStagedChanges: boolean }>('/git/staged'),
  getUnstaged: () => api.get<UnstagedStatusResponse>('/git/unstaged'),
  stageFiles: (files: string[]) => api.post<StageResponse, { files: string[] }>('/git/stage', { files }),
  stageAll: () => api.post<StageResponse, Record<string, never>>('/git/stage-all', {}),
  unstageFiles: (files: string[]) => api.post<UnstageResponse, { files: string[] }>('/git/unstage', { files }),
}
