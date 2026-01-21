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

    // Video 9: Workflow demo - delete existing reviews first for a clean slate
    console.log('Recording workflow demo video...');
    await deleteAllReviews();
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

async function deleteAllReviews(): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/api/reviews`);
    if (!response.ok) return;
    const data = await response.json();
    for (const review of data.reviews || []) {
      await fetch(`${BASE_URL}/api/reviews/${review.id}`, { method: 'DELETE' });
    }
  } catch (err) {
    console.warn('Failed to delete reviews:', err);
  }
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
  // First, warm up by loading the page in a non-recording context
  const warmupContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const warmupPage = await warmupContext.newPage();
  await warmupPage.goto(BASE_URL);
  await warmupPage.waitForSelector('text=Staged');
  await warmupPage.waitForSelector('.shiki span[style], code span[style*="color"]', { timeout: 10000 }).catch(() => {});
  await setTimeout(3000);
  await warmupContext.close();

  // Create recording context starting with a dark background that matches the app
  const recordContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: SCREENSHOT_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  const recordPage = await recordContext.newPage();

  // Start with a dark page that matches the app background
  await recordPage.setContent(`
    <html>
      <body style="margin:0;padding:0;background:#0d1117;min-height:100vh;"></body>
    </html>
  `);
  await setTimeout(200);

  // Navigate to the app - page should load quickly from browser cache
  await recordPage.goto(BASE_URL);
  await recordPage.waitForSelector('text=Staged');
  await recordPage.waitForSelector('.shiki span[style], code span[style*="color"]', { timeout: 10000 }).catch(() => {});
  await recordPage.waitForSelector('.gh-spinner', { state: 'hidden', timeout: 5000 }).catch(() => {});

  // Wait until fully loaded
  await recordPage.waitForFunction(() => {
    const spinners = document.querySelectorAll('.gh-spinner, [class*="spinner"], [class*="loading"]');
    return spinners.length === 0 || Array.from(spinners).every(s => {
      const style = window.getComputedStyle(s);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    });
  }, { timeout: 5000 }).catch(() => {});

  // === DEMO STARTS HERE ===

  // Step 1: Show the staged view - browse the diff
  await setTimeout(2000);

  // Step 2: Scroll down through the diff slowly to show the code
  await recordPage.mouse.move(640, 400);
  await recordPage.mouse.wheel(0, 150);
  await setTimeout(800);
  await recordPage.mouse.wheel(0, 150);
  await setTimeout(800);
  await recordPage.mouse.wheel(0, 100);
  await setTimeout(1000);

  // Step 3: Scroll back up to see the full file
  await recordPage.mouse.wheel(0, -300);
  await setTimeout(1000);

  // Step 4: Toggle to "Full" view mode to show full file view
  const fullButton = recordPage.locator('button:has-text("Full")').first();
  if (await fullButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fullButton.click();
    await setTimeout(1500);

    // Scroll down in full view
    await recordPage.mouse.wheel(0, 200);
    await setTimeout(1000);

    // Switch back to diff view
    const diffButton = recordPage.locator('button:has-text("Diff")').first();
    if (await diffButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await diffButton.click();
      await setTimeout(1000);
    }
  }

  // Step 5: Create a review from staged changes
  const createButton = recordPage.locator('button:has-text("Create Review"), button:has-text("Create"):not(:has-text("Creating"))').first();
  if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createButton.click();
    await recordPage.waitForURL(/\/reviews\//, { timeout: 5000 }).catch(() => {});
    await recordPage.waitForSelector('.shiki span[style], code span[style*="color"]', { timeout: 10000 }).catch(() => {});
    await setTimeout(1500);
  }

  // Step 6: Click on a diff line to add a comment
  const diffLine = recordPage.locator('.border-l-4.cursor-pointer').nth(5);
  if (await diffLine.isVisible({ timeout: 2000 }).catch(() => false)) {
    await diffLine.click();
    await setTimeout(500);

    // Step 7: Type a comment in the textarea
    const commentTextarea = recordPage.locator('textarea[placeholder="Write a comment..."]').first();
    if (await commentTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const commentText = 'Consider adding input validation here';
      for (const char of commentText) {
        await commentTextarea.type(char, { delay: 30 });
      }
      await setTimeout(800);

      // Step 8: Submit the comment
      const addCommentButton = recordPage.locator('button:has-text("Add Comment")').first();
      if (await addCommentButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addCommentButton.click();
        await setTimeout(1500);
      }
    }
  }

  // Step 9: Show the comment appeared
  await setTimeout(1500);

  // Step 10: Navigate to reviews list to show the review was created
  const reviewsLink = recordPage.locator('a:has-text("Reviews")').first();
  if (await reviewsLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await reviewsLink.click();
    await recordPage.waitForSelector('text=Reviews', { timeout: 3000 }).catch(() => {});
    await setTimeout(1500);
  }

  // Final pause
  await setTimeout(1000);

  // Close context to save the video
  await recordContext.close();

  // Find and process the video file
  const files = readdirSync(SCREENSHOT_DIR);
  const videoFile = files.find(f => f.endsWith('.webm') && f !== 'workflow-demo.webm');
  if (videoFile) {
    const rawVideoPath = `${SCREENSHOT_DIR}/${videoFile}`;
    const trimmedVideoPath = `${SCREENSHOT_DIR}/workflow-demo.webm`;

    // Use ffmpeg to trim the first 0.5 seconds (loading screen)
    try {
      execSync(`ffmpeg -y -i "${rawVideoPath}" -ss 0.5 -c copy "${trimmedVideoPath}"`, {
        stdio: 'pipe',
      });
      // Remove the raw video
      unlinkSync(rawVideoPath);
      console.log('Workflow demo trimmed and saved as workflow-demo.webm');
    } catch (err) {
      // Fallback: just rename if ffmpeg fails
      console.log('ffmpeg not available, using untrimmed video');
      renameSync(rawVideoPath, trimmedVideoPath);
    }

    cpSync(trimmedVideoPath, 'website/workflow-demo.webm');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
