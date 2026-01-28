import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'

// Test file path for markdown commenting
const TEST_MD_FILE = join(TEST_REPO_PATH, 'test-markdown-comment.md')

test.describe('Markdown File Comments on Staged Changes', () => {
  // Setup: Create and stage a markdown file
  test.beforeEach(async () => {
    // Clean up any previous runs
    try {
      execSync(`git reset HEAD "${TEST_MD_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_MD_FILE)) {
        unlinkSync(TEST_MD_FILE)
      }
    } catch { /* ignore */ }
    // Create and stage a new markdown file
    writeFileSync(TEST_MD_FILE, `# Test Heading ${uid()}\n\nSome content here.\n\n- Item 1\n- Item 2\n`)
    execSync(`git add "${TEST_MD_FILE}"`, { cwd: TEST_REPO_PATH })
  })

  // Cleanup: Remove test file and unstage
  test.afterEach(async () => {
    try {
      execSync(`git reset HEAD "${TEST_MD_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_MD_FILE)) {
        unlinkSync(TEST_MD_FILE)
      }
    } catch { /* ignore */ }
  })

  test('should allow clicking lines on staged markdown files to start a review', async ({ page }) => {
    await page.goto('/')

    // Wait for staged diff to load
    await page.waitForResponse(
      (response) => response.url().includes('/api/diff/staged') && response.status() === 200,
      { timeout: 15000 }
    )

    // Verify we're on the staged tab (default)
    await expect(page.locator('button').filter({ hasText: /^Staged/ })).toBeVisible()

    // Find the markdown file in sidebar and click to expand
    const fileInSidebar = page.locator('button').filter({ hasText: 'test-markdown-comment.md' }).first()
    await expect(fileInSidebar).toBeVisible({ timeout: 10000 })
    await fileInSidebar.click()

    // Wait for diff lines to be visible (markdown files show diff by default)
    // For added files, lines start with + and have line numbers
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible({ timeout: 10000 })

    // Click on a diff line - this creates a review
    await diffLine.click()

    // Wait for review to be created (Go to Review button appears)
    await expect(page.getByRole('button', { name: 'Go to Review' })).toBeVisible({ timeout: 15000 })

    // The comment form should auto-open, but if not, click the line again
    // to open the comment form (now that allowComments is enabled)
    const commentForm = page.getByPlaceholder('Write a comment...')
    if (!await commentForm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await diffLine.click()
    }

    // Wait for comment form to appear
    await expect(commentForm).toBeVisible({ timeout: 10000 })
  })

  test('should add a comment to a markdown file line', async ({ page }) => {
    const commentText = `Markdown comment ${uid()}`

    await page.goto('/')

    // Wait for staged diff to load
    await page.waitForResponse(
      (response) => response.url().includes('/api/diff/staged') && response.status() === 200,
      { timeout: 15000 }
    )

    // Find and click markdown file
    const fileInSidebar = page.locator('button').filter({ hasText: 'test-markdown-comment.md' }).first()
    await expect(fileInSidebar).toBeVisible({ timeout: 10000 })
    await fileInSidebar.click()

    // Click on a diff line to create review
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible({ timeout: 10000 })
    await diffLine.click()

    // Wait for review to be created
    await expect(page.getByRole('button', { name: 'Go to Review' })).toBeVisible({ timeout: 15000 })

    // The comment form should auto-open, but if not, click the line again
    const commentForm = page.getByPlaceholder('Write a comment...')
    if (!await commentForm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await diffLine.click()
    }

    // Fill in comment and submit
    await commentForm.fill(commentText)
    await page.getByRole('button', { name: 'Add Comment' }).click()

    // Verify comment appears
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10000 })
  })
})
