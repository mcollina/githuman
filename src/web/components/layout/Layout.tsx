import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { useRepositoryInfo } from '../../hooks/useRepositoryInfo';

export function Layout() {
  const { data: repoInfo } = useRepositoryInfo();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header repoName={repoInfo?.name} branch={repoInfo?.branch} />
      <main className="flex-1 flex min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
