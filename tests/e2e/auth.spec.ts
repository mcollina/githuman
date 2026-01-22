import { test, expect } from '@playwright/test'

test.describe('Authentication via URL token', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('should extract token from URL and store in localStorage', async ({ page }) => {
    const testToken = 'test-secret-token-12345'

    // Navigate with token in URL
    await page.goto(`/?token=${testToken}`)

    // Token should be stored in localStorage
    const storedToken = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(storedToken).toBe(testToken)
  })

  test('should remove token from URL after extraction', async ({ page }) => {
    const testToken = 'test-secret-token-12345'

    // Navigate with token in URL
    await page.goto(`/?token=${testToken}`)

    // Wait for the URL to be cleaned up
    await expect(page).toHaveURL('/')

    // URL should not contain token
    const url = page.url()
    expect(url).not.toContain('token=')
    expect(url).not.toContain(testToken)
  })

  test('should preserve other query parameters when removing token', async ({ page }) => {
    const testToken = 'test-secret-token-12345'

    // Navigate with token and other params in URL
    await page.goto(`/?foo=bar&token=${testToken}&baz=qux`)

    // Wait for URL cleanup
    await page.waitForURL((url) => !url.searchParams.has('token'))

    // Other params should be preserved
    const url = new URL(page.url())
    expect(url.searchParams.get('foo')).toBe('bar')
    expect(url.searchParams.get('baz')).toBe('qux')
    expect(url.searchParams.has('token')).toBe(false)
  })

  test('should not modify localStorage when no token in URL', async ({ page }) => {
    // Navigate without token
    await page.goto('/')

    // localStorage should not have auth_token
    const storedToken = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(storedToken).toBeNull()
  })

  test('should include Authorization header in API requests after token extraction', async ({ page }) => {
    const testToken = 'test-secret-token-12345'

    // Set up request interception to capture headers
    let foundAuthHeader = false
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const headers = request.headers()

      // Check if this non-SSE API request has the auth header
      if (!request.url().includes('/api/events') && !request.url().includes('/api/health')) {
        if (headers['authorization'] === `Bearer ${testToken}`) {
          foundAuthHeader = true
        }
      }
      await route.continue()
    })

    // Navigate with token in URL
    await page.goto(`/?token=${testToken}`)

    // Wait for the page to be loaded (but not networkidle due to SSE)
    await page.waitForLoadState('domcontentloaded')

    // Wait a bit for API requests to be made
    await page.waitForTimeout(2000)

    // Verify at least one API request had the Authorization header
    expect(foundAuthHeader).toBe(true)
  })
})
