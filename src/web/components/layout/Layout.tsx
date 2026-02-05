import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { TodoDrawer } from '../todos'
import { LoginForm } from '../auth'
import { VersionBanner } from '../VersionBanner'
import { useRepositoryInfo } from '../../hooks/useRepositoryInfo'
import { useTodoStats } from '../../hooks/useTodos'
import { useAuth } from '../../hooks/useAuth'

export function Layout () {
  const { isLoading, authRequired, isAuthenticated, error, login } = useAuth()
  const { data: repoInfo } = useRepositoryInfo()
  const { stats } = useTodoStats()
  const [todosOpen, setTodosOpen] = useState(false)

  const handleToggleTodos = useCallback(() => {
    setTodosOpen((prev) => !prev)
  }, [])

  const handleCloseTodos = useCallback(() => {
    setTodosOpen(false)
  }, [])

  // Show login form if auth is required but not authenticated
  if (!isLoading && authRequired && !isAuthenticated) {
    return <LoginForm onLogin={login} error={error} isLoading={isLoading} />
  }

  return (
    <div className='min-h-screen flex flex-col bg-[var(--gh-bg-primary)]'>
      <VersionBanner />
      <Header
        repoName={repoInfo?.name}
        branch={repoInfo?.branch}
        onToggleTodos={handleToggleTodos}
        todosOpen={todosOpen}
        pendingTodos={stats?.pending}
      />
      <main className='flex-1 flex min-w-0'>
        <Outlet />
      </main>
      <TodoDrawer isOpen={todosOpen} onClose={handleCloseTodos} />
    </div>
  )
}
