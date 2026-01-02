/**
 * Todos API client
 */
import { api } from './client';
import type { Todo, CreateTodoRequest, UpdateTodoRequest } from '../../shared/types';

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
}

export interface TodoFilters {
  reviewId?: string;
  completed?: boolean;
}

export const todosApi = {
  getAll: (filters?: TodoFilters) => {
    const params = new URLSearchParams();
    if (filters?.reviewId) {
      params.set('reviewId', filters.reviewId);
    }
    if (filters?.completed !== undefined) {
      params.set('completed', filters.completed ? '1' : '0');
    }
    const query = params.toString();
    return api.get<Todo[]>(`/todos${query ? `?${query}` : ''}`);
  },

  getById: (id: string) =>
    api.get<Todo>(`/todos/${id}`),

  getStats: () =>
    api.get<TodoStats>('/todos/stats'),

  create: (data: CreateTodoRequest) =>
    api.post<Todo>('/todos', data),

  update: (id: string, data: UpdateTodoRequest) =>
    api.patch<Todo>(`/todos/${id}`, data),

  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/todos/${id}`),

  toggle: (id: string) =>
    api.post<Todo>(`/todos/${id}/toggle`, {}),

  clearCompleted: () =>
    api.delete<{ deleted: number }>('/todos/completed'),

  reorder: (orderedIds: string[]) =>
    api.post<{ updated: number }>('/todos/reorder', { orderedIds }),

  move: (id: string, position: number) =>
    api.post<Todo>(`/todos/${id}/move`, { position }),
};
