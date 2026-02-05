import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Use a fixed uncommon port to avoid conflicts
const port = process.env.E2E_PORT ? parseInt(process.env.E2E_PORT, 10) : 4847;

// Test repo path - same as global-setup.ts
const testRepoPath = join(tmpdir(), 'githuman-e2e-test-repo');

// Playwright validates webServer.cwd before globalSetup runs, so we must create
// an empty directory here. globalSetup will then properly initialize it as a git repo.
if (!existsSync(testRepoPath)) {
  mkdirSync(testRepoPath, { recursive: true });
}

// Project root for CLI path
const projectRoot = import.meta.dirname;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Serial execution required for shared test repo
  reporter: [['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node "${join(projectRoot, 'src/cli/index.ts')}" serve --port ${port} --no-open`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
    cwd: testRepoPath,
  },
});
