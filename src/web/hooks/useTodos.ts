/**
 * Hooks for todo management
 */
import { useState, useEffect, useCallback } from 'react'
import { todosApi, type TodoStats, type TodoFilters } from '../api/todos'
import { ApiClientError } from '../api/client'
import type { Todo, CreateTodoRequest, UpdateTodoRequest } from '../../shared/types'

interface UseTodosResult {
  todos: Todo[];
  total: number;
  loading: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

interface UseTodoStatsResult {
  stats: TodoStats | null;
  loading: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

export function useTodos (filters?: TodoFilters): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiClientError | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await todosApi.getAll(filters)
      setTodos(response.data)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500))
    } finally {
      setLoading(false)
    }
  }, [filters?.reviewId, filters?.completed, filters?.limit, filters?.offset])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { todos, total, loading, error, refetch: fetch }
}

export function useTodoStats (): UseTodoStatsResult {
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiClientError | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await todosApi.getStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { stats, loading, error, refetch: fetch }
}

interface UseCreateTodoResult {
  create: (data: CreateTodoRequest) => Promise<Todo>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useCreateTodo (): UseCreateTodoResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const create = async (data: CreateTodoRequest): Promise<Todo> => {
    setLoading(true)
    setError(null)
    try {
      const todo = await todosApi.create(data)
      return todo
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { create, loading, error }
}

interface UseUpdateTodoResult {
  update: (id: string, data: UpdateTodoRequest) => Promise<Todo>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useUpdateTodo (): UseUpdateTodoResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const update = async (id: string, data: UpdateTodoRequest): Promise<Todo> => {
    setLoading(true)
    setError(null)
    try {
      const todo = await todosApi.update(id, data)
      return todo
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { update, loading, error }
}

interface UseToggleTodoResult {
  toggle: (id: string) => Promise<Todo>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useToggleTodo (): UseToggleTodoResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const toggle = async (id: string): Promise<Todo> => {
    setLoading(true)
    setError(null)
    try {
      const todo = await todosApi.toggle(id)
      return todo
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { toggle, loading, error }
}

interface UseDeleteTodoResult {
  deleteTodo: (id: string) => Promise<void>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useDeleteTodo (): UseDeleteTodoResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const deleteTodo = async (id: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await todosApi.delete(id)
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { deleteTodo, loading, error }
}

interface UseClearCompletedResult {
  clearCompleted: () => Promise<number>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useClearCompleted (): UseClearCompletedResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const clearCompleted = async (): Promise<number> => {
    setLoading(true)
    setError(null)
    try {
      const result = await todosApi.clearCompleted()
      return result.deleted
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { clearCompleted, loading, error }
}

interface UseReorderTodosResult {
  reorder: (orderedIds: string[]) => Promise<number>;
  loading: boolean;
  error: ApiClientError | null;
}

export function useReorderTodos (): UseReorderTodosResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)

  const reorder = async (orderedIds: string[]): Promise<number> => {
    setLoading(true)
    setError(null)
    try {
      const result = await todosApi.reorder(orderedIds)
      return result.updated
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : new ApiClientError('Unknown error', 500)
      setError(apiError)
      throw apiError
    } finally {
      setLoading(false)
    }
  }

  return { reorder, loading, error }
}
