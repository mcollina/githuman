/**
 * Comments API client
 */
import { api } from './client';
import type {
  Comment,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../../shared/types';

export interface CommentStats {
  total: number;
  resolved: number;
  unresolved: number;
  withSuggestions: number;
}

export const commentsApi = {
  getByReview: (reviewId: string) =>
    api.get<Comment[]>(`/reviews/${reviewId}/comments`),

  getByFile: (reviewId: string, filePath: string) =>
    api.get<Comment[]>(`/reviews/${reviewId}/comments?filePath=${encodeURIComponent(filePath)}`),

  getStats: (reviewId: string) =>
    api.get<CommentStats>(`/reviews/${reviewId}/comments/stats`),

  getById: (commentId: string) =>
    api.get<Comment>(`/comments/${commentId}`),

  create: (reviewId: string, data: CreateCommentRequest) =>
    api.post<Comment>(`/reviews/${reviewId}/comments`, data),

  update: (commentId: string, data: UpdateCommentRequest) =>
    api.patch<Comment>(`/comments/${commentId}`, data),

  delete: (commentId: string) =>
    api.delete<{ success: boolean }>(`/comments/${commentId}`),

  resolve: (commentId: string) =>
    api.post<Comment>(`/comments/${commentId}/resolve`, {}),

  unresolve: (commentId: string) =>
    api.post<Comment>(`/comments/${commentId}/unresolve`, {}),
};
