import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '../../src/cli/index.ts');

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

async function runCli(args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

describe('CLI', () => {
  describe('main entry', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['--help']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Local Code Reviewer'));
      assert.ok(result.stdout.includes('Usage:'));
      assert.ok(result.stdout.includes('serve'));
      assert.ok(result.stdout.includes('list'));
    });

    it('should show help with -h flag', async () => {
      const result = await runCli(['-h']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Local Code Reviewer'));
    });

    it('should show version with --version flag', async () => {
      const result = await runCli(['--version']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('code-review v0.1.0'));
    });

    it('should show version with -v flag', async () => {
      const result = await runCli(['-v']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('v0.1.0'));
    });

    it('should show help when no command provided', async () => {
      const result = await runCli([]);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Usage:'));
    });

    it('should error on unknown command', async () => {
      const result = await runCli(['unknown']);

      assert.strictEqual(result.exitCode, 1);
      // Message goes to stderr
      assert.ok(result.stderr.includes('Unknown command: unknown'));
    });
  });

  describe('serve command', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['serve', '--help']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Usage: code-review serve'));
      assert.ok(result.stdout.includes('--port'));
      assert.ok(result.stdout.includes('--host'));
      assert.ok(result.stdout.includes('--auth'));
      assert.ok(result.stdout.includes('--no-open'));
    });

    it('should show help with -h flag', async () => {
      const result = await runCli(['serve', '-h']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Usage: code-review serve'));
    });
  });

  describe('list command', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['list', '--help']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Usage: code-review list'));
      assert.ok(result.stdout.includes('--status'));
      assert.ok(result.stdout.includes('--json'));
    });

    it('should show help with -h flag', async () => {
      const result = await runCli(['list', '-h']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Usage: code-review list'));
    });

    it('should show no reviews message when database does not exist', async () => {
      const result = await runCli(['list']);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(
        result.stdout.includes('No reviews found')
      );
    });

    it('should output empty array with --json when no reviews', async () => {
      const result = await runCli(['list', '--json']);

      assert.strictEqual(result.exitCode, 0);
      // Either empty array or "No reviews found" message
      const output = result.stdout.trim();
      assert.ok(
        output === '[]' || output.includes('No reviews found')
      );
    });
  });
});
