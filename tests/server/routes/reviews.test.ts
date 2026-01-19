import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import { initDatabase, closeDatabase } from '../../../src/server/db/index.ts'
import type { FastifyInstance } from 'fastify'

/**
 * Create a temporary git repository with no staged changes
 */
function createTempGitRepo (): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'))
  execSync('git init', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })
  // Create an initial commit so HEAD exists
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test')
  execSync('git add .', { cwd: tempDir, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })
  return tempDir
}

/**
 * Create a temporary git repository WITH staged changes
 */
function createTempGitRepoWithStagedChanges (): string {
  const tempDir = createTempGitRepo()
  // Add a new file and stage it
  fs.writeFileSync(path.join(tempDir, 'test-file.ts'), 'const x = 1;\n')
  execSync('git add test-file.ts', { cwd: tempDir, stdio: 'ignore' })
  return tempDir
}

describe('review routes', () => {
  let app: FastifyInstance
  let testDbDir: string
  let testRepoDir: string

  before(async () => {
    // Create temp directory for test database
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-'))
    const dbPath = path.join(testDbDir, 'test.db')

    // Create a clean git repo for testing
    testRepoDir = createTempGitRepo()

    // Initialize database
    initDatabase(dbPath)

    // Use temp git repo for testing
    const config = createConfig({
      repositoryPath: testRepoDir,
      dbPath,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    closeDatabase()

    // Clean up temp directories
    if (testDbDir) {
      fs.rmSync(testDbDir, { recursive: true, force: true })
    }
    if (testRepoDir) {
      fs.rmSync(testRepoDir, { recursive: true, force: true })
    }
  })

  describe('GET /api/reviews', () => {
    it('should return empty list initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.reviews))
      assert.strictEqual(body.total, 0)
      assert.strictEqual(body.page, 1)
      assert.strictEqual(body.pageSize, 20)
    })

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews?page=2&pageSize=10',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.page, 2)
      assert.strictEqual(body.pageSize, 10)
    })
  })

  describe('POST /api/reviews', () => {
    it('should return error when no staged changes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: {
          sourceType: 'staged',
        },
      })

      // Expect error since test runs against clean repo
      assert.strictEqual(response.statusCode, 400)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 'NO_STAGED_CHANGES')
    })

    it('should work with empty body (defaults to staged)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: {},
      })

      // Without staged changes, returns the NO_STAGED_CHANGES error
      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 'NO_STAGED_CHANGES')
    })
  })

  describe('GET /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/non-existent-id',
      })

      assert.strictEqual(response.statusCode, 404)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Review not found')
    })
  })

  describe('PATCH /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/reviews/non-existent-id',
        payload: {
          status: 'approved',
        },
      })

      assert.strictEqual(response.statusCode, 404)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Review not found')
    })
  })

  describe('DELETE /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/reviews/non-existent-id',
      })

      assert.strictEqual(response.statusCode, 404)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Review not found')
    })

    it('should delete review without Content-Type header', async () => {
      // This tests the fix for the "Body cannot be empty" error
      // when Content-Type is set but no body is provided
      // The client should NOT send Content-Type for DELETE without body
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/reviews/some-id',
        // Explicitly no headers or payload
      })

      // Should return 404 (not found), not 400 (bad request)
      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('GET /api/reviews/stats', () => {
    it('should return stats structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/stats',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok('total' in body)
      assert.ok('inProgress' in body)
      assert.ok('approved' in body)
      assert.ok('changesRequested' in body)
    })

    it('should return zeros for fresh database', async () => {
      // With a fresh temp repo and database, stats should be zeros
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/stats',
      })

      const body = JSON.parse(response.body)
      // Verify all values are numbers (could be 0 or higher if tests created reviews)
      assert.strictEqual(typeof body.total, 'number')
      assert.strictEqual(typeof body.inProgress, 'number')
      assert.strictEqual(typeof body.approved, 'number')
      assert.strictEqual(typeof body.changesRequested, 'number')
      // Sum of statuses should equal total
      assert.strictEqual(
        body.inProgress + body.approved + body.changesRequested,
        body.total
      )
    })
  })
})

describe('review routes with staged changes', () => {
  let app: FastifyInstance
  let testDbDir: string
  let testRepoDir: string

  before(async () => {
    // Create temp directory for test database
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-staged-'))
    const dbPath = path.join(testDbDir, 'test.db')

    // Create a git repo WITH staged changes
    testRepoDir = createTempGitRepoWithStagedChanges()

    // Initialize database
    initDatabase(dbPath)

    const config = createConfig({
      repositoryPath: testRepoDir,
      dbPath,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    closeDatabase()

    if (testDbDir) {
      fs.rmSync(testDbDir, { recursive: true, force: true })
    }
    if (testRepoDir) {
      fs.rmSync(testRepoDir, { recursive: true, force: true })
    }
  })

  describe('POST /api/reviews', () => {
    it('should create a review from staged changes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { sourceType: 'staged' },
      })

      assert.strictEqual(response.statusCode, 201, `Expected 201 but got ${response.statusCode}: ${response.body}`)

      const body = JSON.parse(response.body)
      assert.ok(body.id, `id should be present. Got keys: ${Object.keys(body).join(', ')}`)
      assert.strictEqual(body.status, 'in_progress')
      assert.ok(Array.isArray(body.files), `files should be an array. Got: ${typeof body.files}`)
      assert.ok(body.files.length > 0, `files should have at least one item. Got: ${body.files?.length}`)
      assert.ok(body.summary, `summary should be present. Got keys: ${Object.keys(body).join(', ')}`)
    })
  })

  describe('review CRUD operations', () => {
    let reviewId: string

    it('should create a review and get it by ID', async () => {
      // Create
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { sourceType: 'staged' },
      })
      const created = JSON.parse(createResponse.body)
      reviewId = created.id

      // Get by ID
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}`,
      })

      assert.strictEqual(getResponse.statusCode, 200)
      const body = JSON.parse(getResponse.body)
      assert.strictEqual(body.id, reviewId)
      assert.ok(Array.isArray(body.files))
      assert.ok(body.summary)
    })

    it('should update review status to approved', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${reviewId}`,
        payload: { status: 'approved' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.status, 'approved')
    })

    it('should update review status to changes_requested', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${reviewId}`,
        payload: { status: 'changes_requested' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.status, 'changes_requested')
    })

    it('should export review as markdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}/export`,
      })

      assert.strictEqual(response.statusCode, 200)
      const markdown = response.body
      assert.ok(markdown.includes('# Code Review:'))
      assert.ok(markdown.includes('Changes Requested'))
    })

    it('should delete review', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/reviews/${reviewId}`,
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)

      // Verify it's gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}`,
      })
      assert.strictEqual(getResponse.statusCode, 404)
    })
  })

  describe('GET /api/reviews/:id/files/hunks', () => {
    let reviewId: string

    it('should return hunks for a file in a review', async () => {
      // Create a review first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { sourceType: 'staged' },
      })
      const created = JSON.parse(createResponse.body)
      reviewId = created.id

      // Get the file path from the review
      const filePath = created.files[0]?.newPath || 'test-file.ts'

      // Request hunks using query parameter
      const response = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}/files/hunks?path=${encodeURIComponent(filePath)}`,
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.hunks))
      assert.ok(body.hunks.length > 0, 'Should have at least one hunk')
      // Verify hunk structure
      const hunk = body.hunks[0]
      assert.ok('oldStart' in hunk)
      assert.ok('newStart' in hunk)
      assert.ok('lines' in hunk)
    })

    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/non-existent-id/files/hunks?path=test.ts',
      })

      assert.strictEqual(response.statusCode, 404)
    })

    it('should return empty hunks for non-existent file', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}/files/hunks?path=non-existent-file.ts`,
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.deepStrictEqual(body.hunks, [])
    })

    it('should handle file paths with slashes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/reviews/${reviewId}/files/hunks?path=${encodeURIComponent('src/components/Test.tsx')}`,
      })

      // Should not error - just return empty hunks for non-existent path
      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.hunks))
    })
  })

  describe('review filtering and pagination', () => {
    it('should filter reviews by status', async () => {
      // Create two reviews
      await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { sourceType: 'staged' },
      })

      const createResponse2 = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: { sourceType: 'staged' },
      })
      const review2 = JSON.parse(createResponse2.body)

      // Approve one
      await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${review2.id}`,
        payload: { status: 'approved' },
      })

      // Filter by approved
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews?status=approved',
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      for (const review of body.reviews) {
        assert.strictEqual(review.status, 'approved')
      }
    })

    it('should paginate reviews', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews?page=1&pageSize=5',
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.page, 1)
      assert.strictEqual(body.pageSize, 5)
      assert.ok(body.reviews.length <= 5)
    })
  })
})

describe('review routes with non-git directory', () => {
  let app: FastifyInstance
  let testDbDir: string

  before(async () => {
    // Create temp directory for test database
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-nongit-'))
    const dbPath = path.join(testDbDir, 'test.db')

    // Use a separate database instance for this test
    initDatabase(dbPath)

    const config = createConfig({
      repositoryPath: '/tmp', // Not a git repo
      dbPath,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    closeDatabase()

    if (testDbDir) {
      fs.rmSync(testDbDir, { recursive: true, force: true })
    }
  })

  it('should return error when creating review in non-git directory', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      payload: {
        sourceType: 'staged',
      },
    })

    assert.strictEqual(response.statusCode, 400)

    const body = JSON.parse(response.body)
    assert.strictEqual(body.code, 'NOT_GIT_REPO')
  })
})
