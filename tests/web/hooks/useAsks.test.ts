import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAskSession } from '../../../src/web/hooks/useAsks'
import { ApiClientError } from '../../../src/web/api/client'
import type { AskSessionDetails } from '../../../src/shared/types'
import { asksApi } from '../../../src/web/api/asks'

vi.mock('../../../src/web/api/asks', () => ({
  asksApi: {
    get: vi.fn(),
    getFeedback: vi.fn(),
    continue: vi.fn(),
    cancel: vi.fn(),
    create: vi.fn(),
  },
}))

const mockedAsksApi = vi.mocked(asksApi)

function createAskDetails (overrides: Partial<AskSessionDetails> = {}): AskSessionDetails {
  return {
    id: 'ask-1',
    repositoryPath: '/repo',
    reviewId: 'review-1',
    message: 'Please review the ask flow.',
    status: 'waiting_for_human',
    assistantContext: null,
    createdAt: '2026-04-04T10:00:00.000Z',
    updatedAt: '2026-04-04T10:00:00.000Z',
    completedAt: null,
    review: {
      id: 'review-1',
      sourceType: 'branch',
      sourceRef: 'feature',
      baseRef: 'main',
      status: 'in_progress',
    },
    feedback: {
      reviewStatus: 'in_progress',
      todoCount: 0,
      commentCount: 0,
      unresolvedCommentCount: 0,
    },
    ...overrides,
  }
}

describe('useAskSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps existing data visible during background refetches', async () => {
    const initialData = createAskDetails()
    const refreshedData = createAskDetails({
      feedback: {
        reviewStatus: 'changes_requested',
        todoCount: 2,
        commentCount: 3,
        unresolvedCommentCount: 1,
      },
    })

    let resolveRefetch: ((value: AskSessionDetails) => void) | undefined

    mockedAsksApi.get
      .mockResolvedValueOnce(initialData)
      .mockImplementationOnce(async () => await new Promise<AskSessionDetails>((resolve) => {
        resolveRefetch = resolve
      }))

    const { result } = renderHook(() => useAskSession('ask-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(initialData)

    await act(async () => {
      const refetchPromise = result.current.refetch()

      expect(result.current.loading).toBe(false)
      expect(result.current.data).toEqual(initialData)

      resolveRefetch?.(refreshedData)
      await refetchPromise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(refreshedData)
  })

  it('preserves existing data when a background refetch fails', async () => {
    const initialData = createAskDetails()

    mockedAsksApi.get
      .mockResolvedValueOnce(initialData)
      .mockRejectedValueOnce(new ApiClientError('Request failed', 500))

    const { result } = renderHook(() => useAskSession('ask-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(initialData)

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(initialData)
    expect(result.current.error).toBeInstanceOf(ApiClientError)
  })
})
