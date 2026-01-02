/**
 * Todo panel component - main container for todo list
 */
import { useState, useCallback, useRef, type DragEvent, type TouchEvent } from 'react';
import { cn } from '../../lib/utils';
import { TodoItem } from './TodoItem';
import { TodoInput } from './TodoInput';
import {
  useTodos,
  useTodoStats,
  useCreateTodo,
  useToggleTodo,
  useDeleteTodo,
  useClearCompleted,
  useReorderTodos,
} from '../../hooks/useTodos';

type FilterState = 'all' | 'pending' | 'completed';

interface TodoPanelProps {
  reviewId?: string;
  className?: string;
}

export function TodoPanel({ reviewId, className }: TodoPanelProps) {
  const [filter, setFilter] = useState<FilterState>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const touchStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filters = filter === 'all'
    ? { reviewId }
    : { reviewId, completed: filter === 'completed' };

  const { todos, loading, refetch } = useTodos(filters);
  const { stats, refetch: refetchStats } = useTodoStats();
  const { create, loading: creating } = useCreateTodo();
  const { toggle, loading: toggling } = useToggleTodo();
  const { deleteTodo, loading: deleting } = useDeleteTodo();
  const { clearCompleted, loading: clearing } = useClearCompleted();
  const { reorder, loading: reordering } = useReorderTodos();

  const isDisabled = creating || toggling || deleting || clearing || reordering;

  const handleAdd = useCallback(async (content: string) => {
    await create({ content, reviewId });
    refetch();
    refetchStats();
  }, [create, reviewId, refetch, refetchStats]);

  const handleToggle = useCallback(async (id: string) => {
    await toggle(id);
    refetch();
    refetchStats();
  }, [toggle, refetch, refetchStats]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteTodo(id);
    refetch();
    refetchStats();
  }, [deleteTodo, refetch, refetchStats]);

  const handleClearCompleted = useCallback(async () => {
    await clearCompleted();
    refetch();
    refetchStats();
  }, [clearCompleted, refetch, refetchStats]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (id !== draggedId) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    // Get the full list of todos (we need all todos for proper reordering)
    const currentOrder = todos.map((t) => t.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Create new order
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    handleDragEnd();
    await reorder(newOrder);
    refetch();
  }, [draggedId, todos, reorder, refetch, handleDragEnd]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>, id: string) => {
    touchStartY.current = e.touches[0].clientY;
    setDraggedId(id);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!draggedId || !listRef.current) return;

    const touch = e.touches[0];
    const elements = listRef.current.querySelectorAll('[data-todo-id]');

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const todoId = el.getAttribute('data-todo-id');

      if (
        todoId &&
        todoId !== draggedId &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        setDragOverId(todoId);
        return;
      }
    }
    setDragOverId(null);
  }, [draggedId]);

  const handleTouchEnd = useCallback(async () => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentOrder = todos.map((t) => t.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(dragOverId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    setDraggedId(null);
    setDragOverId(null);
    await reorder(newOrder);
    refetch();
  }, [draggedId, dragOverId, todos, reorder, refetch]);

  const filterButtons: { value: FilterState; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Done' },
  ];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700">
            Todos
            {stats && (
              <span className="ml-1 text-gray-400">
                ({stats.pending} pending)
              </span>
            )}
          </h2>
          {stats && stats.completed > 0 && (
            <button
              onClick={handleClearCompleted}
              disabled={isDisabled}
              className={cn(
                'text-xs text-gray-500 hover:text-red-600',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              Clear done
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={cn(
                'px-2 py-1 text-xs rounded',
                filter === btn.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add input */}
      <div className="p-3 border-b border-gray-200">
        <TodoInput onAdd={handleAdd} disabled={isDisabled} />
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto p-2" ref={listRef}>
        {loading ? (
          <p className="text-sm text-gray-500 px-2">Loading...</p>
        ) : todos.length === 0 ? (
          <p className="text-sm text-gray-500 px-2">
            {filter === 'all' ? 'No todos yet' : `No ${filter} todos`}
          </p>
        ) : (
          <div className="space-y-1">
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
                disabled={isDisabled}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                isDragOver={dragOverId === todo.id}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                isDragging={draggedId === todo.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {stats && stats.total > 0 && (
        <div className="p-2 border-t border-gray-200 text-xs text-gray-400">
          {stats.completed}/{stats.total} completed
        </div>
      )}
    </div>
  );
}
