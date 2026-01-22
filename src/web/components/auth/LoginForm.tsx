/**
 * Login form component for token authentication
 */
import { useState, type FormEvent } from 'react'

interface LoginFormProps {
  onLogin: (token: string) => Promise<boolean>
  error: string | null
  isLoading: boolean
}

export function LoginForm ({ onLogin, error, isLoading }: LoginFormProps) {
  const [token, setToken] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!token.trim()) {
      setLocalError('Please enter a token')
      return
    }

    const success = await onLogin(token.trim())
    if (!success) {
      setToken('')
    }
  }

  const displayError = error || localError

  return (
    <div className='min-h-screen flex items-center justify-center bg-[var(--gh-bg-primary)]'>
      <div className='w-full max-w-md p-8'>
        <div className='text-center mb-8'>
          <h1 className='text-2xl font-semibold text-[var(--gh-text-primary)] mb-2'>
            GitHuman
          </h1>
          <p className='text-[var(--gh-text-secondary)]'>
            Authentication required
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='token'
              className='block text-sm font-medium text-[var(--gh-text-secondary)] mb-2'
            >
              Access Token
            </label>
            <input
              id='token'
              type='password'
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder='Enter your access token'
              disabled={isLoading}
              className='w-full px-3 py-2 rounded-md border border-[var(--gh-border-primary)]
                       bg-[var(--gh-bg-secondary)] text-[var(--gh-text-primary)]
                       placeholder-[var(--gh-text-tertiary)]
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed'
              autoFocus
            />
          </div>

          {displayError && (
            <div className='p-3 rounded-md bg-red-500/10 border border-red-500/20'>
              <p className='text-sm text-red-400'>{displayError}</p>
            </div>
          )}

          <button
            type='submit'
            disabled={isLoading}
            className='w-full py-2 px-4 rounded-md font-medium
                     bg-[var(--gh-btn-primary-bg)] text-[var(--gh-btn-primary-text)]
                     hover:bg-[var(--gh-btn-primary-hover-bg)]
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors'
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <p className='mt-6 text-center text-sm text-[var(--gh-text-tertiary)]'>
          The token was provided when the server started.
          <br />
          Check your terminal for the URL with the token.
        </p>
      </div>
    </div>
  )
}
