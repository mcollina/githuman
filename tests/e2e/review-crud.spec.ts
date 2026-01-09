import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Helper to generate unique test identifiers
const uid = () => Math.random().toString(36).substring(2, 8)

// Test file path for staging
const TEST_FILE = join(process.cwd(), 'test-file-for-e2e.txt')

// Setup: Stage a test file so we can create reviews
test.beforeAll(async () => {
  writeFileSync(TEST_FILE, `Test content ${uid()}\n`)
  execSync(`git add "${TEST_FILE}"`, { cwd: process.cwd() })
})

// Cleanup: Remove test file and unstage
test.afterAll(async () => {
  try {
    execSync(`git reset HEAD "${TEST_FILE}"`, { cwd: process.cwd(), stdio: 'ignore' })
  } catch { /* ignore */ }
  try {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE)
    }
  } catch { /* ignore */ }
})

test.describe('Review Detail UI', () => {
  test('should display review details', async ({ page, request }) => {
    // Create a review via API
    const createResponse = await request.post('/api/reviews', {
      data: {},
    })
    const created = await createResponse.json()

    // Navigate to the review
    await page.goto(`/reviews/${created.id}`)

    // Wait for the review to load (should show staged changes label)
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Should show status in dropdown
    const statusSelect = page.locator('select')
    await expect(statusSelect).toBeVisible()
    await expect(statusSelect).toHaveValue('in_progress')
  })

  test('should change review status to approved from UI', async ({ page, request }) => {
    // Create a review via API
    const createResponse = await request.post('/api/reviews', {
      data: {},
    })
    const created = await createResponse.json()

    // Navigate to the review
    await page.goto(`/reviews/${created.id}`)

    // Wait for the review to load
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Change status via dropdown
    const statusSelect = page.locator('select')
    await statusSelect.selectOption('approved')

    // Wait for update to complete
    await page.waitForResponse((response) =>
      response.url().includes('/api/reviews/') && response.request().method() === 'PATCH'
    )

    // Status should be updated
    await expect(statusSelect).toHaveValue('approved')
  })

  test('should change review status to changes requested from UI', async ({ page, request }) => {
    // Create a review via API
    const createResponse = await request.post('/api/reviews', {
      data: {},
    })
    const created = await createResponse.json()

    // Navigate to the review
    await page.goto(`/reviews/${created.id}`)

    // Wait for the review to load
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Change status via dropdown
    const statusSelect = page.locator('select')
    await statusSelect.selectOption('changes_requested')

    // Wait for update to complete
    await page.waitForResponse((response) =>
      response.url().includes('/api/reviews/') && response.request().method() === 'PATCH'
    )

    // Status should be updated
    await expect(statusSelect).toHaveValue('changes_requested')
  })

  test('should delete review from UI', async ({ page, request }) => {
    // Create a review via API
    const createResponse = await request.post('/api/reviews', {
      data: {},
    })
    const created = await createResponse.json()

    // Navigate to the review
    await page.goto(`/reviews/${created.id}`)

    // Wait for the review to load
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Click delete button to open modal
    await page.getByRole('button', { name: 'Delete' }).first().click()

    // Confirm deletion in modal
    const modal = page.locator('.fixed.inset-0')
    await expect(modal.getByText('Are you sure you want to delete this review?')).toBeVisible()

    // Click the confirm delete button inside the modal (the red one)
    await modal.getByRole('button', { name: 'Delete' }).click()

    // Should navigate back to reviews list
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })

  test('should show review in reviews list', async ({ page, request }) => {
    // Create a review via API
    await request.post('/api/reviews', {
      data: {},
    })

    // Navigate to reviews list
    await page.goto('/')

    // Wait for the list to load
    await page.waitForResponse((response) =>
      response.url().includes('/api/reviews') && response.status() === 200
    )

    // Should show at least one review in the list
    const reviewItems = page.locator('[data-testid="review-item"]')
    // If no data-testid, look for links to reviews
    const reviewLinks = page.locator('a[href^="/reviews/"]')

    const hasReviewItems = await reviewItems.count() > 0
    const hasReviewLinks = await reviewLinks.count() > 0

    expect(hasReviewItems || hasReviewLinks).toBeTruthy()
  })
})
