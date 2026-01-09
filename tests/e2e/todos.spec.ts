import { test, expect } from '@playwright/test'

// Helper to generate unique test identifiers
const uid = () => Math.random().toString(36).substring(2, 8)

test.describe('Todo Drawer UI', () => {
  test('should open and close todo drawer', async ({ page }) => {
    await page.goto('/')

    // Click the Todos button in the header (using aria-label)
    await page.getByRole('button', { name: 'Toggle todos' }).click()

    // Drawer should be visible
    const drawer = page.getByTestId('todo-drawer')
    await expect(drawer).toBeVisible()

    // Close button should work
    await page.getByRole('button', { name: 'Close todos' }).click()

    // Drawer should be closed (translated off screen)
    await expect(drawer).toHaveClass(/translate-x-full/)
  })

  test('should add a todo', async ({ page }) => {
    await page.goto('/')
    const todoText = `Test todo item ${uid()}`

    // Open the todo drawer
    await page.getByRole('button', { name: 'Toggle todos' }).click()
    const drawer = page.getByTestId('todo-drawer')
    await expect(drawer).toBeVisible()

    // Fill in the input and click add
    await drawer.getByPlaceholder('Add a todo...').fill(todoText)
    await drawer.getByRole('button', { name: 'Add' }).click()

    // The todo should appear in the list
    await expect(drawer.getByText(todoText)).toBeVisible()
  })

  test('should toggle todo completion', async ({ page }) => {
    await page.goto('/')
    const todoText = `Toggle test todo ${uid()}`

    // Open the todo drawer and add a todo
    await page.getByRole('button', { name: 'Toggle todos' }).click()
    const drawer = page.getByTestId('todo-drawer')
    await drawer.getByPlaceholder('Add a todo...').fill(todoText)
    await drawer.getByRole('button', { name: 'Add' }).click()

    // Wait for the todo to appear
    await expect(drawer.getByText(todoText)).toBeVisible()

    // Find the todo item using data-testid pattern and click the checkbox
    const todoItem = drawer.locator('[data-testid^="todo-item-"]').filter({ hasText: todoText })
    await todoItem.getByRole('button', { name: /mark as complete/i }).click()

    // The todo should be marked as complete (has line-through style)
    await expect(todoItem.locator('span.line-through')).toBeVisible()
  })

  test('should delete a todo', async ({ page }) => {
    await page.goto('/')
    const todoText = `Delete test todo ${uid()}`

    // Open the todo drawer and add a todo
    await page.getByRole('button', { name: 'Toggle todos' }).click()
    const drawer = page.getByTestId('todo-drawer')
    await drawer.getByPlaceholder('Add a todo...').fill(todoText)
    await drawer.getByRole('button', { name: 'Add' }).click()

    // Wait for the todo to appear
    await expect(drawer.getByText(todoText)).toBeVisible()

    // Find the todo item and hover to reveal delete button
    const todoItem = drawer.locator('[data-testid^="todo-item-"]').filter({ hasText: todoText })
    await todoItem.hover()

    // Click delete
    await todoItem.getByRole('button', { name: 'Delete todo' }).click()

    // The todo should be removed
    await expect(drawer.getByText(todoText)).not.toBeVisible()
  })

  test('should filter todos by status', async ({ page }) => {
    await page.goto('/')
    const suffix = uid()
    const pendingText = `Pending todo ${suffix}`
    const completedText = `Completed todo ${suffix}`

    // Open the todo drawer
    await page.getByRole('button', { name: 'Toggle todos' }).click()
    const drawer = page.getByTestId('todo-drawer')

    // Add two todos
    await drawer.getByPlaceholder('Add a todo...').fill(pendingText)
    await drawer.getByRole('button', { name: 'Add' }).click()
    await expect(drawer.getByText(pendingText)).toBeVisible()

    await drawer.getByPlaceholder('Add a todo...').fill(completedText)
    await drawer.getByRole('button', { name: 'Add' }).click()
    await expect(drawer.getByText(completedText)).toBeVisible()

    // Mark one as complete using data-testid
    const completedItem = drawer.locator('[data-testid^="todo-item-"]').filter({ hasText: completedText })
    await completedItem.getByRole('button', { name: /mark as complete/i }).click()

    // Click Pending filter - wait for completed item to disappear
    await drawer.getByRole('button', { name: 'Pending', exact: true }).click()
    await expect(drawer.getByText(completedText)).not.toBeVisible({ timeout: 10000 })
    await expect(drawer.getByText(pendingText)).toBeVisible()

    // Click Done filter (use exact: true to avoid matching "Clear done")
    await drawer.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(drawer.getByText(pendingText)).not.toBeVisible({ timeout: 10000 })
    await expect(drawer.getByText(completedText)).toBeVisible()

    // Click All filter
    await drawer.getByRole('button', { name: 'All', exact: true }).click()
    await expect(drawer.getByText(pendingText)).toBeVisible({ timeout: 10000 })
    await expect(drawer.getByText(completedText)).toBeVisible()
  })
})
