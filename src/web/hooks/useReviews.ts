import { useState, useEffect, useCallback } from 'react';
import { reviewsApi, type ReviewWithDetails, type ReviewListItem } from '../api/reviews';
import type { PaginatedResponse, CreateReviewRequest, UpdateReviewRequest } from '../../shared/types';

interface UseReviewsListResult {
  data: PaginatedResponse<ReviewListItem> | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useReviewsList(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): UseReviewsListResult {
  const [data, setData] = useState<PaginatedResponse<ReviewListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewsApi.list(params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.pageSize, params?.status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

interface UseReviewResult {
  data: ReviewWithDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useReview(id: string): UseReviewResult {
  const [data, setData] = useState<ReviewWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewsApi.get(id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

interface UseCreateReviewResult {
  create: (data: CreateReviewRequest) => Promise<ReviewWithDetails>;
  loading: boolean;
  error: Error | null;
}

export function useCreateReview(): UseCreateReviewResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = async (data: CreateReviewRequest): Promise<ReviewWithDetails> => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewsApi.create(data);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
}

interface UseUpdateReviewResult {
  update: (id: string, data: UpdateReviewRequest) => Promise<ReviewWithDetails>;
  loading: boolean;
  error: Error | null;
}

export function useUpdateReview(): UseUpdateReviewResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = async (id: string, data: UpdateReviewRequest): Promise<ReviewWithDetails> => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewsApi.update(id, data);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}
