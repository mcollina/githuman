import { useCallback, useEffect, useState } from 'react'
import { asksApi } from '../api/asks'
import { ApiClientError } from '../api/client'
import type { AskFeedback, AskSession, AskSessionDetails } from '../../shared/types'

interface UseAskSessionResult {
  data: AskSessionDetails | null;
  loading: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

export function useAskSession (id: string): UseAskSessionResult {
  const [data, setData] = useState<AskSessionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiClientError | null>(null)

  const fetchData = useCallback(async (showLoadingState: boolean) => {
    if (!id) return

    if (showLoadingState) {
      setLoading(true)
      setError(null)
    }

    try {
      setData(await asksApi.get(id))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500))
    } finally {
      if (showLoadingState) {
        setLoading(false)
      }
    }
  }, [id])

  useEffect(() => {
    setData(null)
    setError(null)
    setLoading(true)
    fetchData(true)
  }, [id, fetchData])

  const refetch = useCallback(async () => {
    await fetchData(false)
  }, [fetchData])

  return { data, loading, error, refetch }
}

interface UseAskMutationResult<T> {
  mutate: (id: string) => Promise<T>;
  loading: boolean;
  error: ApiClientError | null;
}

function useAskMutation<T> (fn: (id: string) => Promise<T>): UseAskMutationResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const mutate = useCallback(async (id: string): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      return await fn(id)
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [fn])

  return { mutate, loading, error }
}

export function useContinueAsk (): UseAskMutationResult<AskSession> {
  return useAskMutation(asksApi.continue)
}

export function useCancelAsk (): UseAskMutationResult<AskSession> {
  return useAskMutation(asksApi.cancel)
}

export function useAskFeedback (id: string) {
  const [data, setData] = useState<AskFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiClientError | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setData(await asksApi.getFeedback(id))
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
