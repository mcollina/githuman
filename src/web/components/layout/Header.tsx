import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { Logo } from '../Logo'
import { useTheme } from '../../contexts/ThemeContext'

interface HeaderProps {
  repoName?: string;
  branch?: string;
  onToggleTodos?: () => void;
  todosOpen?: boolean;
  pendingTodos?: number;
}

export function Header ({ repoName, branch, onToggleTodos, todosOpen, pendingTodos }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className='bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] px-4 py-3 flex items-center justify-between'>
      <div className='flex items-center gap-4'>
        <Link to='/' className='hover:opacity-80 transition-opacity'>
          <Logo size='sm' showText />
        </Link>
        {repoName && (
          <div className='hidden sm:flex items-center gap-2 text-sm text-[var(--gh-text-secondary)]'>
            <span className='font-medium text-[var(--gh-text-primary)]'>{repoName}</span>
            {branch && (
              <>
                <span className='text-[var(--gh-text-muted)]'>/</span>
                <span className='gh-badge gh-badge-purple'>
                  {branch}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <nav className='flex items-center gap-2 sm:gap-3'>
        <Link
          to='/'
          className='text-xs sm:text-sm text-[var(--gh-text-secondary)] hover:text-[var(--gh-accent-primary)] px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[var(--gh-bg-elevated)] transition-colors'
        >
          <span className='hidden sm:inline'>Changes</span>
          <span className='sm:hidden'>Changes</span>
        </Link>
        <Link
          to='/reviews'
          className='text-xs sm:text-sm text-[var(--gh-text-secondary)] hover:text-[var(--gh-accent-primary)] px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[var(--gh-bg-elevated)] transition-colors'
        >
          Reviews
        </Link>
        {onToggleTodos && (
          <button
            onClick={onToggleTodos}
            className={cn(
              'relative text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-all',
              todosOpen
                ? 'bg-[var(--gh-accent-primary)]/10 text-[var(--gh-accent-primary)] shadow-[var(--gh-glow-cyan)]'
                : 'text-[var(--gh-text-secondary)] hover:text-[var(--gh-accent-primary)] hover:bg-[var(--gh-bg-elevated)]'
            )}
            aria-label='Toggle todos'
          >
            <span className='hidden sm:inline'>Todos</span>
            <svg className='w-4 h-4 sm:hidden' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' />
            </svg>
            {pendingTodos !== undefined && pendingTodos > 0 && (
              <span className='absolute -top-1 -right-1 bg-[var(--gh-accent-tertiary)] text-[var(--gh-bg-primary)] text-xs w-4 h-4 flex items-center justify-center rounded-full font-semibold'>
                {pendingTodos > 9 ? '9+' : pendingTodos}
              </span>
            )}
          </button>
        )}
        <button
          onClick={toggleTheme}
          className='text-[var(--gh-text-secondary)] hover:text-[var(--gh-accent-primary)] p-1.5 rounded-lg hover:bg-[var(--gh-bg-elevated)] transition-colors'
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' />
              </svg>
              )
            : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' />
              </svg>
              )}
        </button>
      </nav>
    </header>
  )
}
