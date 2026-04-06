import { describe, it } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { createTestRepoWithDb } from './test-utils.ts'
import { initDatabase, closeDatabase, getDatabase } from '../../src/server/db/index.ts'
import { buildApp } from '../../src/server/app.ts'
import { createConfig } from '../../src/server/config.ts'
import { ReviewRepository } from '../../src/server/repositories/review.repo.ts'
import { AskSessionRepository } from '../../src/server/repositories/ask-session.repo.ts'
import { TodoRepository } from '../../src/server/repositories/todo.repo.ts'
import { CommentRepository } from '../../src/server/repositories/comment.repo.ts'

const CLI_PATH = join(import.meta.dirname, '../../src/cli/index.ts')

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function openTestDatabase (repoDir: string): DatabaseSync {
  return new DatabaseSync(join(repoDir, '.githuman', 'reviews.db'), {
    enableForeignKeyConstraints: true,
    timeout: 1000,
  })
}

function createReview (repoDir: string): string {
  initDatabase(join(repoDir, '.githuman', 'reviews.db'))
  const db = getDatabase()
  const reviewRepo = new ReviewRepository(db)
  const reviewId = randomUUID()

  reviewRepo.create({
    id: reviewId,
    repositoryPath: repoDir,
    baseRef: 'main',
    sourceType: 'branch',
    sourceRef: 'feature/test',
    snapshotData: JSON.stringify({
      repository: {
        name: 'test-repo',
        branch: 'feature/test',
        remote: null,
        path: repoDir,
      },
      version: 2,
    }),
    status: 'in_progress',
  })

  closeDatabase()
  return reviewId
}

async function waitForAskSession (repoDir: string, message: string): Promise<{ id: string; message: string }> {
  const deadline = Date.now() + 10000

  while (Date.now() < deadline) {
    const db = openTestDatabase(repoDir)
    const stmt = db.prepare('SELECT * FROM ask_sessions WHERE message = ? ORDER BY created_at DESC LIMIT 1')
    const row = stmt.get(message) as { id: string; message: string } | undefined
    db.close()

    if (row) {
      return row
    }

    await new Promise(resolve => setTimeout(resolve, 50))
  }

  throw new Error('Timed out waiting for ask session')
}

async function completeAskSession (repoDir: string, reviewId: string, askId: string) {
  const db = openTestDatabase(repoDir)
  const askRepo = new AskSessionRepository(db)
  const todoRepo = new TodoRepository(db)
  const commentRepo = new CommentRepository(db)
  const reviewRepo = new ReviewRepository(db)

  todoRepo.create({
    id: randomUUID(),
    content: 'Add a regression test for whitespace-only input',
    completed: false,
    reviewId,
  })

  commentRepo.create({
    id: randomUUID(),
    reviewId,
    filePath: 'src/parser.ts',
    lineNumber: 42,
    lineType: 'added',
    content: 'Please reject undefined explicitly.',
    suggestion: null,
    resolved: false,
  })

  reviewRepo.update(reviewId, {
    status: 'changes_requested',
  })

  askRepo.update(askId, {
    status: 'ready_for_agent',
    completedAt: new Date().toISOString(),
  })
  db.close()
}

async function startAskServer (repoDir: string, port: number) {
  initDatabase(join(repoDir, '.githuman', 'reviews.db'))
  const config = createConfig({
    repositoryPath: repoDir,
    dbPath: join(repoDir, '.githuman', 'reviews.db'),
    host: 'localhost',
    port,
    https: false,
    authToken: null,
  })
  const app = await buildApp(config, { logger: false })
  await app.listen({ port, host: 'localhost' })

  return {
    close: async () => {
      await app.close()
      closeDatabase()
    },
  }
}

async function runAsk (args: string[], cwd: string): Promise<ExecResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, 'ask', ...args], {
      cwd,
      env: { ...process.env },
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Timed out waiting for ask command to finish'))
    }, 15000)

    child.stdout.on('data', data => {
      stdout += data.toString()
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('close', exitCode => {
      clearTimeout(timeout)
      resolve({ stdout, stderr, exitCode })
    })
  })
}

describe('githuman ask', { concurrency: 1 }, () => {
  it('waits for the human to continue the assistant and prints plain-text feedback', async (t) => {
    const repoDir = await createTestRepoWithDb(t)
    const reviewId = createReview(repoDir)
    const port = 45000 + Math.floor(Math.random() * 1000)
    const askMessage = 'Please review the parser refactor'
    const server = await startAskServer(repoDir, port)

    try {
      const askPromise = runAsk([
        '--review', reviewId,
        '--no-open',
        '--interval', '50',
        '--port', String(port),
        askMessage,
      ], repoDir)

      const ask = await waitForAskSession(repoDir, askMessage)
      await completeAskSession(repoDir, reviewId, ask.id)

      const result = await askPromise

      assert.strictEqual(result.exitCode, 0, `${result.stderr}\n${result.stdout}`)
      assert.ok(result.stderr.includes('GitHuman ask page: http://localhost:'))
      assert.ok(result.stderr.includes('Continue assistant'))
      assert.ok(result.stdout.includes('GitHuman feedback ready'))
      assert.ok(result.stdout.includes('Ask status: ready_for_agent'))
      assert.ok(result.stdout.includes('Review status: changes_requested'))
      assert.ok(result.stdout.includes('Add a regression test for whitespace-only input'))
      assert.ok(result.stdout.includes('src/parser.ts:42'))
      assert.ok(result.stdout.includes('Please reject undefined explicitly.'))
    } finally {
      await server.close()
    }
  })

  it('supports machine-readable JSON output', async (t) => {
    const repoDir = await createTestRepoWithDb(t)
    const reviewId = createReview(repoDir)
    const port = 46000 + Math.floor(Math.random() * 1000)
    const askMessage = 'Please review the current changes.'
    const server = await startAskServer(repoDir, port)

    try {
      const askPromise = runAsk([
        '--review', reviewId,
        '--no-open',
        '--interval', '50',
        '--port', String(port),
        '--json',
      ], repoDir)

      const ask = await waitForAskSession(repoDir, askMessage)
      await completeAskSession(repoDir, reviewId, ask.id)

      const result = await askPromise
      assert.strictEqual(result.exitCode, 0, `${result.stderr}\n${result.stdout}`)

      const data = JSON.parse(result.stdout)
      assert.ok(data.url.startsWith('http://localhost:'))
      assert.strictEqual(data.ask.status, 'ready_for_agent')
      assert.strictEqual(data.ask.message, askMessage)
      assert.strictEqual(data.reviewStatus, 'changes_requested')
      assert.strictEqual(data.todos.length, 1)
      assert.strictEqual(data.comments.length, 1)
      assert.strictEqual(data.todos[0].content, 'Add a regression test for whitespace-only input')
      assert.strictEqual(data.comments[0].content, 'Please reject undefined explicitly.')
    } finally {
      await server.close()
    }
  })
})
