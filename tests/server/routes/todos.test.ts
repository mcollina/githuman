import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import { initDatabase, closeDatabase, getDatabase } from '../../../src/server/db/index.ts'
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts'
import { TodoRepository } from '../../../src/server/repositories/todo.repo.ts'
import type { FastifyInstance } from 'fastify'

describe('todo routes', () => {
  let app: FastifyInstance
  let testReviewId: string

  beforeEach(async () => {
    const config = createConfig({ repositoryPath: process.cwd() })
    initDatabase(':memory:')
    app = await buildApp(config, { logger: false, serveStatic: false })

    // Create a test review for linking todos
    const db = getDatabase()
    const reviewRepo = new ReviewRepository(db)
    const review = reviewRepo.create({
      id: 'test-review-1',
      repositoryPath: process.cwd(),
      baseRef: 'abc123',
      sourceType: 'staged',
      sourceRef: null,
      snapshotData: JSON.stringify({ files: [], repository: { name: 'test', branch: 'main', remote: null, path: process.cwd() } }),
      status: 'in_progress',
    })
    testReviewId = review.id
  })

  afterEach(async () => {
    await app?.close()
    closeDatabase()
  })

  describe('GET /api/todos', () => {
    it('should return empty array when no todos exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/todos',
      })

      assert.strictEqual(response.statusCode, 200)
      const result = JSON.parse(response.payload)
      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 0)
      assert.strictEqual(result.total, 0)
    })

    it('should return all todos', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Todo 1', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Todo 2', completed: true, reviewId: null })

      const response = await app.inject({
        method: 'GET',
        url: '/api/todos',
      })

      assert.strictEqual(response.statusCode, 200)
      const result = JSON.parse(response.payload)
      assert.strictEqual(result.data.length, 2)
      assert.strictEqual(result.total, 2)
    })

    it('should filter by completed status', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Pending', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Done', completed: true, reviewId: null })

      const response = await app.inject({
        method: 'GET',
        url: '/api/todos?completed=true',
      })

      assert.strictEqual(response.statusCode, 200)
      const result = JSON.parse(response.payload)
      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.data[0].completed, true)
      assert.strictEqual(result.total, 1)
    })

    it('should filter by review id', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Review todo', completed: false, reviewId: testReviewId })
      todoRepo.create({ id: 'todo-2', content: 'Global todo', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'GET',
        url: `/api/todos?reviewId=${testReviewId}`,
      })

      assert.strictEqual(response.statusCode, 200)
      const result = JSON.parse(response.payload)
      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.data[0].reviewId, testReviewId)
      assert.strictEqual(result.total, 1)
    })

    it('should paginate results', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      for (let i = 1; i <= 25; i++) {
        todoRepo.create({ id: `todo-${i}`, content: `Todo ${i}`, completed: false, reviewId: null })
      }

      // First page
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/todos?limit=10&offset=0',
      })
      const result1 = JSON.parse(response1.payload)
      assert.strictEqual(result1.data.length, 10)
      assert.strictEqual(result1.total, 25)
      assert.strictEqual(result1.limit, 10)
      assert.strictEqual(result1.offset, 0)

      // Second page
      const response2 = await app.inject({
        method: 'GET',
        url: '/api/todos?limit=10&offset=10',
      })
      const result2 = JSON.parse(response2.payload)
      assert.strictEqual(result2.data.length, 10)
      assert.strictEqual(result2.total, 25)
      assert.strictEqual(result2.offset, 10)

      // Third page (only 5 remaining)
      const response3 = await app.inject({
        method: 'GET',
        url: '/api/todos?limit=10&offset=20',
      })
      const result3 = JSON.parse(response3.payload)
      assert.strictEqual(result3.data.length, 5)
      assert.strictEqual(result3.total, 25)
    })
  })

  describe('GET /api/todos/stats', () => {
    it('should return todo statistics', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Pending 1', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Pending 2', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-3', content: 'Done', completed: true, reviewId: null })

      const response = await app.inject({
        method: 'GET',
        url: '/api/todos/stats',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.total, 3)
      assert.strictEqual(data.completed, 1)
      assert.strictEqual(data.pending, 2)
    })
  })

  describe('POST /api/todos', () => {
    it('should create a todo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: 'New todo' },
      })

      assert.strictEqual(response.statusCode, 201)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.content, 'New todo')
      assert.strictEqual(data.completed, false)
      assert.strictEqual(data.reviewId, null)
      assert.ok(data.id)
    })

    it('should create a todo linked to a review', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: 'Review todo', reviewId: testReviewId },
      })

      assert.strictEqual(response.statusCode, 201)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.reviewId, testReviewId)
    })
  })

  describe('GET /api/todos/:id', () => {
    it('should return a specific todo', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Test todo', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'GET',
        url: '/api/todos/todo-1',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.id, 'todo-1')
      assert.strictEqual(data.content, 'Test todo')
    })

    it('should return 404 for non-existent todo', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/todos/non-existent',
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('PATCH /api/todos/:id', () => {
    it('should update todo content', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Original', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/todos/todo-1',
        payload: { content: 'Updated' },
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.content, 'Updated')
    })

    it('should update todo completed status', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Test', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/todos/todo-1',
        payload: { completed: true },
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.completed, true)
    })

    it('should return 404 for non-existent todo', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/todos/non-existent',
        payload: { content: 'Updated' },
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('DELETE /api/todos/:id', () => {
    it('should delete a todo', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'To delete', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/todos/todo-1',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.success, true)

      // Verify it's deleted
      assert.strictEqual(todoRepo.findById('todo-1'), null)
    })

    it('should return 404 for non-existent todo', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/todos/non-existent',
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('POST /api/todos/:id/toggle', () => {
    it('should toggle pending to completed', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Test', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/todo-1/toggle',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.completed, true)
    })

    it('should toggle completed to pending', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Test', completed: true, reviewId: null })

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/todo-1/toggle',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.completed, false)
    })

    it('should return 404 for non-existent todo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/non-existent/toggle',
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('DELETE /api/todos/completed', () => {
    it('should delete all completed todos', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'Pending', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Done 1', completed: true, reviewId: null })
      todoRepo.create({ id: 'todo-3', content: 'Done 2', completed: true, reviewId: null })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/todos/completed',
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.deleted, 2)

      // Verify only pending remains
      assert.strictEqual(todoRepo.findAll().length, 1)
    })
  })

  describe('POST /api/todos/reorder', () => {
    it('should reorder todos by IDs', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/reorder',
        payload: { orderedIds: ['todo-3', 'todo-1', 'todo-2'] },
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.updated, 3)

      // Verify the new order
      const todos = todoRepo.findAll()
      assert.strictEqual(todos[0].id, 'todo-3')
      assert.strictEqual(todos[1].id, 'todo-1')
      assert.strictEqual(todos[2].id, 'todo-2')
    })
  })

  describe('POST /api/todos/:id/move', () => {
    it('should move a todo to a new position', async () => {
      const db = getDatabase()
      const todoRepo = new TodoRepository(db)
      todoRepo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null })
      todoRepo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null })

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/todo-3/move',
        payload: { position: 0 },
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.payload)
      assert.strictEqual(data.id, 'todo-3')

      // Verify the new order
      const todos = todoRepo.findAll()
      assert.strictEqual(todos[0].id, 'todo-3')
      assert.strictEqual(todos[1].id, 'todo-1')
      assert.strictEqual(todos[2].id, 'todo-2')
    })

    it('should return 404 for non-existent todo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/non-existent/move',
        payload: { position: 0 },
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })
})
