/**
 * Reviews API
 */
import { api } from './client';
import type {
  Review,
  DiffFile,
  DiffSummary,
  RepositoryInfo,
  CreateReviewRequest,
  UpdateReviewRequest,
  PaginatedResponse,
} from '../../shared/types';

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
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return api.get<PaginatedResponse<ReviewListItem>>(`/reviews${query ? `?${query}` : ''}`);
  },

  get: (id: string) => api.get<ReviewWithDetails>(`/reviews/${id}`),

  create: (data: CreateReviewRequest) => api.post<ReviewWithDetails, CreateReviewRequest>('/reviews', data),

  update: (id: string, data: UpdateReviewRequest) =>
    api.patch<ReviewWithDetails, UpdateReviewRequest>(`/reviews/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/reviews/${id}`),

  getStats: () => api.get<ReviewStats>('/reviews/stats'),
};

// Diff API
export const diffApi = {
  getStaged: () => api.get<StagedDiffResponse>('/diff/staged'),

  getStagedFiles: () => api.get<StagedFilesResponse>('/diff/files'),
};

// Repository Info API
export const repoApi = {
  getInfo: () => api.get<RepositoryInfo>('/info'),
};
