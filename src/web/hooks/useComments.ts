/**
 * Hooks for comment management
 */
import { useState, useEffect, useCallback } from 'react';
import { commentsApi, type CommentStats } from '../api/comments';
import { ApiClientError } from '../api/client';
import type { Comment, CreateCommentRequest, UpdateCommentRequest } from '../../shared/types';

interface UseCommentsResult {
  comments: Comment[];
  loading: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

interface UseCommentStatsResult {
  stats: CommentStats | null;
  loading: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

export function useComments(reviewId: string): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);

  const fetch = useCallback(async () => {
    if (!reviewId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await commentsApi.getByReview(reviewId);
      setComments(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500));
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { comments, loading, error, refetch: fetch };
}

export function useCommentStats(reviewId: string): UseCommentStatsResult {
  const [stats, setStats] = useState<CommentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);

  const fetch = useCallback(async () => {
    if (!reviewId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await commentsApi.getStats(reviewId);
      setStats(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500));
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, loading, error, refetch: fetch };
}

interface UseCreateCommentResult {
  create: (reviewId: string, data: CreateCommentRequest) => Promise<Comment>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useCreateComment(): UseCreateCommentResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const create = async (reviewId: string, data: CreateCommentRequest): Promise<Comment> => {
    setLoading(true);
    setError(null);
    try {
      const comment = await commentsApi.create(reviewId, data);
      return comment;
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
}

interface UseUpdateCommentResult {
  update: (commentId: string, data: UpdateCommentRequest) => Promise<Comment>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useUpdateComment(): UseUpdateCommentResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const update = async (commentId: string, data: UpdateCommentRequest): Promise<Comment> => {
    setLoading(true);
    setError(null);
    try {
      const comment = await commentsApi.update(commentId, data);
      return comment;
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}

interface UseResolveCommentResult {
  resolve: (commentId: string) => Promise<Comment>;
  unresolve: (commentId: string) => Promise<Comment>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useResolveComment(): UseResolveCommentResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const resolve = async (commentId: string): Promise<Comment> => {
    setLoading(true);
    setError(null);
    try {
      const comment = await commentsApi.resolve(commentId);
      return comment;
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  const unresolve = async (commentId: string): Promise<Comment> => {
    setLoading(true);
    setError(null);
    try {
      const comment = await commentsApi.unresolve(commentId);
      return comment;
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { resolve, unresolve, loading, error };
}

interface UseDeleteCommentResult {
  deleteComment: (commentId: string) => Promise<void>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useDeleteComment(): UseDeleteCommentResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const deleteComment = async (commentId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await commentsApi.delete(commentId);
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  };

  return { deleteComment, loading, error };
}
