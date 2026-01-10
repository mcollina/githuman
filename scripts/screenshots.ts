/**
 * Capture screenshots for README documentation
 */
import { chromium } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, unlinkSync, cpSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const PORT = 4899;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = 'docs/screenshots';
const TEST_FILE = 'screenshot-demo.ts';

async function main() {
  // Ensure screenshot directory exists
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Build frontend if needed
  if (!existsSync('dist/web')) {
    console.log('Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // Create and stage a demo file for the screenshot
  console.log('Creating demo staged file...');
  writeFileSync(TEST_FILE, `/**
 * Example utility functions
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}
`);
  execSync(`git add ${TEST_FILE}`);

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

  // Listen for console messages and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });
  page.on('pageerror', err => console.log('Page error:', err.message));

  try {
    // Screenshot 1: Staged changes page (root route)
    console.log('Capturing staged changes...');
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Staged');
    await setTimeout(1500); // Wait for syntax highlighting
    await page.screenshot({ path: `${SCREENSHOT_DIR}/staged-changes.png` });

    // Screenshot 2: Reviews list page
    console.log('Capturing reviews page...');
    await page.goto(`${BASE_URL}/reviews`);
    await page.waitForSelector('text=Reviews');
    await setTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/home.png` });

    // Screenshot 3: Create a review and show the review page with diff
    console.log('Capturing review page...');
    // Click Create Review button
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Staged');
    await page.click('text=Create Review');
    await page.waitForURL(/\/reviews\//);
    await setTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/review.png` });

    // Screenshot 4: New review page with options
    console.log('Capturing new review page...');
    await page.goto(`${BASE_URL}/new`);
    await page.waitForSelector('text=Create New Review');
    await setTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-review.png` });

    // Screenshot 5: Mobile view of staged changes
    console.log('Capturing mobile screenshots...');
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro size
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Staged');
    await setTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-staged.png` });

    // Screenshot 6: Mobile view of review
    await page.goto(`${BASE_URL}/reviews`);
    await page.waitForSelector('text=Reviews');
    // Click first review to open it
    await page.locator('.gh-card').first().click();
    await page.waitForURL(/\/reviews\//);
    await setTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-review.png` });

    // Copy screenshots to website folder
    cpSync(`${SCREENSHOT_DIR}/home.png`, 'website/home.png');
    cpSync(`${SCREENSHOT_DIR}/staged-changes.png`, 'website/staged-changes.png');
    cpSync(`${SCREENSHOT_DIR}/review.png`, 'website/review.png');
    cpSync(`${SCREENSHOT_DIR}/new-review.png`, 'website/new-review.png');
    cpSync(`${SCREENSHOT_DIR}/mobile-staged.png`, 'website/mobile-staged.png');
    cpSync(`${SCREENSHOT_DIR}/mobile-review.png`, 'website/mobile-review.png');

    console.log('Screenshots saved to docs/screenshots/ and website/');
  } finally {
    await browser.close();
    server.kill();

    // Cleanup: unstage and remove test file
    console.log('Cleaning up...');
    try {
      execSync(`git reset HEAD ${TEST_FILE}`, { stdio: 'ignore' });
    } catch { /* ignore */ }
    try {
      unlinkSync(TEST_FILE);
    } catch { /* ignore */ }
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
