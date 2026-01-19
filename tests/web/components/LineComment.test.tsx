import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineComment } from '../../../src/web/components/diff/LineComment'
import type { Comment } from '../../../src/shared/types'

// Format the timestamp the same way the component does, to handle timezone differences
const TEST_TIMESTAMP = '2024-01-01T12:00:00Z'
const formattedTimestamp = new Date(TEST_TIMESTAMP).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

describe('LineComment', () => {
  const mockComment: Comment = {
    id: 'comment-1',
    reviewId: 'review-1',
    filePath: 'src/test.ts',
    lineNumber: 10,
    content: 'This is a test comment',
    suggestion: null,
    resolved: false,
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
  }

  const resolvedComment: Comment = {
    ...mockComment,
    id: 'comment-2',
    resolved: true,
  }

  const commentWithSuggestion: Comment = {
    ...mockComment,
    id: 'comment-3',
    suggestion: 'const x = 1;',
  }

  it('renders comment content', () => {
    render(<LineComment comment={mockComment} />)
    expect(screen.getByText('This is a test comment')).toBeDefined()
  })

  it('shows resolved badge for resolved comments', () => {
    render(<LineComment comment={resolvedComment} />)
    expect(screen.getByText('Resolved')).toBeDefined()
  })

  it('shows suggestion badge when comment has suggestion', () => {
    render(<LineComment comment={commentWithSuggestion} />)
    expect(screen.getByText('Suggestion')).toBeDefined()
  })

  it('displays suggestion code when present', () => {
    render(<LineComment comment={commentWithSuggestion} />)
    expect(screen.getByText('const x = 1;')).toBeDefined()
  })

  describe('actions', () => {
    it('shows action buttons when header is clicked', () => {
      render(<LineComment comment={mockComment} onResolve={() => {}} onEdit={() => {}} onDelete={() => {}} />)

      // Click the header to show actions
      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)

      expect(screen.getByText('Resolve')).toBeDefined()
      expect(screen.getByText('Edit')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })

    it('shows Unresolve button for resolved comments', () => {
      render(<LineComment comment={resolvedComment} onUnresolve={() => {}} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)

      expect(screen.getByText('Unresolve')).toBeDefined()
    })

    it('calls onResolve when Resolve button is clicked', () => {
      const onResolve = vi.fn()
      render(<LineComment comment={mockComment} onResolve={onResolve} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Resolve'))

      expect(onResolve).toHaveBeenCalledWith('comment-1')
    })

    it('calls onUnresolve when Unresolve button is clicked', () => {
      const onUnresolve = vi.fn()
      render(<LineComment comment={resolvedComment} onUnresolve={onUnresolve} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Unresolve'))

      expect(onUnresolve).toHaveBeenCalledWith('comment-2')
    })
  })

  describe('editing', () => {
    it('enters edit mode when Edit button is clicked', () => {
      render(<LineComment comment={mockComment} onEdit={() => {}} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Edit'))

      expect(screen.getByRole('textbox')).toBeDefined()
      expect(screen.getByDisplayValue('This is a test comment')).toBeDefined()
    })

    it('calls onEdit with updated content when Save is clicked', () => {
      const onEdit = vi.fn()
      render(<LineComment comment={mockComment} onEdit={onEdit} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Edit'))

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Updated comment' } })
      fireEvent.click(screen.getByText('Save'))

      expect(onEdit).toHaveBeenCalledWith('comment-1', 'Updated comment')
    })

    it('cancels edit and restores original content when Cancel is clicked', () => {
      render(<LineComment comment={mockComment} onEdit={() => {}} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Edit'))

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Updated comment' } })
      fireEvent.click(screen.getByText('Cancel'))

      // Should exit edit mode and show original content
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText('This is a test comment')).toBeDefined()
    })

    it('does not call onEdit when content is empty', () => {
      const onEdit = vi.fn()
      render(<LineComment comment={mockComment} onEdit={onEdit} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Edit'))

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: '   ' } })
      fireEvent.click(screen.getByText('Save'))

      expect(onEdit).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('calls onDelete when Delete button is clicked', () => {
      const onDelete = vi.fn()
      render(<LineComment comment={mockComment} onDelete={onDelete} />)

      const header = screen.getByText(formattedTimestamp).closest('div')
      fireEvent.click(header!)
      fireEvent.click(screen.getByText('Delete'))

      expect(onDelete).toHaveBeenCalledWith('comment-1')
    })
  })
})
