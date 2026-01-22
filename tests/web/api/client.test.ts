import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setAuthToken, getAuthToken, clearAuthToken, api } from '../../../src/web/api/client'

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

describe('Auth token functions', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('setAuthToken', () => {
    it('should store token in localStorage', () => {
      setAuthToken('test-token-123')
      expect(localStorage.getItem('auth_token')).toBe('test-token-123')
    })

    it('should overwrite existing token', () => {
      setAuthToken('old-token')
      setAuthToken('new-token')
      expect(localStorage.getItem('auth_token')).toBe('new-token')
    })
  })

  describe('getAuthToken', () => {
    it('should return null when no token is stored', () => {
      expect(getAuthToken()).toBeNull()
    })

    it('should return stored token', () => {
      localStorage.setItem('auth_token', 'my-secret-token')
      expect(getAuthToken()).toBe('my-secret-token')
    })
  })

  describe('clearAuthToken', () => {
    it('should remove token from localStorage', () => {
      localStorage.setItem('auth_token', 'token-to-remove')
      clearAuthToken()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('should not throw when no token exists', () => {
      expect(() => clearAuthToken()).not.toThrow()
    })
  })
})

describe('API client authentication', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorageMock.clear()
    mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), { status: 200 })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorageMock.clear()
  })

  it('should not include Authorization header when no token', async () => {
    await api.get('/test')

    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('should include Authorization header when token is set', async () => {
    setAuthToken('bearer-test-token')

    await api.get('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-test-token',
        }),
      })
    )
  })

  it('should include Authorization header in POST requests', async () => {
    setAuthToken('post-token')

    await api.post('/test', { foo: 'bar' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer post-token',
        }),
      })
    )
  })

  it('should include Authorization header in PATCH requests', async () => {
    setAuthToken('patch-token')

    await api.patch('/test', { foo: 'bar' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer patch-token',
        }),
      })
    )
  })

  it('should include Authorization header in DELETE requests', async () => {
    setAuthToken('delete-token')

    await api.delete('/test')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer delete-token',
        }),
      })
    )
  })
})
