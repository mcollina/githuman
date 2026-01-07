/**
 * Todo API routes
 */
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../db/index.ts'
import { TodoRepository } from '../repositories/todo.repo.ts'
import { ErrorSchema, SuccessSchema } from '../schemas/common.ts'

const TodoSchema = Type.Object(
  {
    id: Type.String({ description: 'Unique identifier' }),
    content: Type.String({ description: 'Todo content' }),
    completed: Type.Boolean({ description: 'Completion status' }),
    reviewId: Type.Union([Type.String(), Type.Null()], {
      description: 'Associated review ID (null for global todos)',
    }),
    position: Type.Integer({ description: 'Display order position' }),
    createdAt: Type.String({ format: 'date-time', description: 'Creation timestamp' }),
    updatedAt: Type.String({ format: 'date-time', description: 'Last update timestamp' }),
  },
  { description: 'Todo item' }
)

const TodosArraySchema = Type.Array(TodoSchema, { description: 'List of todos' })

const PaginatedTodosSchema = Type.Object(
  {
    data: TodosArraySchema,
    total: Type.Integer({ description: 'Total number of todos matching the filter' }),
    limit: Type.Union([Type.Integer(), Type.Null()], { description: 'Limit used (null if no pagination)' }),
    offset: Type.Integer({ description: 'Offset used' }),
  },
  { description: 'Paginated list of todos' }
)

const CreateTodoSchema = Type.Object(
  {
    content: Type.String({ minLength: 1, description: 'Todo content' }),
    reviewId: Type.Optional(Type.String({ description: 'Associated review ID' })),
  },
  { description: 'Create todo request' }
)

const UpdateTodoSchema = Type.Object(
  {
    content: Type.Optional(Type.String({ minLength: 1, description: 'Updated content' })),
    completed: Type.Optional(Type.Boolean({ description: 'Updated completion status' })),
  },
  { description: 'Update todo request' }
)

const TodoQuerystringSchema = Type.Object(
  {
    reviewId: Type.Optional(Type.String({ description: 'Filter by review ID' })),
    completed: Type.Optional(Type.String({ description: 'Filter by completion status (1, true, 0, false)' })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: 'Maximum number of todos to return (default: all)' })),
    offset: Type.Optional(Type.Integer({ minimum: 0, description: 'Number of todos to skip (default: 0)' })),
  },
  { description: 'Todo list filters and pagination' }
)

const TodoStatsSchema = Type.Object(
  {
    total: Type.Integer({ description: 'Total number of todos' }),
    completed: Type.Integer({ description: 'Number of completed todos' }),
    pending: Type.Integer({ description: 'Number of pending todos' }),
  },
  { description: 'Todo statistics' }
)

const IdParamsSchema = Type.Object({
  id: Type.String({ description: 'Todo ID (UUID)' }),
})

const ReorderTodosSchema = Type.Object(
  {
    orderedIds: Type.Array(Type.String(), { description: 'Array of todo IDs in desired order' }),
  },
  { description: 'Reorder todos request' }
)

const ReorderResultSchema = Type.Object(
  {
    updated: Type.Integer({ description: 'Number of todos updated' }),
  },
  { description: 'Reorder result' }
)

const MoveTodoSchema = Type.Object(
  {
    position: Type.Integer({ minimum: 0, description: 'New position for the todo' }),
  },
  { description: 'Move todo request' }
)

const DeletedCountSchema = Type.Object(
  {
    deleted: Type.Integer({ description: 'Number of items deleted' }),
  },
  { description: 'Deleted count response' }
)

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
}

const todoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const getRepo = () => {
    const db = getDatabase()
    return new TodoRepository(db)
  }

  /**
   * GET /api/todos
   * List all todos with optional filtering and pagination
   */
  fastify.get('/api/todos', {
    schema: {
      tags: ['todos'],
      summary: 'List all todos',
      description: 'Retrieve all todos with optional filtering by review ID or completion status, and pagination',
      querystring: TodoQuerystringSchema,
      response: {
        200: PaginatedTodosSchema,
      },
    },
  }, async (request) => {
    const repo = getRepo()
    const { reviewId, completed, limit, offset = 0 } = request.query

    let data: ReturnType<typeof repo.findAll>
    let total: number

    if (reviewId && completed !== undefined) {
      // No pagination for filtered queries - return all matching
      data = repo.findByReviewAndCompleted(reviewId, completed === '1' || completed === 'true')
      total = data.length
    } else if (reviewId) {
      data = repo.findByReview(reviewId)
      total = data.length
    } else if (completed !== undefined) {
      data = repo.findByCompleted(completed === '1' || completed === 'true')
      total = data.length
    } else {
      // Pagination only applies to unfiltered queries
      total = repo.countAll()
      data = repo.findAll(limit ? { limit, offset } : undefined)
    }

    return {
      data,
      total,
      limit: limit ?? null,
      offset,
    }
  })

  /**
   * GET /api/todos/stats
   * Get todo statistics
   */
  fastify.get('/api/todos/stats', {
    schema: {
      tags: ['todos'],
      summary: 'Get todo statistics',
      description: 'Get counts of total, completed, and pending todos',
      response: {
        200: TodoStatsSchema,
      },
    },
  }, async () => {
    const repo = getRepo()
    return {
      total: repo.countAll(),
      completed: repo.countCompleted(),
      pending: repo.countPending(),
    }
  })

  /**
   * POST /api/todos
   * Create a new todo
   */
  fastify.post('/api/todos', {
    schema: {
      tags: ['todos'],
      summary: 'Create a new todo',
      description: 'Create a new todo item, optionally associated with a review',
      body: CreateTodoSchema,
      response: {
        201: TodoSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const { content, reviewId } = request.body

    const todo = repo.create({
      id: randomUUID(),
      content,
      completed: false,
      reviewId: reviewId ?? null,
    })

    reply.code(201)
    return todo
  })

  /**
   * GET /api/todos/:id
   * Get a specific todo
   */
  fastify.get('/api/todos/:id', {
    schema: {
      tags: ['todos'],
      summary: 'Get a todo by ID',
      description: 'Retrieve a specific todo by its unique identifier',
      params: IdParamsSchema,
      response: {
        200: TodoSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const todo = repo.findById(request.params.id)

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      })
    }

    return todo
  })

  /**
   * PATCH /api/todos/:id
   * Update a todo's content or completed status
   */
  fastify.patch('/api/todos/:id', {
    schema: {
      tags: ['todos'],
      summary: 'Update a todo',
      description: 'Update the content or completion status of a todo',
      params: IdParamsSchema,
      body: UpdateTodoSchema,
      response: {
        200: TodoSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const todo = repo.update(request.params.id, request.body)

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      })
    }

    return todo
  })

  /**
   * DELETE /api/todos/:id
   * Delete a todo
   */
  fastify.delete('/api/todos/:id', {
    schema: {
      tags: ['todos'],
      summary: 'Delete a todo',
      description: 'Permanently delete a todo by its ID',
      params: IdParamsSchema,
      response: {
        200: SuccessSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const deleted = repo.delete(request.params.id)

    if (!deleted) {
      return reply.code(404).send({
        error: 'Todo not found',
      })
    }

    return { success: true }
  })

  /**
   * POST /api/todos/:id/toggle
   * Toggle a todo's completed status
   */
  fastify.post('/api/todos/:id/toggle', {
    schema: {
      tags: ['todos'],
      summary: 'Toggle todo completion',
      description: 'Toggle the completed status of a todo',
      params: IdParamsSchema,
      response: {
        200: TodoSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const todo = repo.toggle(request.params.id)

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      })
    }

    return todo
  })

  /**
   * DELETE /api/todos/completed
   * Delete all completed todos
   */
  fastify.delete('/api/todos/completed', {
    schema: {
      tags: ['todos'],
      summary: 'Delete completed todos',
      description: 'Delete all todos that have been marked as completed',
      response: {
        200: DeletedCountSchema,
      },
    },
  }, async () => {
    const repo = getRepo()
    const count = repo.deleteCompleted()
    return { deleted: count }
  })

  /**
   * POST /api/todos/reorder
   * Reorder todos by providing an array of IDs in the desired order
   */
  fastify.post('/api/todos/reorder', {
    schema: {
      tags: ['todos'],
      summary: 'Reorder todos',
      description: 'Reorder todos by providing an array of todo IDs in the desired order',
      body: ReorderTodosSchema,
      response: {
        200: ReorderResultSchema,
      },
    },
  }, async (request) => {
    const repo = getRepo()
    const { orderedIds } = request.body
    const updated = repo.reorder(orderedIds)
    return { updated }
  })

  /**
   * POST /api/todos/:id/move
   * Move a single todo to a new position
   */
  fastify.post('/api/todos/:id/move', {
    schema: {
      tags: ['todos'],
      summary: 'Move a todo',
      description: 'Move a single todo to a new position in the list',
      params: IdParamsSchema,
      body: MoveTodoSchema,
      response: {
        200: TodoSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const repo = getRepo()
    const { position } = request.body
    const todo = repo.move(request.params.id, position)

    if (!todo) {
      return reply.code(404).send({
        error: 'Todo not found',
      })
    }

    return todo
  })
}

export default todoRoutes
