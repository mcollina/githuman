import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import type { FastifyInstance } from 'fastify'

describe('git routes', () => {
  let app: FastifyInstance
  let tempDir: string

  before(async () => {
    // Create a temp git repo
    tempDir = mkdtempSync(join(tmpdir(), 'git-routes-basic-'))
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })

    // Create initial commit
    writeFileSync(join(tempDir, 'README.md'), '# Test\n')
    execSync('git add README.md', { cwd: tempDir, stdio: 'ignore' })
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })

    const config = createConfig({
      repositoryPath: tempDir,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('GET /api/git/info', () => {
    it('should return repository info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/info',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.name)
      assert.ok(body.branch)
      assert.ok(body.path)
    })
  })

  describe('GET /api/git/staged', () => {
    it('should return hasStagedChanges boolean', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/staged',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(typeof body.hasStagedChanges, 'boolean')
    })
  })

  describe('GET /api/git/unstaged', () => {
    it('should return hasUnstagedChanges and files array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/unstaged',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(typeof body.hasUnstagedChanges, 'boolean')
      assert.ok(Array.isArray(body.files))
    })
  })

  describe('GET /api/git/branches', () => {
    it('should return array of branches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/branches',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body))
      assert.ok(body.length > 0)
    })
  })

  describe('GET /api/git/commits', () => {
    it('should return paginated commits response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/commits',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.commits))
      assert.ok(body.commits.length > 0)
      assert.ok(typeof body.hasMore === 'boolean')
    })

    it('should support limit and offset query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/commits?limit=5&offset=0',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.commits.length <= 5)
    })

    it('should support search query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/commits?search=test',
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.commits))
      assert.ok(typeof body.hasMore === 'boolean')
    })
  })
})

describe('git staging routes', () => {
  let app: FastifyInstance
  let tempDir: string

  before(async () => {
    // Create a temp git repo for staging tests
    tempDir = mkdtempSync(join(tmpdir(), 'git-routes-test-'))
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })

    // Create initial commit
    writeFileSync(join(tempDir, 'README.md'), '# Test\n')
    execSync('git add README.md', { cwd: tempDir, stdio: 'ignore' })
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })

    const config = createConfig({
      repositoryPath: tempDir,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('POST /api/git/stage', () => {
    it('should stage specified files', async () => {
      // Create an unstaged file
      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')

      // Verify it's unstaged
      const beforeResponse = await app.inject({
        method: 'GET',
        url: '/api/git/unstaged',
      })
      const beforeBody = JSON.parse(beforeResponse.body)
      assert.strictEqual(beforeBody.hasUnstagedChanges, true)

      // Stage the file
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/stage',
        payload: { files: ['new-file.txt'] },
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
      assert.deepStrictEqual(body.staged, ['new-file.txt'])

      // Verify it's now staged
      const afterResponse = await app.inject({
        method: 'GET',
        url: '/api/git/staged',
      })
      const afterBody = JSON.parse(afterResponse.body)
      assert.strictEqual(afterBody.hasStagedChanges, true)
    })

    it('should return error when no files specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/stage',
        payload: { files: [] },
      })

      assert.strictEqual(response.statusCode, 400)

      const body = JSON.parse(response.body)
      assert.ok(body.error.includes('No files'))
    })
  })

  describe('POST /api/git/unstage', () => {
    it('should unstage specified files', async () => {
      // Create and stage a file
      writeFileSync(join(tempDir, 'another-file.txt'), 'content\n')
      execSync('git add another-file.txt', { cwd: tempDir, stdio: 'ignore' })

      // Verify it's staged
      const beforeResponse = await app.inject({
        method: 'GET',
        url: '/api/git/staged',
      })
      const beforeBody = JSON.parse(beforeResponse.body)
      assert.strictEqual(beforeBody.hasStagedChanges, true)

      // Unstage the file
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/unstage',
        payload: { files: ['another-file.txt'] },
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
      assert.deepStrictEqual(body.unstaged, ['another-file.txt'])
    })

    it('should return error when no files specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/unstage',
        payload: { files: [] },
      })

      assert.strictEqual(response.statusCode, 400)

      const body = JSON.parse(response.body)
      assert.ok(body.error.includes('No files'))
    })
  })

  describe('POST /api/git/stage-all', () => {
    it('should stage all unstaged files', async () => {
      // Clean up any staged changes first
      execSync('git reset HEAD 2>/dev/null || true', { cwd: tempDir, stdio: 'ignore' })

      // Create multiple unstaged files
      writeFileSync(join(tempDir, 'file1.txt'), 'content1\n')
      writeFileSync(join(tempDir, 'file2.txt'), 'content2\n')

      // Stage all
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/stage-all',
        payload: {},
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
      assert.ok(body.staged.length >= 2)

      // Verify files are staged
      const afterResponse = await app.inject({
        method: 'GET',
        url: '/api/git/staged',
      })
      const afterBody = JSON.parse(afterResponse.body)
      assert.strictEqual(afterBody.hasStagedChanges, true)
    })
  })
})

describe('GET /api/diff/unstaged', () => {
  let app: FastifyInstance
  let tempDir: string

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'diff-unstaged-test-'))
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })

    writeFileSync(join(tempDir, 'README.md'), '# Test\n')
    execSync('git add README.md', { cwd: tempDir, stdio: 'ignore' })
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })

    const config = createConfig({
      repositoryPath: tempDir,
    })
    app = await buildApp(config, { logger: false })
  })

  after(async () => {
    await app.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should return empty files when no unstaged changes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/diff/unstaged',
    })

    assert.strictEqual(response.statusCode, 200)

    const body = JSON.parse(response.body)
    assert.deepStrictEqual(body.files, [])
    assert.strictEqual(body.summary.totalFiles, 0)
  })

  it('should return diff data when there are unstaged changes', async () => {
    // Modify the file to create unstaged changes
    writeFileSync(join(tempDir, 'README.md'), '# Updated\n')

    const response = await app.inject({
      method: 'GET',
      url: '/api/diff/unstaged',
    })

    assert.strictEqual(response.statusCode, 200)

    const body = JSON.parse(response.body)
    assert.ok(body.files.length > 0)
    assert.ok(body.summary.totalFiles > 0)
    assert.ok(body.repository)
  })
})
