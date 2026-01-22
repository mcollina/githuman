import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../../../src/web/hooks/useAuth'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useAuth', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorageMock.clear()
    mockFetch = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorageMock.clear()
  })

  it('should start with loading state', () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', authRequired: false }), { status: 200 })
    )

    const { result } = renderHook(() => useAuth())

    expect(result.current.isLoading).toBe(true)
  })

  it('should set isAuthenticated to true when auth is not required', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', authRequired: false }), { status: 200 })
    )

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.authRequired).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should set isAuthenticated to false when auth is required and no token', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
    )

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.authRequired).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should verify token when auth is required and token exists', async () => {
    localStorageMock.setItem('auth_token', 'valid-token')

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'repo' }), { status: 200 })
      )

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.authRequired).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should clear invalid token and set isAuthenticated to false', async () => {
    localStorageMock.setItem('auth_token', 'invalid-token')

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.authRequired).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBe('Invalid token')
    expect(localStorageMock.getItem('auth_token')).toBeNull()
  })

  describe('login', () => {
    it('should store token and set isAuthenticated on successful login', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ name: 'repo' }), { status: 200 })
        )

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let loginResult: boolean
      await act(async () => {
        loginResult = await result.current.login('new-valid-token')
      })

      expect(loginResult!).toBe(true)
      expect(result.current.isAuthenticated).toBe(true)
      expect(localStorageMock.getItem('auth_token')).toBe('new-valid-token')
    })

    it('should return false and show error on failed login', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let loginResult: boolean
      await act(async () => {
        loginResult = await result.current.login('invalid-token')
      })

      expect(loginResult!).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Invalid token')
    })
  })

  describe('logout', () => {
    it('should clear token and set isAuthenticated to false', async () => {
      localStorageMock.setItem('auth_token', 'valid-token')

      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'ok', authRequired: true }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ name: 'repo' }), { status: 200 })
        )

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorageMock.getItem('auth_token')).toBeNull()
    })
  })
})
