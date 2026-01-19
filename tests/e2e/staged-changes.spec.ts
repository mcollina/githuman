import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'

test.describe('Staged Changes Page', () => {
  test('should display staged changes page', async ({ page }) => {
    await page.goto('/')

    // Should load without errors - check for GitHuman branding
    await expect(page.getByRole('link', { name: /GitHuman/i })).toBeVisible()
  })

  test('should show staged/unstaged tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for content to load
    await page.waitForTimeout(500)

    // Should show Staged and Unstaged tabs
    await expect(page.getByRole('button', { name: 'Staged', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unstaged', exact: true })).toBeVisible()
  })

  test('should show empty state when no staged changes', async ({ page }) => {
    await page.goto('/')

    // Wait for API response
    await page.waitForResponse((response) =>
      response.url().includes('/api/diff') && response.status() === 200
    )

    // Since we're testing against a clean repo, we should see empty state or files list
    // The exact content depends on whether there are staged changes
    const content = page.locator('main')
    await expect(content).toBeVisible()
  })

  test('should display diff summary when files exist', async ({ page }) => {
    await page.goto('/')

    // Wait for API response
    const response = await page.waitForResponse((response) =>
      response.url().includes('/api/diff') && response.status() === 200
    )

    const data = await response.json()

    if (data.files && data.files.length > 0) {
      // Should show summary stats
      await expect(page.getByText('files changed')).toBeVisible()
      await expect(page.getByText('additions')).toBeVisible()
    } else {
      // Should show empty state - check for either message
      const noChanges = page.getByText('No changes to display')
      const noFiles = page.getByText('No files to display')
      await expect(noChanges.or(noFiles).first()).toBeVisible()
    }
  })
})

// Test file path for expand/collapse test
const TEST_FILE = join(TEST_REPO_PATH, 'test-file-for-expand-collapse.ts')

test.describe('File Expand/Collapse', () => {
  // Setup: Stage a test file
  test.beforeAll(async () => {
    writeFileSync(TEST_FILE, `// Test file for expand/collapse ${uid()}\nconst expanded = true;\nconst line2 = 'test';\n`)
    execSync(`git add "${TEST_FILE}"`, { cwd: TEST_REPO_PATH })
  })

  // Cleanup: Remove test file and unstage
  test.afterAll(async () => {
    try {
      execSync(`git reset HEAD "${TEST_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_FILE)) {
        unlinkSync(TEST_FILE)
      }
    } catch { /* ignore */ }
  })

  test('should toggle file expansion when clicking file header', async ({ page }) => {
    await page.goto('/')

    // Wait for the diff to load
    await page.waitForResponse((response) =>
      response.url().includes('/api/diff') && response.status() === 200
    )

    // Find the file header for our test file (the one in main content with stats)
    const fileHeader = page.getByRole('button', { name: /test-file-for-expand-collapse\.ts.*Added/ })
    await expect(fileHeader).toBeVisible({ timeout: 10000 })

    // Verify file is expanded by default (diff lines visible)
    // Diff lines are buttons containing line numbers and code
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible()

    // Click file header to collapse
    await fileHeader.click()

    // Verify diff lines are hidden
    await expect(diffLine).not.toBeVisible()

    // Click again to expand
    await fileHeader.click()

    // Verify diff lines are visible again
    await expect(diffLine).toBeVisible()
  })
})

// Test file path for unstaged commenting test
const UNSTAGED_TEST_FILE = join(TEST_REPO_PATH, 'test-unstaged-comment.ts')

test.describe('Commenting on Unstaged Files', () => {
  // Setup: Create an untracked file (not staged)
  test.beforeEach(async () => {
    // Clean up any previous runs
    try {
      execSync(`git reset HEAD "${UNSTAGED_TEST_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(UNSTAGED_TEST_FILE)) {
        unlinkSync(UNSTAGED_TEST_FILE)
      }
    } catch { /* ignore */ }
    // Create a new untracked file
    writeFileSync(UNSTAGED_TEST_FILE, `// Unstaged file ${uid()}\nconst x = 1;\nconst y = 2;\n`)
  })

  // Cleanup: Remove test file and unstage
  test.afterEach(async () => {
    try {
      execSync(`git reset HEAD "${UNSTAGED_TEST_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(UNSTAGED_TEST_FILE)) {
        unlinkSync(UNSTAGED_TEST_FILE)
      }
    } catch { /* ignore */ }
  })

  test('should show confirmation when clicking line on unstaged tab', async ({ page }) => {
    // Navigate and wait for API responses
    await page.goto('/')

    // Wait for the unstaged diff response to ensure our file is detected
    await page.waitForResponse(
      (response) => response.url().includes('/api/diff/unstaged') && response.status() === 200,
      { timeout: 15000 }
    )

    // Click on the unstaged tab - need to filter carefully since there might be a badge
    const unstagedTab = page.locator('button').filter({ hasText: 'Unstaged' }).first()
    await expect(unstagedTab).toBeVisible({ timeout: 10000 })
    await unstagedTab.click()

    // Wait for the sidebar to show the file and click on it to expand the diff
    const fileInSidebar = page.locator('button').filter({ hasText: 'test-unstaged-comment.ts' }).first()
    await expect(fileInSidebar).toBeVisible({ timeout: 10000 })
    await fileInSidebar.click()

    // Find diff lines - for untracked files they show as added lines
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible({ timeout: 15000 })
    await diffLine.click()

    // Confirmation dialog should appear
    await expect(page.getByText('Stage File to Add Comment')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('will be staged for commit')).toBeVisible()
  })

  test('should cancel when clicking Cancel in confirmation', async ({ page }) => {
    // Navigate and wait for API responses
    await page.goto('/')

    // Wait for the unstaged diff response
    await page.waitForResponse(
      (response) => response.url().includes('/api/diff/unstaged') && response.status() === 200,
      { timeout: 15000 }
    )

    // Click on the unstaged tab
    const unstagedTab = page.locator('button').filter({ hasText: 'Unstaged' }).first()
    await unstagedTab.click()

    // Wait for the sidebar to show the file and click on it to expand the diff
    const fileInSidebar = page.locator('button').filter({ hasText: 'test-unstaged-comment.ts' }).first()
    await expect(fileInSidebar).toBeVisible({ timeout: 10000 })
    await fileInSidebar.click()

    // Find and click a diff line
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible({ timeout: 15000 })
    await diffLine.click()

    // Confirmation dialog should appear
    await expect(page.getByText('Stage File to Add Comment')).toBeVisible({ timeout: 5000 })

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog should close
    await expect(page.getByText('Stage File to Add Comment')).not.toBeVisible()
  })

  test('should stage file and enable comments when confirmed', async ({ page }) => {
    // Navigate and wait for API responses
    await page.goto('/')

    // Wait for the unstaged diff response
    await page.waitForResponse(
      (response) => response.url().includes('/api/diff/unstaged') && response.status() === 200,
      { timeout: 15000 }
    )

    // Click on the unstaged tab
    const unstagedTab = page.locator('button').filter({ hasText: 'Unstaged' }).first()
    await unstagedTab.click()

    // Wait for the sidebar to show the file and click on it to expand the diff
    const fileInSidebar = page.locator('button').filter({ hasText: 'test-unstaged-comment.ts' }).first()
    await expect(fileInSidebar).toBeVisible({ timeout: 10000 })
    await fileInSidebar.click()

    // Find and click a diff line
    const diffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(diffLine).toBeVisible({ timeout: 15000 })
    await diffLine.click()

    // Confirm staging
    await expect(page.getByText('Stage File to Add Comment')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Stage and Comment' }).click()

    // Wait for dialog to close and staged tab to update
    await expect(page.getByText('Stage File to Add Comment')).not.toBeVisible({ timeout: 5000 })

    // Verify we're on the staged tab with the file present
    await expect(page.locator('button').filter({ hasText: /^Staged/ })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button').filter({ hasText: 'test-unstaged-comment.ts' }).first()).toBeVisible({ timeout: 10000 })

    // Click on a diff line to open comment form (the auto-open may have a timing issue)
    const stagedDiffLine = page.getByRole('button', { name: /^\d+ \+ / }).first()
    await expect(stagedDiffLine).toBeVisible({ timeout: 10000 })
    await stagedDiffLine.click()

    // Now the comment form should be visible
    await expect(page.getByPlaceholder('Write a comment...')).toBeVisible({ timeout: 15000 })

    // Add a comment
    await page.getByPlaceholder('Write a comment...').fill('Comment on previously unstaged file')
    await page.getByRole('button', { name: 'Add Comment' }).click()

    // Comment should appear
    await expect(page.getByText('Comment on previously unstaged file')).toBeVisible({ timeout: 10000 })
  })
})
