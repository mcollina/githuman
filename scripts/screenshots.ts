/**
 * Capture screenshots for README documentation
 */
import { chromium, type Page, type Browser } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, unlinkSync, cpSync, readdirSync, renameSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const PORT = 4899;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = 'docs/screenshots';
const TEST_FILE = 'screenshot-demo.ts';

// Demo file content - realistic code that will have interesting diffs
const DEMO_FILE_CONTENT = `/**
 * User authentication utilities
 */
export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  // TODO: Implement actual authentication
  if (!email || !password) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    email,
    name: email.split('@')[0],
    createdAt: new Date()
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return emailRegex.test(email)
}

export function hashPassword(password: string): string {
  // Simple hash for demo purposes
  return Buffer.from(password).toString('base64')
}
`;

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
  writeFileSync(TEST_FILE, DEMO_FILE_CONTENT);
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
    // Screenshot 1: Staged changes page (root route) - HERO IMAGE
    console.log('Capturing staged changes (hero)...');
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
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Staged');
    await page.click('text=Create Review');
    await page.waitForURL(/\/reviews\//);
    await setTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/review.png` });

    // Get the review ID from the URL for adding comments
    const reviewUrl = page.url();
    const reviewId = reviewUrl.split('/reviews/')[1]?.split('?')[0];

    // Screenshot 4: Inline comments with code suggestion
    if (reviewId) {
      console.log('Adding inline comment with code suggestion...');
      await addCommentWithSuggestion(reviewId);
      // Reload the page to show the comment
      await page.reload();
      await setTimeout(1500);

      // Click on the comment indicator to expand the comment thread
      const commentIndicator = page.locator('[data-testid="comment-indicator"], .comment-indicator, [class*="comment"]').first();
      if (await commentIndicator.isVisible()) {
        await commentIndicator.click();
        await setTimeout(500);
      }
      await page.screenshot({ path: `${SCREENSHOT_DIR}/inline-comments.png` });
    }

    // Screenshot 5: New review page with options
    console.log('Capturing new review page...');
    await page.goto(`${BASE_URL}/new`);
    await page.waitForSelector('text=Create New Review');
    await setTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/new-review.png` });

    // Screenshot 6: Mobile view of staged changes
    console.log('Capturing mobile screenshots...');
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro size
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Staged');
    await setTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-staged.png` });

    // Screenshot 7: Mobile view of review
    await page.goto(`${BASE_URL}/reviews`);
    await page.waitForSelector('text=Reviews');
    // Click first review to open it
    await page.locator('.gh-card').first().click();
    await page.waitForURL(/\/reviews\//);
    await setTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-review.png` });

    // Reset viewport for side-by-side comparison
    await page.setViewportSize({ width: 1280, height: 800 });

    // Screenshot 8: Side-by-side comparison (terminal diff vs GitHuman)
    console.log('Creating side-by-side comparison...');
    await createSideBySideComparison(page);

    // Video 9: Workflow demo
    console.log('Recording workflow demo video...');
    await recordWorkflowDemo(browser);

    // Copy screenshots to website folder
    cpSync(`${SCREENSHOT_DIR}/home.png`, 'website/home.png');
    cpSync(`${SCREENSHOT_DIR}/staged-changes.png`, 'website/staged-changes.png');
    cpSync(`${SCREENSHOT_DIR}/review.png`, 'website/review.png');
    cpSync(`${SCREENSHOT_DIR}/new-review.png`, 'website/new-review.png');
    cpSync(`${SCREENSHOT_DIR}/mobile-staged.png`, 'website/mobile-staged.png');
    cpSync(`${SCREENSHOT_DIR}/mobile-review.png`, 'website/mobile-review.png');
    if (existsSync(`${SCREENSHOT_DIR}/inline-comments.png`)) {
      cpSync(`${SCREENSHOT_DIR}/inline-comments.png`, 'website/inline-comments.png');
    }
    if (existsSync(`${SCREENSHOT_DIR}/side-by-side.png`)) {
      cpSync(`${SCREENSHOT_DIR}/side-by-side.png`, 'website/side-by-side.png');
    }

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

async function addCommentWithSuggestion(reviewId: string): Promise<void> {
  const comment = {
    filePath: TEST_FILE,
    lineNumber: 14,
    lineType: 'added' as const,
    content: 'Consider adding input validation and rate limiting to prevent brute force attacks.',
    suggestion: `export async function authenticateUser(email: string, password: string): Promise<User | null> {
  // Validate inputs
  if (!email || !password) {
    throw new Error('Email and password are required')
  }

  if (!validateEmail(email)) {
    throw new Error('Invalid email format')
  }

  // TODO: Add rate limiting here

  return {
    id: crypto.randomUUID(),
    email,
    name: email.split('@')[0],
    createdAt: new Date()
  }
}`,
  };

  const response = await fetch(`${BASE_URL}/api/reviews/${reviewId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(comment),
  });

  if (!response.ok) {
    console.warn('Failed to create comment:', await response.text());
  }
}

async function createSideBySideComparison(page: Page): Promise<void> {
  // Get the terminal diff output
  const terminalDiff = execSync(`git diff --staged --color=never ${TEST_FILE}`, { encoding: 'utf-8' });

  // Create an HTML page that shows both side by side
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 24px;
    }
    .container {
      display: flex;
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .panel {
      flex: 1;
      border-radius: 8px;
      overflow: hidden;
      background: #161b22;
      border: 1px solid #30363d;
    }
    .panel-header {
      background: #21262d;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-header .icon {
      font-size: 16px;
    }
    .terminal {
      background: #0d1117;
      padding: 16px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre;
      min-height: 400px;
    }
    .terminal .added { color: #3fb950; }
    .terminal .removed { color: #f85149; }
    .terminal .header { color: #58a6ff; }
    .terminal .meta { color: #8b949e; }
    .githuman {
      padding: 0;
      min-height: 400px;
    }
    .githuman img {
      width: 100%;
      height: auto;
      display: block;
    }
    h1 {
      text-align: center;
      margin-bottom: 24px;
      font-size: 20px;
      color: #f0f6fc;
    }
    .vs {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: #8b949e;
      padding: 0 8px;
    }
  </style>
</head>
<body>
  <h1>Terminal git diff vs GitHuman</h1>
  <div class="container">
    <div class="panel">
      <div class="panel-header">
        <span class="icon">⬛</span>
        Terminal: git diff --staged
      </div>
      <div class="terminal">${escapeHtml(terminalDiff)
        .replace(/^(@@.+@@)/gm, '<span class="header">$1</span>')
        .replace(/^(\+.*)$/gm, '<span class="added">$1</span>')
        .replace(/^(-.*)$/gm, '<span class="removed">$1</span>')
        .replace(/^(diff --git.*)$/gm, '<span class="meta">$1</span>')
        .replace(/^(index .*)$/gm, '<span class="meta">$1</span>')
        .replace(/^(--- .*)$/gm, '<span class="meta">$1</span>')
        .replace(/^(\\+\\+\\+ .*)$/gm, '<span class="meta">$1</span>')
      }</div>
    </div>
    <div class="vs">VS</div>
    <div class="panel">
      <div class="panel-header">
        <span class="icon">✨</span>
        GitHuman
      </div>
      <div class="githuman">
        <img src="file://${process.cwd()}/${SCREENSHOT_DIR}/staged-changes.png" />
      </div>
    </div>
  </div>
</body>
</html>`;

  // Write temporary HTML file
  const tempHtmlPath = `${SCREENSHOT_DIR}/side-by-side-temp.html`;
  writeFileSync(tempHtmlPath, html);

  // Screenshot the comparison page
  await page.goto(`file://${process.cwd()}/${tempHtmlPath}`);
  await setTimeout(500);
  await page.setViewportSize({ width: 1400, height: 600 });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/side-by-side.png` });

  // Clean up temp file
  unlinkSync(tempHtmlPath);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function recordWorkflowDemo(browser: Browser): Promise<void> {
  // First, pre-load the page without recording to warm up
  const warmupContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const warmupPage = await warmupContext.newPage();
  await warmupPage.goto(BASE_URL);
  await warmupPage.waitForSelector('text=Staged');
  await setTimeout(2000); // Wait for syntax highlighting
  await warmupContext.close();

  // Now create context with video recording - page will load faster
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: SCREENSHOT_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  // Listen for errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });

  // Demo workflow: Staged changes with commenting
  // Step 1: Navigate to staged changes (should load quickly now)
  await page.goto(BASE_URL);
  await page.waitForSelector('text=Staged');
  await setTimeout(1500); // Brief pause to show the view

  // Step 2: Scroll through the diff to show the code
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 200);
  await setTimeout(800);

  // Step 3: Click on a line to add a comment
  // Find an added line (green) and click on it
  const addedLine = page.locator('[class*="diff-add"], [class*="added"], .line-added, tr:has(.diff-code-add)').first();
  if (await addedLine.isVisible()) {
    await addedLine.hover();
    await setTimeout(500);

    // Look for the comment button/icon that appears on hover
    const commentButton = page.locator('[data-testid="add-comment"], [class*="comment-button"], button[title*="comment"], .add-comment-btn, [aria-label*="comment"]').first();
    if (await commentButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await commentButton.click();
      await setTimeout(500);

      // Type a comment
      const commentInput = page.locator('textarea, [contenteditable="true"], input[type="text"]').first();
      if (await commentInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await commentInput.fill('This function needs input validation');
        await setTimeout(1000);

        // Submit the comment
        const submitButton = page.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment"), button[type="submit"]').first();
        if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitButton.click();
          await setTimeout(1500);
        }
      }
    }
  }

  // Step 4: Scroll back up
  await page.mouse.wheel(0, -200);
  await setTimeout(800);

  // Step 5: Create a review from staged changes
  const createButton = page.locator('text=Create Review').first();
  if (await createButton.isVisible()) {
    await createButton.click();
    await page.waitForURL(/\/reviews\//, { timeout: 5000 }).catch(() => {});
    await setTimeout(1500);
  }

  // Step 6: Show the review page briefly
  await setTimeout(1000);

  // Close context to save the video
  await context.close();

  // Rename the video file to a consistent name
  const files = readdirSync(SCREENSHOT_DIR);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    renameSync(`${SCREENSHOT_DIR}/${videoFile}`, `${SCREENSHOT_DIR}/workflow-demo.webm`);
    cpSync(`${SCREENSHOT_DIR}/workflow-demo.webm`, 'website/workflow-demo.webm');
    console.log('Workflow demo saved as workflow-demo.webm');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
