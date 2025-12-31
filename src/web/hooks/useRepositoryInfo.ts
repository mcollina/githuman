import { useState, useEffect } from 'react';
import { repoApi } from '../api/reviews';
import type { RepositoryInfo } from '../../shared/types';

interface UseRepositoryInfoResult {
  data: RepositoryInfo | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useRepositoryInfo(): UseRepositoryInfoResult {
  const [data, setData] = useState<RepositoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await repoApi.getInfo();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}
