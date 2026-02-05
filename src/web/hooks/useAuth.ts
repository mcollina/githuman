/**
 * Hook for managing authentication state
 */
import { useState, useEffect, useCallback } from 'react'
import { getAuthToken, setAuthToken, clearAuthToken } from '../api/client'
import type { HealthResponse } from '../../shared/types'

interface AuthState {
  isLoading: boolean
  authRequired: boolean
  isAuthenticated: boolean
  error: string | null
  retryAfter: number | null // seconds until retry allowed (429 response)
}

export function useAuth () {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    authRequired: false,
    isAuthenticated: false,
    error: null,
    retryAfter: null,
  })

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, retryAfter: null }))

    try {
      // Check for token in URL
      const urlParams = new URLSearchParams(window.location.search)
      const urlToken = urlParams.get('token')

      if (urlToken) {
        // Verify the URL token
        const testResponse = await fetch('/api/git/info', {
          headers: { Authorization: `Bearer ${urlToken}` },
        })

        if (testResponse.ok) {
          setAuthToken(urlToken)
          // valid token, clean up URL
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.delete('token')
          window.history.replaceState({}, '', newUrl.toString())
        }
      }

      // Check health endpoint (no auth required for this)
      const response = await fetch('/api/health')
      const data = (await response.json()) as HealthResponse

      const token = getAuthToken()
      const isAuthenticated = !data.authRequired || !!token

      // If auth is required and we have a token, verify it works
      if (data.authRequired && token) {
        const testResponse = await fetch('/api/git/info', {
          headers: { Authorization: `Bearer ${token}` },
        })

        // Handle rate limiting
        if (testResponse.status === 429) {
          const retryAfter = parseInt(testResponse.headers.get('Retry-After') ?? '0', 10)
          setState({
            isLoading: false,
            authRequired: true,
            isAuthenticated: false,
            error: `Too many failed attempts. Retry in ${retryAfter} seconds.`,
            retryAfter,
          })
          return
        }

        if (testResponse.status === 401) {
          // Token is invalid, clear it
          clearAuthToken()
          setState({
            isLoading: false,
            authRequired: true,
            isAuthenticated: false,
            error: 'Invalid token',
            retryAfter: null,
          })
          return
        }
      }

      setState({
        isLoading: false,
        authRequired: data.authRequired,
        isAuthenticated,
        error: null,
        retryAfter: null,
      })
    } catch {
      setState({
        isLoading: false,
        authRequired: false,
        isAuthenticated: false,
        error: 'Failed to connect to server',
        retryAfter: null,
      })
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (token: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null, retryAfter: null }))

    try {
      // Verify the token works
      const response = await fetch('/api/git/info', {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '0', 10)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Too many failed attempts. Retry in ${retryAfter} seconds.`,
          retryAfter,
        }))
        return false
      }

      if (response.status === 401) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Invalid token',
          retryAfter: null,
        }))
        return false
      }

      // Token is valid, store it
      setAuthToken(token)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: true,
        error: null,
        retryAfter: null,
      }))
      return true
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to verify token',
        retryAfter: null,
      }))
      return false
    }
  }, [])

  const logout = useCallback(() => {
    clearAuthToken()
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
    }))
  }, [])

  return {
    ...state,
    login,
    logout,
    checkAuth,
  }
}
