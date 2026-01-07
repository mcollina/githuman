/**
 * Todo panel component - main container for todo list
 */
import { useState, useCallback, useRef, useEffect, type DragEvent, type TouchEvent } from 'react'
import { cn } from '../../lib/utils'
import { TodoItem } from './TodoItem'
import { TodoInput } from './TodoInput'
import {
  useTodos,
  useTodoStats,
  useCreateTodo,
  useUpdateTodo,
  useToggleTodo,
  useDeleteTodo,
  useClearCompleted,
  useReorderTodos,
} from '../../hooks/useTodos'
import { useServerEvents } from '../../hooks/useServerEvents'
import type { Todo } from '../../../shared/types'

type FilterState = 'all' | 'pending' | 'completed'

const PAGE_SIZE = 20

interface TodoPanelProps {
  reviewId?: string;
  className?: string;
}

export function TodoPanel ({ reviewId, className }: TodoPanelProps) {
  const [filter, setFilter] = useState<FilterState>('all')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [loadedCount, setLoadedCount] = useState(PAGE_SIZE)
  const [accumulatedTodos, setAccumulatedTodos] = useState<Todo[]>([])
  const touchStartY = useRef<number>(0)
  const listRef = useRef<HTMLDivElement>(null)

  // For filter/completed views, load all; for 'all' view, paginate
  const filters = filter === 'all'
    ? { reviewId, limit: loadedCount, offset: 0 }
    : { reviewId, completed: filter === 'completed' }

  const { todos: fetchedTodos, total, loading, refetch } = useTodos(filters)
  const { stats, refetch: refetchStats } = useTodoStats()

  // Sync fetched todos to accumulated state
  useEffect(() => {
    setAccumulatedTodos(fetchedTodos)
  }, [fetchedTodos])

  // Reset loaded count when filter changes
  useEffect(() => {
    setLoadedCount(PAGE_SIZE)
  }, [filter, reviewId])

  const todos = accumulatedTodos
  const hasMore = filter === 'all' && total > loadedCount

  const handleLoadMore = useCallback(() => {
    setLoadedCount((prev) => prev + PAGE_SIZE)
  }, [])
  const { create, loading: creating } = useCreateTodo()
  const { update, loading: updating } = useUpdateTodo()
  const { toggle, loading: toggling } = useToggleTodo()
  const { deleteTodo, loading: deleting } = useDeleteTodo()
  const { clearCompleted, loading: clearing } = useClearCompleted()
  const { reorder, loading: reordering } = useReorderTodos()

  const isDisabled = creating || updating || toggling || deleting || clearing || reordering

  // Subscribe to SSE for real-time updates (e.g., from CLI)
  // Also listen for 'connected' to refetch on reconnect (catches missed events on mobile)
  useServerEvents({
    eventTypes: ['todos', 'connected'],
    onEvent: useCallback(() => {
      refetch()
      refetchStats()
    }, [refetch, refetchStats]),
  })

  const handleAdd = useCallback(async (content: string) => {
    await create({ content, reviewId })
    refetch()
    refetchStats()
  }, [create, reviewId, refetch, refetchStats])

  const handleToggle = useCallback(async (id: string) => {
    await toggle(id)
    refetch()
    refetchStats()
  }, [toggle, refetch, refetchStats])

  const handleDelete = useCallback(async (id: string) => {
    await deleteTodo(id)
    refetch()
    refetchStats()
  }, [deleteTodo, refetch, refetchStats])

  const handleEdit = useCallback(async (id: string, content: string) => {
    await update(id, { content })
    refetch()
  }, [update, refetch])

  const handleClearCompleted = useCallback(async () => {
    await clearCompleted()
    refetch()
    refetchStats()
  }, [clearCompleted, refetch, refetchStats])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    if (id !== draggedId) {
      setDragOverId(id)
    }
  }, [draggedId])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      handleDragEnd()
      return
    }

    // Get the full list of todos (we need all todos for proper reordering)
    const currentOrder = todos.map((t) => t.id)
    const draggedIndex = currentOrder.indexOf(draggedId)
    const targetIndex = currentOrder.indexOf(targetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd()
      return
    }

    // Create new order
    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedId)

    handleDragEnd()
    await reorder(newOrder)
    refetch()
  }, [draggedId, todos, reorder, refetch, handleDragEnd])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>, id: string) => {
    touchStartY.current = e.touches[0].clientY
    setDraggedId(id)
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!draggedId || !listRef.current) return

    const touch = e.touches[0]
    const elements = listRef.current.querySelectorAll('[data-todo-id]')

    for (const el of elements) {
      const rect = el.getBoundingClientRect()
      const todoId = el.getAttribute('data-todo-id')

      if (
        todoId &&
        todoId !== draggedId &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        setDragOverId(todoId)
        return
      }
    }
    setDragOverId(null)
  }, [draggedId])

  const handleTouchEnd = useCallback(async () => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const currentOrder = todos.map((t) => t.id)
    const draggedIndex = currentOrder.indexOf(draggedId)
    const targetIndex = currentOrder.indexOf(dragOverId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedId)

    setDraggedId(null)
    setDragOverId(null)
    await reorder(newOrder)
    refetch()
  }, [draggedId, dragOverId, todos, reorder, refetch])

  const filterButtons: { value: FilterState; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Done' },
  ]

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className='p-3 border-b border-[var(--gh-border)]'>
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-sm font-semibold text-[var(--gh-text-primary)]'>
            Todos
            {stats && (
              <span className='ml-1 text-[var(--gh-accent-primary)]'>
                ({stats.pending} pending)
              </span>
            )}
          </h2>
          {stats && stats.completed > 0 && (
            <button
              onClick={handleClearCompleted}
              disabled={isDisabled}
              className={cn(
                'text-xs text-[var(--gh-text-muted)] hover:text-[var(--gh-error)] transition-colors',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              Clear done
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className='flex gap-1'>
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={cn(
                'px-2 py-1 text-xs rounded-md transition-colors',
                filter === btn.value
                  ? 'bg-[var(--gh-accent-primary)]/10 text-[var(--gh-accent-primary)]'
                  : 'text-[var(--gh-text-muted)] hover:bg-[var(--gh-bg-elevated)] hover:text-[var(--gh-text-secondary)]'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add input */}
      <div className='p-3 border-b border-[var(--gh-border)]'>
        <TodoInput onAdd={handleAdd} disabled={isDisabled} />
      </div>

      {/* Todo list */}
      <div className='flex-1 overflow-y-auto p-2' ref={listRef}>
        {loading
          ? (
            <p className='text-sm text-[var(--gh-text-muted)] px-2'>Loading...</p>
            )
          : todos.length === 0
            ? (
              <p className='text-sm text-[var(--gh-text-muted)] px-2'>
                {filter === 'all' ? 'No todos yet' : `No ${filter} todos`}
              </p>
              )
            : (
              <div className='space-y-1'>
                {todos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
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

      {/* Load more button */}
      {hasMore && (
        <div className='p-2 border-t border-[var(--gh-border)]'>
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className={cn(
              'w-full py-2 text-xs text-[var(--gh-accent-primary)] hover:bg-[var(--gh-bg-elevated)] rounded-md transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Loading...' : `Load more (${total - loadedCount} remaining)`}
          </button>
        </div>
      )}

      {/* Footer stats */}
      {stats && stats.total > 0 && (
        <div className='p-2 border-t border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)]'>
          <span className='text-[var(--gh-success)]'>{stats.completed}</span>/{stats.total} completed
        </div>
      )}
    </div>
  )
}
