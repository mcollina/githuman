import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TodoDrawer } from '../todos';
import { useRepositoryInfo } from '../../hooks/useRepositoryInfo';
import { useTodoStats } from '../../hooks/useTodos';

export function Layout() {
  const { data: repoInfo } = useRepositoryInfo();
  const { stats } = useTodoStats();
  const [todosOpen, setTodosOpen] = useState(false);

  const handleToggleTodos = useCallback(() => {
    setTodosOpen((prev) => !prev);
  }, []);

  const handleCloseTodos = useCallback(() => {
    setTodosOpen(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--gh-bg-primary)]">
      <Header
        repoName={repoInfo?.name}
        branch={repoInfo?.branch}
        onToggleTodos={handleToggleTodos}
        todosOpen={todosOpen}
        pendingTodos={stats?.pending}
      />
      <main className="flex-1 flex min-w-0">
        <Outlet />
      </main>
      <TodoDrawer isOpen={todosOpen} onClose={handleCloseTodos} />
    </div>
  );
}
