import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import type { FastifyInstance } from 'fastify'
import { TEST_TOKEN, authHeader } from '../helpers.ts'

describe('diff routes', () => {
  let app: FastifyInstance

  before(async () => {
    // Use current directory (which is a git repo) for testing
    const config = createConfig({
      repositoryPath: process.cwd(),
      authToken: TEST_TOKEN,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
  })

  describe('GET /api/info', () => {
    it('should return repository info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/info',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.name)
      assert.ok(body.branch)
      assert.ok(body.path)
      // remote might be null for repos without remotes
      assert.ok('remote' in body)
      // hasCommits should be present
      assert.strictEqual(typeof body.hasCommits, 'boolean')
    })

    it('should return the correct repository name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/info',
        headers: authHeader(),
      })

      const body = JSON.parse(response.body)
      // Repository name should match the directory name, regardless of where project is cloned
      assert.strictEqual(body.name, basename(process.cwd()))
    })
  })

  describe('GET /api/diff/files', () => {
    it('should return files array and hasStagedChanges flag', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/diff/files',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.files))
      assert.ok('hasStagedChanges' in body)
    })
  })

  describe('GET /api/diff/staged', () => {
    it('should return diff data structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/diff/staged',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.files))
      assert.ok(body.summary)
      assert.ok(body.repository)

      // Check summary structure
      assert.ok('totalFiles' in body.summary)
      assert.ok('totalAdditions' in body.summary)
      assert.ok('totalDeletions' in body.summary)

      // Check repository structure
      assert.ok('name' in body.repository)
      assert.ok('branch' in body.repository)
    })

    it('should return empty files array when no staged changes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/diff/staged',
        headers: authHeader(),
      })

      const body = JSON.parse(response.body)
      // This test runs against the current repo which might not have staged changes
      // We just verify the structure is correct
      assert.strictEqual(typeof body.summary.totalFiles, 'number')
    })
  })

  describe('with non-git directory', () => {
    let nonGitApp: FastifyInstance

    before(async () => {
      const config = createConfig({
        repositoryPath: '/tmp', // Not a git repo
        authToken: TEST_TOKEN,
      })
      nonGitApp = await buildApp(config, { logger: false })
    })

    after(async () => {
      await nonGitApp.close()
    })

    it('should return error for /api/info', async () => {
      const response = await nonGitApp.inject({
        method: 'GET',
        url: '/api/info',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Not a git repository')
    })

    it('should return error for /api/diff/files', async () => {
      const response = await nonGitApp.inject({
        method: 'GET',
        url: '/api/diff/files',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Not a git repository')
    })

    it('should return error for /api/diff/staged', async () => {
      const response = await nonGitApp.inject({
        method: 'GET',
        url: '/api/diff/staged',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.error, 'Not a git repository')
    })
  })

  describe('with git repo without commits', () => {
    let noCommitsApp: FastifyInstance
    let tempDir: string

    before(async () => {
      // Create a temp directory and init git repo without commits
      tempDir = mkdtempSync(join(tmpdir(), 'code-review-test-'))
      execSync('git init', { cwd: tempDir, stdio: 'ignore' })

      const config = createConfig({
        repositoryPath: tempDir,
        authToken: TEST_TOKEN,
      })
      noCommitsApp = await buildApp(config, { logger: false })
    })

    after(async () => {
      await noCommitsApp.close()
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should return hasCommits: false for /api/info', async () => {
      const response = await noCommitsApp.inject({
        method: 'GET',
        url: '/api/info',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.hasCommits, false)
    })

    it('should return NO_COMMITS error for /api/diff/staged', async () => {
      const response = await noCommitsApp.inject({
        method: 'GET',
        url: '/api/diff/staged',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 400)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.code, 'NO_COMMITS')
      assert.ok(body.error.includes('no commits'))
    })
  })
})
