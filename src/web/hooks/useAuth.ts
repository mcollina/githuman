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
}

export function useAuth () {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    authRequired: false,
    isAuthenticated: false,
    error: null,
  })

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
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
        if (testResponse.status === 401) {
          // Token is invalid, clear it
          clearAuthToken()
          setState({
            isLoading: false,
            authRequired: true,
            isAuthenticated: false,
            error: 'Invalid token',
          })
          return
        }
      }

      setState({
        isLoading: false,
        authRequired: data.authRequired,
        isAuthenticated,
        error: null,
      })
    } catch {
      setState({
        isLoading: false,
        authRequired: false,
        isAuthenticated: false,
        error: 'Failed to connect to server',
      })
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = useCallback(async (token: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // Verify the token works
      const response = await fetch('/api/git/info', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Invalid token',
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
      }))
      return true
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to verify token',
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
