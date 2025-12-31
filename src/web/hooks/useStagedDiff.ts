import { useState, useEffect, useCallback } from 'react';
import { diffApi, type StagedDiffResponse } from '../api/reviews';

interface UseStagedDiffResult {
  data: StagedDiffResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useStagedDiff(): UseStagedDiffResult {
  const [data, setData] = useState<StagedDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await diffApi.getStaged();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
