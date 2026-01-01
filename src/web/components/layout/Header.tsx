import { Link } from 'react-router-dom';

interface HeaderProps {
  repoName?: string;
  branch?: string;
}

export function Header({ repoName, branch }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-lg sm:text-xl font-semibold text-gray-900 hover:text-gray-700">
          Code Review
        </Link>
        {repoName && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{repoName}</span>
            {branch && (
              <>
                <span className="text-gray-400">/</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                  {branch}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <nav className="flex items-center gap-2 sm:gap-4">
        <Link
          to="/staged"
          className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 px-2 sm:px-3 py-1.5 rounded hover:bg-gray-100"
        >
          <span className="hidden sm:inline">Staged Changes</span>
          <span className="sm:hidden">Staged</span>
        </Link>
        <Link
          to="/"
          className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 px-2 sm:px-3 py-1.5 rounded hover:bg-gray-100"
        >
          Reviews
        </Link>
      </nav>
    </header>
  );
}
