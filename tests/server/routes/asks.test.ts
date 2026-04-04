import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import { closeDatabase, getDatabase, initDatabase } from '../../../src/server/db/index.ts'
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts'
import { TodoRepository } from '../../../src/server/repositories/todo.repo.ts'
import { CommentRepository } from '../../../src/server/repositories/comment.repo.ts'
import { TEST_TOKEN, authHeader } from '../helpers.ts'

function createTempGitRepo (): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-route-test-'))
  execSync('git init', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test')
  execSync('git add .', { cwd: tempDir, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })
  return tempDir
}

describe('ask routes', () => {
  let app: FastifyInstance
  let testDbDir: string
  let testRepoDir: string
  let reviewId: string

  before(async () => {
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-db-test-'))
    const dbPath = path.join(testDbDir, 'test.db')
    testRepoDir = createTempGitRepo()
    initDatabase(dbPath)

    const reviewRepo = new ReviewRepository(getDatabase())
    reviewId = 'review-1'
    reviewRepo.create({
      id: reviewId,
      repositoryPath: testRepoDir,
      baseRef: 'main',
      sourceType: 'branch',
      sourceRef: 'feature/test',
      snapshotData: JSON.stringify({
        repository: {
          name: 'test',
          branch: 'feature/test',
          remote: null,
          path: testRepoDir,
        },
        version: 2,
      }),
      status: 'in_progress',
    })

    const config = createConfig({
      repositoryPath: testRepoDir,
      dbPath,
      authToken: TEST_TOKEN,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    closeDatabase()
    fs.rmSync(testDbDir, { recursive: true, force: true })
    fs.rmSync(testRepoDir, { recursive: true, force: true })
  })

  it('creates an ask session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/asks',
      headers: authHeader(),
      payload: {
        message: 'Please review the parser refactor',
        reviewId,
      },
    })

    assert.strictEqual(response.statusCode, 201)
    const body = JSON.parse(response.body)
    assert.strictEqual(body.message, 'Please review the parser refactor')
    assert.strictEqual(body.reviewId, reviewId)
    assert.strictEqual(body.status, 'waiting_for_human')
  })

  it('returns details with feedback counts', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/asks',
      headers: authHeader(),
      payload: {
        message: 'Please review the branch changes',
        reviewId,
      },
    })
    const ask = JSON.parse(createResponse.body)

    const detailsResponse = await app.inject({
      method: 'GET',
      url: `/api/asks/${ask.id}`,
      headers: authHeader(),
    })

    assert.strictEqual(detailsResponse.statusCode, 200)
    const body = JSON.parse(detailsResponse.body)
    assert.strictEqual(body.review.id, reviewId)
    assert.strictEqual(body.feedback.todoCount, 0)
    assert.strictEqual(body.feedback.commentCount, 0)
    assert.strictEqual(body.feedback.reviewStatus, 'in_progress')
  })

  it('marks an ask session ready for agent and returns collected feedback', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/asks',
      headers: authHeader(),
      payload: {
        message: 'Please review and continue',
        reviewId,
      },
    })
    const ask = JSON.parse(createResponse.body)

    const db = getDatabase()
    const todoRepo = new TodoRepository(db)
    const commentRepo = new CommentRepository(db)
    const reviewRepo = new ReviewRepository(db)

    todoRepo.create({
      id: 'todo-1',
      content: 'Add a regression test',
      completed: false,
      reviewId,
    })

    commentRepo.create({
      id: 'comment-1',
      reviewId,
      filePath: 'src/parser.ts',
      lineNumber: 42,
      lineType: 'added',
      content: 'Please reject undefined explicitly.',
      suggestion: null,
      resolved: false,
    })

    reviewRepo.update(reviewId, { status: 'changes_requested' })

    const continueResponse = await app.inject({
      method: 'POST',
      url: `/api/asks/${ask.id}/continue`,
      headers: authHeader(),
    })

    assert.strictEqual(continueResponse.statusCode, 200)
    const continued = JSON.parse(continueResponse.body)
    assert.strictEqual(continued.status, 'ready_for_agent')
    assert.ok(continued.completedAt)

    const feedbackResponse = await app.inject({
      method: 'GET',
      url: `/api/asks/${ask.id}/feedback`,
      headers: authHeader(),
    })

    assert.strictEqual(feedbackResponse.statusCode, 200)
    const feedback = JSON.parse(feedbackResponse.body)
    assert.strictEqual(feedback.ask.id, ask.id)
    assert.strictEqual(feedback.reviewStatus, 'changes_requested')
    assert.strictEqual(feedback.todos.length, 1)
    assert.strictEqual(feedback.comments.length, 1)
    assert.strictEqual(feedback.todos[0].content, 'Add a regression test')
    assert.strictEqual(feedback.comments[0].content, 'Please reject undefined explicitly.')
  })

  it('ignores older todos that were only updated during an unscoped ask session', async () => {
    const db = getDatabase()
    const todoRepo = new TodoRepository(db)
    const commentRepo = new CommentRepository(db)
    const reviewRepo = new ReviewRepository(db)

    todoRepo.create({
      id: 'todo-before-ask',
      content: 'Old global todo',
      completed: false,
      reviewId: null,
    })

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/asks',
      headers: authHeader(),
      payload: {
        message: 'Review the latest comments',
      },
    })
    const ask = JSON.parse(createResponse.body)

    todoRepo.update('todo-before-ask', { completed: true })
    commentRepo.create({
      id: 'comment-after-unscoped-ask',
      reviewId,
      filePath: 'src/app.ts',
      lineNumber: 10,
      lineType: 'added',
      content: 'Fresh comment for this ask session.',
      suggestion: null,
      resolved: false,
    })
    reviewRepo.update(reviewId, { status: 'changes_requested' })

    const feedbackResponse = await app.inject({
      method: 'GET',
      url: `/api/asks/${ask.id}/feedback`,
      headers: authHeader(),
    })

    assert.strictEqual(feedbackResponse.statusCode, 200)
    const feedback = JSON.parse(feedbackResponse.body)
    assert.strictEqual(feedback.reviewStatus, 'changes_requested')
    assert.strictEqual(feedback.todos.length, 0)
    assert.strictEqual(feedback.comments.length, 1)
    assert.strictEqual(feedback.comments[0].content, 'Fresh comment for this ask session.')
  })

  it('cancels an ask session', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/asks',
      headers: authHeader(),
      payload: {
        message: 'Cancel this request',
      },
    })
    const ask = JSON.parse(createResponse.body)

    const cancelResponse = await app.inject({
      method: 'POST',
      url: `/api/asks/${ask.id}/cancel`,
      headers: authHeader(),
    })

    assert.strictEqual(cancelResponse.statusCode, 200)
    const body = JSON.parse(cancelResponse.body)
    assert.strictEqual(body.status, 'cancelled')
    assert.ok(body.completedAt)
  })
})
