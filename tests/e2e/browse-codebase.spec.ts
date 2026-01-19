import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'

// Test file path for staging
const testFileId = uid()
const TEST_FILE = join(TEST_REPO_PATH, `browse-test-file-${testFileId}.txt`)

// Helper to create a review for tests
async function createReviewForTests (request: any): Promise<string> {
  const response = await request.post('/api/reviews', { data: {} })
  const review = await response.json()
  return review.id
}

test.describe('Browse Full Codebase', () => {
  // Setup: Stage a test file so we can create reviews
  test.beforeAll(async () => {
    writeFileSync(TEST_FILE, `Test content for browse feature ${testFileId}\n`)
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

  test('browse toggle is off by default', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)

    // Wait for page to load
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Should show the regular sidebar with "Files" header (not "All Files")
    await expect(page.getByText(/^\s*Files\s*\(\d+\)/)).toBeVisible()

    // Toggle label should be visible (on desktop)
    await expect(page.getByText('Browse full codebase')).toBeVisible()
  })

  test('toggle shows file tree when enabled', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()

    // File tree should appear with "All Files" header
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Should show repo files (from global-setup.ts)
    await expect(page.getByText('README.md')).toBeVisible()
    await expect(page.getByText('index.ts')).toBeVisible()
  })

  test('can view non-diff file content', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()

    // Wait for file tree to load
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Click on README.md (not in the diff)
    await page.getByRole('button', { name: 'README.md' }).click()

    // File content should be displayed (markdown is rendered, so look for the heading)
    await expect(page.getByRole('heading', { name: 'Test Repository' })).toBeVisible({ timeout: 5000 })
  })

  test('can add comment on non-diff file', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()

    // Wait for file tree to load
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // View a file not in the diff
    await page.getByRole('button', { name: 'index.ts' }).click()

    // Wait for file content to load (index.ts has 2-3 lines)
    await expect(page.locator('.browse-line').first()).toBeVisible({ timeout: 5000 })

    // Click on a line to open comment form
    await page.locator('.browse-line').first().click()

    // Add comment
    const commentInput = page.getByPlaceholder('Write a comment...')
    await expect(commentInput).toBeVisible()
    await commentInput.fill('Context comment on index.ts')
    await page.getByRole('button', { name: 'Add Comment' }).click()

    // Verify comment appears
    await expect(page.getByText('Context comment on index.ts')).toBeVisible({ timeout: 5000 })
  })

  test('context comments persist after toggle', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Add a comment on utils.ts
    await page.getByRole('button', { name: 'utils.ts' }).click()
    await expect(page.locator('.browse-line').first()).toBeVisible({ timeout: 5000 })

    await page.locator('.browse-line').first().click()
    const commentInput = page.getByPlaceholder('Write a comment...')
    await commentInput.fill('Persistent context comment')
    await page.getByRole('button', { name: 'Add Comment' }).click()
    await expect(page.getByText('Persistent context comment')).toBeVisible({ timeout: 5000 })

    // Toggle off by clicking the label again
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText(/^\s*Files\s*\(\d+\)/)).toBeVisible({ timeout: 5000 })

    // Toggle back on
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Navigate back to the file
    await page.getByRole('button', { name: 'utils.ts' }).click()

    // Comment should still be there
    await expect(page.getByText('Persistent context comment')).toBeVisible({ timeout: 5000 })
  })

  test('search filters file tree', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // All files should be visible initially
    await expect(page.getByText('README.md')).toBeVisible()
    await expect(page.getByText('index.ts')).toBeVisible()
    await expect(page.getByText('utils.ts')).toBeVisible()

    // Filter to "README"
    const searchInput = page.getByPlaceholder('Search files...')
    await searchInput.fill('README')

    // Only README should be visible
    await expect(page.getByText('README.md')).toBeVisible()
    await expect(page.getByText('index.ts')).not.toBeVisible()
    await expect(page.getByText('utils.ts')).not.toBeVisible()

    // Clear search
    await searchInput.fill('')

    // All files should be visible again
    await expect(page.getByText('index.ts')).toBeVisible()
    await expect(page.getByText('utils.ts')).toBeVisible()
  })

  test('switching back to diff view works', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Disable browse mode by clicking the label again
    await page.getByText('Browse full codebase').click()

    // Should show the regular sidebar with files
    await expect(page.getByText(/^\s*Files\s*\(\d+\)/)).toBeVisible({ timeout: 5000 })

    // The diff view should be back - check for the staged test file (use first to avoid strict mode violation)
    await expect(page.getByText(`browse-test-file-${testFileId}.txt`).first()).toBeVisible({ timeout: 5000 })
  })

  test('shows placeholder when no file selected in browse mode', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Enable browse mode by clicking the label
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // Should show placeholder message
    await expect(page.getByText('Select a file from the tree to view')).toBeVisible()
  })
})
