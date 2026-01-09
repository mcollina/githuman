import { test, expect } from '@playwright/test'

test.describe('Reviews Page', () => {
  test('should display reviews list page', async ({ page }) => {
    await page.goto('/')

    // Should show the page title
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()

    // Should show "New Review" button
    await expect(page.getByRole('link', { name: 'New Review' })).toBeVisible()
  })

  test('should show empty state when no reviews exist', async ({ page }) => {
    await page.goto('/')

    // Wait for API response
    const response = await page.waitForResponse((response) =>
      response.url().includes('/api/reviews') && response.status() === 200
    )

    const data = await response.json()

    if (data.data && data.data.length === 0) {
      // Should show empty state message
      await expect(page.getByText('No reviews yet')).toBeVisible()
    }
  })

  test('should navigate to new review page when clicking New Review', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'New Review' }).click()

    await expect(page).toHaveURL('/new')
  })

  test('should handle 404 for non-existent review', async ({ page }) => {
    await page.goto('/reviews/non-existent-id')

    // Should show error message
    await expect(page.getByText('Review not found')).toBeVisible({ timeout: 10000 })
  })
})
