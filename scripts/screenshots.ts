/**
 * Capture screenshots for README documentation
 */
import { chromium } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const PORT = 4899;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = 'docs/screenshots';

async function main() {
  // Ensure screenshot directory exists
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Build frontend if needed
  if (!existsSync('dist/web')) {
    console.log('Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // Start server
  console.log('Starting server...');
  const server = spawn('node', ['src/cli/index.ts', 'serve', '--port', String(PORT), '--no-open'], {
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await waitForServer(server);
  console.log('Server ready');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // Screenshot 1: Home page (reviews list)
    console.log('Capturing home page...');
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Reviews');
    await setTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/home.png` });

    // Screenshot 2: Staged changes page
    console.log('Capturing staged changes...');
    await page.goto(`${BASE_URL}/staged`);
    await page.waitForSelector('aside');
    await setTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/staged-changes.png` });

    // Create a test review if we have staged changes, or show empty state
    // For demo purposes, we'll just capture what's there

    console.log('Screenshots saved to docs/screenshots/');
  } finally {
    await browser.close();
    server.kill();
  }
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await setTimeout(500);
  }
  throw new Error('Server failed to start');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
