/**
 * Shared utilities for CLI tests
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export interface TestContext {
  after: (fn: () => void) => void;
}

/**
 * Creates a temporary git repository for testing.
 * Automatically cleans up after the test.
 */
export function createTestRepo(t: TestContext): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'cli-test-'));
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });

  t.after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  return tempDir;
}

/**
 * Creates a temporary git repository with an initialized database.
 * Automatically cleans up after the test.
 */
export async function createTestRepoWithDb(t: TestContext): Promise<string> {
  const tempDir = createTestRepo(t);

  const { initDatabase, closeDatabase } = await import('../../src/server/db/index.ts');
  initDatabase(join(tempDir, '.githuman', 'reviews.db'));
  closeDatabase();

  return tempDir;
}
