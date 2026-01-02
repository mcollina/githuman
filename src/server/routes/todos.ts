/**
 * Todo API routes
 */
import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/index.ts';
import { TodoRepository } from '../repositories/todo.repo.ts';
import type { Todo, CreateTodoRequest, UpdateTodoRequest } from '../../shared/types.ts';

interface TodoParams {
  id: string;
}

interface TodoQuerystring {
  reviewId?: string;
  completed?: string;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
}

const todoRoutes: FastifyPluginAsync = async (fastify) => {
  const getRepo = () => {
    const db = getDatabase();
    return new TodoRepository(db);
  };

  /**
   * GET /api/todos
   * List all todos with optional filtering
   */
  fastify.get<{
    Querystring: TodoQuerystring;
    Reply: Todo[];
  }>('/api/todos', async (request) => {
    const repo = getRepo();
    const { reviewId, completed } = request.query;

    if (reviewId && completed !== undefined) {
      return repo.findByReviewAndCompleted(reviewId, completed === '1' || completed === 'true');
    }

    if (reviewId) {
      return repo.findByReview(reviewId);
    }

    if (completed !== undefined) {
      return repo.findByCompleted(completed === '1' || completed === 'true');
    }

    return repo.findAll();
  });

  /**
   * GET /api/todos/stats
   * Get todo statistics
   */
  fastify.get<{
    Reply: TodoStats;
  }>('/api/todos/stats', async () => {
    const repo = getRepo();
    return {
      total: repo.countAll(),
      completed: repo.countCompleted(),
      pending: repo.countPending(),
    };
  });

  /**
   * POST /api/todos
   * Create a new todo
   */
  fastify.post<{
    Body: CreateTodoRequest;
    Reply: Todo;
  }>('/api/todos', async (request, reply) => {
    const repo = getRepo();
    const { content, reviewId } = request.body;

    const todo = repo.create({
      id: randomUUID(),
      content,
      completed: false,
      reviewId: reviewId ?? null,
    });

    reply.code(201);
    return todo;
  });

  /**
   * GET /api/todos/:id
   * Get a specific todo
   */
  fastify.get<{
    Params: TodoParams;
    Reply: Todo | { error: string };
  }>('/api/todos/:id', async (request, reply) => {
    const repo = getRepo();
    const todo = repo.findById(request.params.id);

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      });
    }

    return todo;
  });

  /**
   * PATCH /api/todos/:id
   * Update a todo's content or completed status
   */
  fastify.patch<{
    Params: TodoParams;
    Body: UpdateTodoRequest;
    Reply: Todo | { error: string };
  }>('/api/todos/:id', async (request, reply) => {
    const repo = getRepo();
    const todo = repo.update(request.params.id, request.body);

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      });
    }

    return todo;
  });

  /**
   * DELETE /api/todos/:id
   * Delete a todo
   */
  fastify.delete<{
    Params: TodoParams;
    Reply: { success: boolean } | { error: string };
  }>('/api/todos/:id', async (request, reply) => {
    const repo = getRepo();
    const deleted = repo.delete(request.params.id);

    if (!deleted) {
      return reply.code(404).send({
        error: 'Todo not found',
      });
    }

    return { success: true };
  });

  /**
   * POST /api/todos/:id/toggle
   * Toggle a todo's completed status
   */
  fastify.post<{
    Params: TodoParams;
    Reply: Todo | { error: string };
  }>('/api/todos/:id/toggle', async (request, reply) => {
    const repo = getRepo();
    const todo = repo.toggle(request.params.id);

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      });
    }

    return todo;
  });

  /**
   * DELETE /api/todos/completed
   * Delete all completed todos
   */
  fastify.delete<{
    Reply: { deleted: number };
  }>('/api/todos/completed', async () => {
    const repo = getRepo();
    const count = repo.deleteCompleted();
    return { deleted: count };
  });

  /**
   * POST /api/todos/reorder
   * Reorder todos by providing an array of IDs in the desired order
   */
  fastify.post<{
    Body: { orderedIds: string[] };
    Reply: { updated: number };
  }>('/api/todos/reorder', async (request) => {
    const repo = getRepo();
    const { orderedIds } = request.body;
    const updated = repo.reorder(orderedIds);
    return { updated };
  });

  /**
   * POST /api/todos/:id/move
   * Move a single todo to a new position
   */
  fastify.post<{
    Params: TodoParams;
    Body: { position: number };
    Reply: Todo | { error: string };
  }>('/api/todos/:id/move', async (request, reply) => {
    const repo = getRepo();
    const { position } = request.body;
    const todo = repo.move(request.params.id, position);

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      });
    }

    return todo;
  });
};

export default todoRoutes;
