import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import type { FastifyInstance } from 'fastify'
import { TEST_TOKEN, authHeader } from '../helpers.ts'

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
      authToken: TEST_TOKEN,
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
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.commits.length <= 5)
    })

    it('should support search query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/commits?search=test',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(Array.isArray(body.commits))
      assert.ok(typeof body.hasMore === 'boolean')
    })
  })

  describe('GET /api/git/tree/:ref', () => {
    it('should return file tree for HEAD', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/tree/HEAD',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.ref, 'HEAD')
      assert.ok(Array.isArray(body.files))
      assert.ok(body.files.length > 0)
      assert.ok(body.files.includes('README.md'))
    })

    it('should return file tree for specific commit', async () => {
      // Get the first commit
      const commitsResponse = await app.inject({
        method: 'GET',
        url: '/api/git/commits?limit=1',
        headers: authHeader(),
      })
      const { commits } = JSON.parse(commitsResponse.body)
      const sha = commits[0].sha

      const response = await app.inject({
        method: 'GET',
        url: `/api/git/tree/${sha}`,
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.ref, sha)
      assert.ok(Array.isArray(body.files))
    })

    it('should return 400 for invalid ref', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/tree/invalid-ref-xyz-123',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 400)

      const body = JSON.parse(response.body)
      assert.ok(body.error)
    })

    it('should include untracked files when includeWorkingDir=true', async () => {
      // Create an untracked file
      writeFileSync(join(tempDir, 'untracked-test.txt'), 'content\n')

      const response = await app.inject({
        method: 'GET',
        url: '/api/git/tree/HEAD?includeWorkingDir=true',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.files.includes('untracked-test.txt'), 'Should include untracked file')
      assert.ok(body.files.includes('README.md'), 'Should still include committed files')

      // Clean up
      rmSync(join(tempDir, 'untracked-test.txt'))
    })

    it('should include staged new files when includeWorkingDir=true', async () => {
      // Create and stage a new file
      writeFileSync(join(tempDir, 'staged-test.txt'), 'content\n')
      execSync('git add staged-test.txt', { cwd: tempDir, stdio: 'ignore' })

      const response = await app.inject({
        method: 'GET',
        url: '/api/git/tree/HEAD?includeWorkingDir=true',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(body.files.includes('staged-test.txt'), 'Should include staged new file')

      // Clean up - unstage and remove
      execSync('git reset HEAD staged-test.txt', { cwd: tempDir, stdio: 'ignore' })
      rmSync(join(tempDir, 'staged-test.txt'))
    })

    it('should not include new files when includeWorkingDir is not set', async () => {
      // Create an untracked file
      writeFileSync(join(tempDir, 'not-included.txt'), 'content\n')

      const response = await app.inject({
        method: 'GET',
        url: '/api/git/tree/HEAD',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.ok(!body.files.includes('not-included.txt'), 'Should not include untracked file')

      // Clean up
      rmSync(join(tempDir, 'not-included.txt'))
    })
  })

  describe('GET /api/git/file/*', () => {
    it('should return file content at HEAD', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/file/README.md?ref=HEAD',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.path, 'README.md')
      assert.strictEqual(body.ref, 'HEAD')
      assert.ok(body.content.includes('# Test'))
      assert.ok(Array.isArray(body.lines))
      assert.ok(body.lines.length > 0)
      assert.strictEqual(body.isBinary, false)
    })

    it('should return file content at specific commit', async () => {
      // Get the first commit
      const commitsResponse = await app.inject({
        method: 'GET',
        url: '/api/git/commits?limit=1',
        headers: authHeader(),
      })
      const { commits } = JSON.parse(commitsResponse.body)
      const sha = commits[0].sha

      const response = await app.inject({
        method: 'GET',
        url: `/api/git/file/README.md?ref=${sha}`,
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(body.path, 'README.md')
      assert.strictEqual(body.ref, sha)
      assert.strictEqual(body.isBinary, false)
    })

    it('should return 404 for non-existent file', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/file/does-not-exist.txt?ref=HEAD',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 404)

      const body = JSON.parse(response.body)
      assert.ok(body.error.includes('not found'))
    })

    it('should return error for invalid ref', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/file/README.md?ref=invalid-ref-xyz',
        headers: authHeader(),
      })

      // Invalid ref causes git show to fail, resulting in 404 (file not found at ref)
      assert.ok([400, 404].includes(response.statusCode))

      const body = JSON.parse(response.body)
      assert.ok(body.error)
    })

    it('should include lineCount in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/file/README.md?ref=HEAD',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)

      const body = JSON.parse(response.body)
      assert.strictEqual(typeof body.lineCount, 'number')
      assert.strictEqual(body.lineCount, body.lines.length)
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
      authToken: TEST_TOKEN,
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
        headers: authHeader(),
      })
      const beforeBody = JSON.parse(beforeResponse.body)
      assert.strictEqual(beforeBody.hasUnstagedChanges, true)

      // Stage the file
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/stage',
        headers: authHeader(),
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
        headers: authHeader(),
      })
      const afterBody = JSON.parse(afterResponse.body)
      assert.strictEqual(afterBody.hasStagedChanges, true)
    })

    it('should return error when no files specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/stage',
        headers: authHeader(),
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
        headers: authHeader(),
      })
      const beforeBody = JSON.parse(beforeResponse.body)
      assert.strictEqual(beforeBody.hasStagedChanges, true)

      // Unstage the file
      const response = await app.inject({
        method: 'POST',
        url: '/api/git/unstage',
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
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
      authToken: TEST_TOKEN,
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
      headers: authHeader(),
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
      headers: authHeader(),
    })

    assert.strictEqual(response.statusCode, 200)

    const body = JSON.parse(response.body)
    assert.ok(body.files.length > 0)
    assert.ok(body.summary.totalFiles > 0)
    assert.ok(body.repository)
  })
})
