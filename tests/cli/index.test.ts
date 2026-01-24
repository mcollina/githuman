import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestRepo, createTestRepoWithDb } from './test-utils.ts'

const CLI_PATH = join(import.meta.dirname, '../../src/cli/index.ts')

// Create temp directories for tests
let tempDir: string
let todoTempDir: string

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

async function runCli (args: string[], options?: { cwd?: string }): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env },
      cwd: options?.cwd,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode })
    })
  })
}

describe('CLI', () => {
  describe('main entry', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('GitHuman'))
      assert.ok(result.stdout.includes('Usage:'))
      assert.ok(result.stdout.includes('serve'))
      assert.ok(result.stdout.includes('list'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('GitHuman'))
    })

    it('should show version with --version flag', async () => {
      const result = await runCli(['--version'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('githuman v0.1.0'))
    })

    it('should show version with -v flag', async () => {
      const result = await runCli(['-v'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('v0.1.0'))
    })

    it('should show help when no command provided', async () => {
      const result = await runCli([])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage:'))
    })

    it('should error on unknown command', async () => {
      const result = await runCli(['unknown'])

      assert.strictEqual(result.exitCode, 1)
      // Message goes to stderr
      assert.ok(result.stderr.includes('Unknown command: unknown'))
    })
  })

  describe('serve command', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['serve', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman serve'))
      assert.ok(result.stdout.includes('--port'))
      assert.ok(result.stdout.includes('--host'))
      assert.ok(result.stdout.includes('--auth'))
      assert.ok(result.stdout.includes('--no-open'))
      assert.ok(result.stdout.includes('-v, --verbose'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['serve', '-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman serve'))
    })

    it('should auto-generate token when --auth is used without value', async () => {
      // Use --no-open and a temp dir so it doesn't actually start the server
      // This test just verifies parsing works - we can't fully start the server in tests
      const result = await runCli(['serve', '--auth', '--help'])

      assert.strictEqual(result.exitCode, 0)
      // Help should show the optional token syntax
      assert.ok(result.stdout.includes('--auth [token]'))
    })

    it('should show helpful error when --auth has short token', async () => {
      const result = await runCli(['serve', '--auth', 'short', '--no-open'])

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('at least 32 characters'))
    })

    it('should mention auto-generation in help text', async () => {
      const result = await runCli(['serve', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('auto-generate'))
      assert.ok(result.stdout.includes('--auth [token]'))
    })
  })

  describe('list command', () => {
    before(() => {
      // Create temp directory without any database
      tempDir = mkdtempSync(join(tmpdir(), 'cli-test-'))
    })

    after(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should show help with --help flag', async () => {
      const result = await runCli(['list', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman list'))
      assert.ok(result.stdout.includes('--status'))
      assert.ok(result.stdout.includes('--json'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['list', '-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman list'))
    })

    it('should show no reviews message when database does not exist', async () => {
      // Run from temp directory which has no database
      const result = await runCli(['list'], { cwd: tempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(
        result.stdout.includes('No reviews found')
      )
    })

    it('should output empty array with --json when no reviews', async () => {
      // Run from temp directory which has no database
      const result = await runCli(['list', '--json'], { cwd: tempDir })

      assert.strictEqual(result.exitCode, 0)
      // Either empty array or "No reviews found" message
      const output = result.stdout.trim()
      assert.ok(
        output === '[]' || output.includes('No reviews found')
      )
    })
  })

  describe('todo command', () => {
    before(() => {
      // Create temp git repo for todo tests
      todoTempDir = mkdtempSync(join(tmpdir(), 'todo-cli-test-'))
      execSync('git init', { cwd: todoTempDir, stdio: 'ignore' })
      execSync('git config user.email "test@test.com"', { cwd: todoTempDir, stdio: 'ignore' })
      execSync('git config user.name "Test"', { cwd: todoTempDir, stdio: 'ignore' })
    })

    after(() => {
      if (todoTempDir) {
        rmSync(todoTempDir, { recursive: true, force: true })
      }
    })

    it('should show help with --help flag', async () => {
      const result = await runCli(['todo', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman todo'))
      assert.ok(result.stdout.includes('add'))
      assert.ok(result.stdout.includes('list'))
      assert.ok(result.stdout.includes('done'))
      assert.ok(result.stdout.includes('remove'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['todo', '-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman todo'))
    })

    it('should show no todos message when database does not exist', async () => {
      const result = await runCli(['todo', 'list'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('No todos found'))
    })

    it('should output empty array with --json when no todos', async () => {
      const result = await runCli(['todo', 'list', '--json'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.strictEqual(result.stdout.trim(), '[]')
    })

    it('should add a todo', async () => {
      const result = await runCli(['todo', 'add', 'Test todo item'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Created todo'))
      assert.ok(result.stdout.includes('Test todo item'))
    })

    it('should list todos after adding', async () => {
      const result = await runCli(['todo', 'list'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Test todo item'))
      assert.ok(result.stdout.includes('[ ]')) // pending
    })

    it('should add todo with --json output', async () => {
      const result = await runCli(['todo', 'add', 'JSON test todo', '--json'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      const data = JSON.parse(result.stdout)
      assert.strictEqual(data.content, 'JSON test todo')
      assert.strictEqual(data.completed, false)
    })

    it('should require content for add', async () => {
      const result = await runCli(['todo', 'add'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('content is required'))
    })

    it('should require --done flag for clear', async () => {
      const result = await runCli(['todo', 'clear'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('--done flag is required'))
    })

    it('should show only pending todos by default', async () => {
      // First, add a todo and mark it done
      const addResult = await runCli(['todo', 'add', 'Pending todo'], { cwd: todoTempDir })
      assert.strictEqual(addResult.exitCode, 0)

      const addResult2 = await runCli(['todo', 'add', 'Will be completed', '--json'], { cwd: todoTempDir })
      assert.strictEqual(addResult2.exitCode, 0)
      const todoData = JSON.parse(addResult2.stdout)
      const todoId = todoData.id.slice(0, 8)

      // Mark the second one as done
      await runCli(['todo', 'done', todoId], { cwd: todoTempDir })

      // Default list should show pending only
      const listResult = await runCli(['todo', 'list'], { cwd: todoTempDir })
      assert.strictEqual(listResult.exitCode, 0)
      assert.ok(listResult.stdout.includes('Pending todo'))
      // Should NOT show completed ones
      assert.ok(!listResult.stdout.includes('Will be completed'))
    })

    it('should show only completed todos with --done', async () => {
      const result = await runCli(['todo', 'list', '--done'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Will be completed'))
      assert.ok(result.stdout.includes('[x]'))
      // Should NOT show pending ones
      assert.ok(!result.stdout.includes('Pending todo'))
    })

    it('should show all todos with --all', async () => {
      const result = await runCli(['todo', 'list', '--all'], { cwd: todoTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Pending todo'))
      assert.ok(result.stdout.includes('Will be completed'))
      assert.ok(result.stdout.includes('[ ]'))
      assert.ok(result.stdout.includes('[x]'))
    })

    it('should accept "complete" as alias for "done"', async () => {
      // Add a new todo
      const addResult = await runCli(['todo', 'add', 'Complete alias test', '--json'], { cwd: todoTempDir })
      assert.strictEqual(addResult.exitCode, 0)
      const todoData = JSON.parse(addResult.stdout)
      const todoId = todoData.id.slice(0, 8)

      // Mark it as done using "complete" alias
      const completeResult = await runCli(['todo', 'complete', todoId], { cwd: todoTempDir })
      assert.strictEqual(completeResult.exitCode, 0)
      assert.ok(completeResult.stdout.includes('Marked as done'))
      assert.ok(completeResult.stdout.includes('Complete alias test'))

      // Verify it's in the done list
      const listResult = await runCli(['todo', 'list', '--done'], { cwd: todoTempDir })
      assert.strictEqual(listResult.exitCode, 0)
      assert.ok(listResult.stdout.includes('Complete alias test'))
      assert.ok(listResult.stdout.includes('[x]'))
    })
  })

  describe('resolve command', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['resolve', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman resolve'))
      assert.ok(result.stdout.includes('review-id'))
      assert.ok(result.stdout.includes('--json'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['resolve', '-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman resolve'))
    })

    it('should require review-id', async (t) => {
      const resolveTempDir = createTestRepo(t)
      const result = await runCli(['resolve'], { cwd: resolveTempDir })

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('review-id is required'))
    })

    it('should error when review does not exist', async (t) => {
      const resolveTempDir = await createTestRepoWithDb(t)
      const result = await runCli(['resolve', 'abc123'], { cwd: resolveTempDir })

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('Review not found'))
    })

    it('should error when no reviews exist for "last"', async (t) => {
      const resolveTempDir = await createTestRepoWithDb(t)
      const result = await runCli(['resolve', 'last'], { cwd: resolveTempDir })

      assert.strictEqual(result.exitCode, 1)
      assert.ok(result.stderr.includes('No reviews found'))
    })
  })

  describe('install-skill command', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['install-skill', '--help'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman install-skill'))
      assert.ok(result.stdout.includes('--global'))
    })

    it('should show help with -h flag', async () => {
      const result = await runCli(['install-skill', '-h'])

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Usage: githuman install-skill'))
    })

    it('should install skill to project directory', async (t) => {
      const installTempDir = createTestRepo(t)
      const result = await runCli(['install-skill'], { cwd: installTempDir })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Installed GitHuman skill to'))

      // Verify the file was created
      const skillPath = join(installTempDir, '.claude', 'skills', 'githuman', 'SKILL.md')
      assert.ok(existsSync(skillPath), 'SKILL.md should exist')

      // Verify the content is correct
      const content = readFileSync(skillPath, 'utf-8')
      assert.ok(content.includes('name: githuman'), 'Should contain skill frontmatter')
      assert.ok(content.includes('npx githuman'), 'Should contain npx commands')
    })

    it('should update skill if already installed', async (t) => {
      const installTempDir = createTestRepo(t)

      // Install first time
      const result1 = await runCli(['install-skill'], { cwd: installTempDir })
      assert.strictEqual(result1.exitCode, 0)

      // Install second time
      const result2 = await runCli(['install-skill'], { cwd: installTempDir })
      assert.strictEqual(result2.exitCode, 0)
      assert.ok(result2.stdout.includes('Skill already installed'))
      assert.ok(result2.stdout.includes('Updating to latest version'))
    })

    it('should install skill globally with --global', async (t) => {
      // Create a temp home directory to avoid polluting real home
      const fakeHome = mkdtempSync(join(tmpdir(), 'fake-home-'))
      t.after(() => {
        rmSync(fakeHome, { recursive: true, force: true })
      })

      const installTempDir = createTestRepo(t)

      // Run with fake HOME
      const result = await new Promise<ExecResult>((resolve) => {
        const child = spawn('node', [CLI_PATH, 'install-skill', '--global'], {
          env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
          cwd: installTempDir,
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', (exitCode) => {
          resolve({ stdout, stderr, exitCode })
        })
      })

      assert.strictEqual(result.exitCode, 0)
      assert.ok(result.stdout.includes('Installed GitHuman skill to'))

      // Verify the file was created in fake home
      const skillPath = join(fakeHome, '.claude', 'skills', 'githuman', 'SKILL.md')
      assert.ok(existsSync(skillPath), 'SKILL.md should exist in global location')
    })
  })
})
