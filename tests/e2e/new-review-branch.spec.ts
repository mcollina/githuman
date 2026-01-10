import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TEST_REPO_PATH, uid } from './test-helpers.ts'

// Test branch name
const TEST_BRANCH = `test-branch-${uid()}`
const TEST_FILE = join(TEST_REPO_PATH, 'test-file-for-branch-review.ts')

test.describe('New Review - Branch Comparison', () => {
  let originalBranch: string

  // Setup: Create a test branch with changes
  test.beforeAll(async () => {
    // Get current branch
    originalBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: TEST_REPO_PATH })
      .toString()
      .trim()

    // Create and checkout test branch
    execSync(`git checkout -b ${TEST_BRANCH}`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })

    // Add a file and commit
    writeFileSync(TEST_FILE, `// Test file for branch review ${uid()}\nconst branch = '${TEST_BRANCH}';\n`)
    execSync(`git add "${TEST_FILE}"`, { cwd: TEST_REPO_PATH })
    execSync('git commit -m "Test commit for branch review"', { cwd: TEST_REPO_PATH, stdio: 'ignore' })

    // Go back to original branch
    execSync(`git checkout ${originalBranch}`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
  })

  // Cleanup: Delete test branch and file
  test.afterAll(async () => {
    try {
      // Ensure we're on original branch
      execSync(`git checkout ${originalBranch}`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      // Delete test branch
      execSync(`git branch -D ${TEST_BRANCH}`, { cwd: TEST_REPO_PATH, stdio: 'ignore' })
    } catch { /* ignore */ }
    try {
      if (existsSync(TEST_FILE)) {
        unlinkSync(TEST_FILE)
      }
    } catch { /* ignore */ }
  })

  test('should display branch selection dropdown', async ({ page }) => {
    await page.goto('/new')

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Create New Review')

    // Click on "Branch Comparison" option
    await page.locator('button').filter({ hasText: 'Branch Comparison' }).click()

    // Verify dropdown appears
    const branchSelect = page.locator('select')
    await expect(branchSelect).toBeVisible()

    // Verify dropdown has options
    const options = branchSelect.locator('option')
    await expect(options).not.toHaveCount(0)
  })

  test('should select branch and create review', async ({ page }) => {
    await page.goto('/new')

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Create New Review')

    // Click on "Branch Comparison" option
    await page.locator('button').filter({ hasText: 'Branch Comparison' }).click()

    // Select the test branch
    const branchSelect = page.locator('select')
    await branchSelect.selectOption({ label: TEST_BRANCH })

    // Verify "Create Review" button is enabled
    const createButton = page.getByRole('button', { name: 'Create Review', exact: true })
    await expect(createButton).toBeEnabled()

    // Click "Create Review"
    await createButton.click()

    // Wait for navigation to review page
    await expect(page).toHaveURL(/\/reviews\//, { timeout: 10000 })

    // Verify review shows "Branch: {name}" label
    await expect(page.getByText(`Branch: ${TEST_BRANCH}`)).toBeVisible()
  })

  test('should exclude current branch from dropdown', async ({ page }) => {
    await page.goto('/new')

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Create New Review')

    // Click on "Branch Comparison" option
    await page.locator('button').filter({ hasText: 'Branch Comparison' }).click()

    // Verify current branch is not in dropdown
    const branchSelect = page.locator('select')
    const options = await branchSelect.locator('option').allTextContents()

    // Current branch should not be an option (it's filtered out)
    const currentBranchInOptions = options.some(opt => opt.includes(originalBranch) && !opt.includes('(remote)'))

    // Note: The current branch should be filtered out from the dropdown
    // This test verifies that behavior
    expect(currentBranchInOptions).toBeFalsy()
  })
})
