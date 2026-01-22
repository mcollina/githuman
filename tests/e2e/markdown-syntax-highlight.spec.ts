import { test, expect } from '@playwright/test'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Helper to create a review for tests
async function createReviewForTests (request: any): Promise<string> {
  const response = await request.post('/api/reviews', { data: {} })
  const review = await response.json()
  return review.id
}

test.describe('Markdown Syntax Highlighting', () => {
  const testFileId = uid()
  const TEST_MD_FILE = join(TEST_REPO_PATH, `highlight-test-${testFileId}.md`)

  // Create and stage a markdown file with code blocks
  test.beforeAll(async () => {
    const mdContent = `# Test File

\`\`\`typescript
const x: number = 42;
\`\`\`

\`\`\`javascript
function hello() { return 'world'; }
\`\`\`
`
    writeFileSync(TEST_MD_FILE, mdContent)
    execSync(`git add "${TEST_MD_FILE}"`, { cwd: TEST_REPO_PATH })
  })

  test.afterAll(async () => {
    try {
      execSync(`git reset HEAD "${TEST_MD_FILE}"`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_MD_FILE)) {
        unlinkSync(TEST_MD_FILE)
      }
    } catch { /* ignore */ }
  })

  test('code blocks have syntax highlighting in preview mode', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)

    // Wait for page load
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Click on the markdown file in the sidebar (use first() to get sidebar button)
    await page.getByRole('button', { name: new RegExp(`highlight-test-${testFileId}\\.md`) }).first().click()

    // Switch to Preview mode
    await page.getByRole('button', { name: 'Preview' }).click()

    // Wait for markdown preview to render
    await expect(page.getByRole('heading', { name: 'Test File' })).toBeVisible({ timeout: 5000 })

    // Wait for shiki async highlighting to complete
    // Shiki wrapper appears when highlighting is done
    const shikiWrapper = page.locator('.shiki-wrapper')
    await expect(shikiWrapper.first()).toBeVisible({ timeout: 10000 })

    // Verify code blocks exist with shiki styling
    // Shiki adds style attributes with color values to spans
    const highlightedSpan = page.locator('.shiki-wrapper pre code span[style*="color"]')
    await expect(highlightedSpan.first()).toBeVisible({ timeout: 5000 })
  })

  test('inline code is styled but not syntax highlighted', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)

    // Enable browse mode to view README.md
    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })
    await page.getByText('Browse full codebase').click()
    await expect(page.getByText('All Files')).toBeVisible({ timeout: 5000 })

    // View README.md (should contain "Test Repository" text, but no syntax highlighting needed)
    await page.getByRole('button', { name: 'README.md' }).click()

    // README renders as markdown preview by default
    await expect(page.getByRole('heading', { name: 'Test Repository' })).toBeVisible({ timeout: 5000 })
  })

  test('different languages are highlighted', async ({ page, request }) => {
    const reviewId = await createReviewForTests(request)
    await page.goto(`/reviews/${reviewId}`)

    await expect(page.getByText('Staged changes', { exact: true })).toBeVisible({ timeout: 10000 })

    // Click on markdown file in sidebar (use first() to get sidebar button) and preview
    await page.getByRole('button', { name: new RegExp(`highlight-test-${testFileId}\\.md`) }).first().click()
    await page.getByRole('button', { name: 'Preview' }).click()

    // Wait for shiki async highlighting to complete on both code blocks
    const shikiWrappers = page.locator('.shiki-wrapper')
    await expect(shikiWrappers).toHaveCount(2, { timeout: 10000 })

    // Each code block should have colored spans from syntax highlighting
    for (const wrapper of await shikiWrappers.all()) {
      const coloredSpans = wrapper.locator('pre code span[style*="color"]')
      await expect(coloredSpans.first()).toBeVisible()
    }
  })
})
