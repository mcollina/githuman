import { test, expect } from '@playwright/test'

test.describe('Reviews Page', () => {
  test('should display reviews list page', async ({ page }) => {
    await page.goto('/reviews')

    // Should show the page title
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()

    // Should show "New Review" button (in header, not the "Create New Review" in empty state)
    await expect(page.getByRole('link', { name: 'New Review', exact: true })).toBeVisible()
  })

  test('should show empty state when no reviews exist', async ({ page }) => {
    // Set up the response promise BEFORE navigation to avoid race condition
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/reviews') && response.status() === 200
    )

    await page.goto('/reviews')

    // Wait for API response
    const response = await responsePromise

    const data = await response.json()

    if (data.data && data.data.length === 0) {
      // Should show empty state message
      await expect(page.getByText('No reviews yet')).toBeVisible()
    }
  })

  test('should navigate to new review page when clicking New Review', async ({ page }) => {
    await page.goto('/reviews')

    await page.getByRole('link', { name: 'New Review', exact: true }).click()

    await expect(page).toHaveURL('/new')
  })

  test('should handle 404 for non-existent review', async ({ page }) => {
    await page.goto('/reviews/non-existent-id')

    // Should show error message
    await expect(page.getByText('Review not found')).toBeVisible({ timeout: 10000 })
  })
})
