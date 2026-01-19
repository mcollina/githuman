import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should display the homepage with header', async ({ page }) => {
    await page.goto('/')

    // Should show the header with GitHuman logo
    await expect(page.getByRole('link', { name: /GitHuman/i })).toBeVisible()

    // Should show navigation links
    await expect(page.getByRole('link', { name: 'Changes', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reviews', exact: true })).toBeVisible()
  })

  test('should display repository info in header', async ({ page }) => {
    await page.goto('/')

    // Should show repo name (in test environment it's the test repo name)
    await expect(page.getByText('githuman-e2e-test-repo')).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to reviews page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Reviews' }).click()

    await expect(page).toHaveURL('/reviews')
  })

  test('should navigate back to changes from reviews', async ({ page }) => {
    await page.goto('/reviews')

    await page.getByRole('link', { name: 'Changes', exact: true }).click()

    await expect(page).toHaveURL('/')
  })

  test('should navigate home when clicking logo', async ({ page }) => {
    await page.goto('/reviews')

    await page.getByRole('link', { name: /GitHuman/i }).click()

    await expect(page).toHaveURL('/')
  })
})
