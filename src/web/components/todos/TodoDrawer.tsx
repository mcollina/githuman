/**
 * Todo drawer component - slide-out panel for todos
 */
import { cn } from '../../lib/utils';
import { TodoPanel } from './TodoPanel';

interface TodoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId?: string;
}

export function TodoDrawer({ isOpen, onClose, reviewId }: TodoDrawerProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        data-testid="todo-drawer"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[var(--gh-bg-secondary)] shadow-xl flex flex-col',
          'transition-transform duration-300 ease-in-out sm:border-l border-[var(--gh-border)]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--gh-border)]">
          <h2 className="font-semibold text-[var(--gh-text-primary)]">Todos</h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--gh-text-muted)] hover:text-[var(--gh-text-primary)] hover:bg-[var(--gh-bg-elevated)] rounded transition-colors"
            aria-label="Close todos"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <TodoPanel reviewId={reviewId} className="flex-1" />
      </aside>
    </>
  );
}
