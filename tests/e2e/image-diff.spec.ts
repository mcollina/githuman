import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'

// Test image file - a minimal valid PNG
const TEST_IMAGE = join(TEST_REPO_PATH, `test-image-${uid()}.png`)

// Minimal 1x1 red PNG (base64 decoded)
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
)

test.describe('Image Diff', () => {
  test.beforeAll(async () => {
    // Create and stage a test image
    writeFileSync(TEST_IMAGE, MINIMAL_PNG)
    execSync(`git add "${TEST_IMAGE}"`, { cwd: TEST_REPO_PATH })
  })

  test.afterAll(async () => {
    // Cleanup
    try {
      execSync(`git reset HEAD "${TEST_IMAGE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_IMAGE)) {
        unlinkSync(TEST_IMAGE)
      }
    } catch { /* ignore */ }
  })

  test('should display staged image in diff view', async ({ page }) => {
    // Navigate to staged changes (root page)
    await page.goto('/')

    // Wait for the page to load
    await page.waitForSelector('text=Staged')

    // Find the image file in the file list (use first match - appears in sidebar too)
    const imageFileName = TEST_IMAGE.split('/').pop()!
    await expect(page.getByText(imageFileName).first()).toBeVisible()

    // Debug: take screenshot to see what's rendered
    await page.screenshot({ path: 'test-results/image-diff-debug.png' })

    // The image should be displayed (not just text diff)
    // Look for "New Image" label which appears for added images
    await expect(page.getByText('New Image')).toBeVisible({ timeout: 10000 })

    // The actual image should be rendered
    const img = page.locator('img[alt*="Added"]')
    await expect(img).toBeVisible()

    // Check that the image loaded successfully (not broken)
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
  })

  test('should load image from API endpoint', async ({ page, request }) => {
    const imageFileName = TEST_IMAGE.split('/').pop()!

    // Test the API endpoint directly
    const response = await request.get(`/api/diff/image/${imageFileName}?version=staged`)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')

    const body = await response.body()
    expect(body.length).toBeGreaterThan(0)
  })
})
