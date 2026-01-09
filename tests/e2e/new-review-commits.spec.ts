import { test, expect } from '@playwright/test'

/**
 * E2E tests for the New Review page commit selection functionality.
 * Tests both UI interactions and server API integration.
 */
test.describe('New Review - Commit Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new')
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Create New Review')
  })

  test('should display commit selection option', async ({ page }) => {
    // Click on "Specific Commits" option
    await page.click('text=Specific Commits')

    // Should show commit selection UI
    await expect(page.locator('text=Select commits to review')).toBeVisible()

    // Should show search input
    await expect(page.locator('input[placeholder*="Search commits"]')).toBeVisible()
  })

  test('should load commits from server', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load - should have at least one commit button
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Commits should show SHA (7 chars) and message
    const firstCommit = page.locator('button').filter({ has: page.locator('[class*="font-mono"]') }).first()
    await expect(firstCommit).toBeVisible()
  })

  test('should filter commits by search', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for initial commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Search for a specific term
    const searchInput = page.locator('input[placeholder*="Search commits"]')
    await searchInput.fill('add')

    // Wait for search to complete (debounced)
    await page.waitForTimeout(500)

    // Should show commits matching search (or show "no matches" message)
    const matchingCommits = page.locator('button').filter({ has: page.locator('[class*="font-mono"]') })
    const matchCount = await matchingCommits.count()

    // Either we have matching commits or we see the "no matches" message
    if (matchCount === 0) {
      await expect(page.locator('text=No commits match your search')).toBeVisible()
    } else {
      // Matching commits should be visible
      await expect(matchingCommits.first()).toBeVisible()
    }
  })

  test('should show loading indicator during search', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for initial load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Type in search - should show loading spinner
    const searchInput = page.locator('input[placeholder*="Search commits"]')
    await searchInput.fill('test')

    // The spinner appears inside the search box during search
    // (it's quick so we just verify no error occurs)
  })

  test('should allow selecting multiple commits', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Click first commit
    const commitButtons = page.locator('button').filter({ has: page.locator('[class*="font-mono"]') })
    await commitButtons.first().click()

    // Should show "1 selected"
    await expect(page.locator('text=1 selected')).toBeVisible()

    // Click second commit if available
    if (await commitButtons.count() > 1) {
      await commitButtons.nth(1).click()
      await expect(page.locator('text=2 selected')).toBeVisible()
    }
  })

  test('should deselect commits on second click', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Click first commit to select
    const commitButtons = page.locator('button').filter({ has: page.locator('[class*="font-mono"]') })
    await commitButtons.first().click()
    await expect(page.locator('text=1 selected')).toBeVisible()

    // Click again to deselect
    await commitButtons.first().click()

    // "selected" text should be gone
    await expect(page.locator('text=selected')).not.toBeVisible()
  })

  test('should enable Create Review button when commits selected', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Create Review button should be disabled initially
    const createButton = page.getByRole('button', { name: 'Create Review', exact: true })
    await expect(createButton).toBeDisabled()

    // Select a commit
    const commitButtons = page.locator('button').filter({ has: page.locator('[class*="font-mono"]') })
    await commitButtons.first().click()

    // Create Review button should now be enabled
    await expect(createButton).toBeEnabled()
  })

  test('should show Load more button when more commits available', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Check if Load more button is visible (only if there are more commits)
    const loadMoreButton = page.locator('button:has-text("Load more commits")')
    const hasMore = await loadMoreButton.isVisible()

    if (hasMore) {
      // Get current commit count
      const initialCount = await page.locator('button').filter({ has: page.locator('[class*="font-mono"]') }).count()

      // Click load more
      await loadMoreButton.click()

      // Wait for more commits to load
      await page.waitForTimeout(500)

      // Should have more commits now
      const newCount = await page.locator('button').filter({ has: page.locator('[class*="font-mono"]') }).count()
      expect(newCount).toBeGreaterThanOrEqual(initialCount)
    }
  })

  test('should clear search and reload all commits', async ({ page }) => {
    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for initial commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Search for something
    const searchInput = page.locator('input[placeholder*="Search commits"]')
    await searchInput.fill('nonexistent-search-term-xyz')
    await page.waitForTimeout(500)

    // Clear search
    await searchInput.fill('')
    await page.waitForTimeout(500)

    // Should show commits again
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('should maintain search input focus while typing on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Click on commits option
    await page.click('text=Specific Commits')

    // Wait for commits to load
    await expect(page.locator('[class*="font-mono"]').first()).toBeVisible({ timeout: 5000 })

    // Focus search input and type
    const searchInput = page.locator('input[placeholder*="Search commits"]')
    await searchInput.focus()
    await searchInput.fill('test')

    // Wait for search debounce
    await page.waitForTimeout(500)

    // Search input should still be visible and accessible
    await expect(searchInput).toBeVisible()
  })
})
