import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiffFile } from '../../../src/web/components/diff/DiffFile'
import { CommentProvider } from '../../../src/web/contexts/CommentContext'
import type { DiffFile as DiffFileType } from '../../../src/shared/types'

function renderWithProvider (ui: React.ReactElement) {
  return render(
    <CommentProvider reviewId={null}>
      {ui}
    </CommentProvider>
  )
}

describe('DiffFile', () => {
  const mockFile: DiffFileType = {
    oldPath: 'src/app.ts',
    newPath: 'src/app.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [
          { type: 'context', content: 'line 1', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'removed', content: 'old line', oldLineNumber: 2, newLineNumber: null },
          { type: 'added', content: 'new line', oldLineNumber: null, newLineNumber: 2 },
          { type: 'context', content: 'line 3', oldLineNumber: 3, newLineNumber: 3 },
        ],
      },
    ],
  }

  it('renders file path', () => {
    renderWithProvider(<DiffFile file={mockFile} />)

    expect(screen.getByText('src/app.ts')).toBeDefined()
  })

  it('renders status badge', () => {
    renderWithProvider(<DiffFile file={mockFile} />)

    expect(screen.getByText('Modified')).toBeDefined()
  })

  it('renders addition and deletion counts', () => {
    renderWithProvider(<DiffFile file={mockFile} />)

    expect(screen.getByText('+5')).toBeDefined()
    expect(screen.getByText('-2')).toBeDefined()
  })

  it('shows diff content when expanded', () => {
    renderWithProvider(<DiffFile file={mockFile} defaultExpanded />)

    expect(screen.getByText('line 1')).toBeDefined()
    expect(screen.getByText('old line')).toBeDefined()
    expect(screen.getByText('new line')).toBeDefined()
  })

  it('hides diff content when collapsed', () => {
    renderWithProvider(<DiffFile file={mockFile} defaultExpanded={false} />)

    expect(screen.queryByText('line 1')).toBeNull()
    expect(screen.queryByText('old line')).toBeNull()
  })

  it('toggles expansion on click', () => {
    renderWithProvider(<DiffFile file={mockFile} defaultExpanded={false} />)

    // Initially collapsed
    expect(screen.queryByText('line 1')).toBeNull()

    // Click to expand - use getAllByRole to handle multiple buttons
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // First button is the expand/collapse button
    expect(screen.getByText('line 1')).toBeDefined()

    // Click to collapse - need to get buttons again as DOM may have changed
    const expandedButtons = screen.getAllByRole('button')
    fireEvent.click(expandedButtons[0])
    expect(screen.queryByText('line 1')).toBeNull()
  })

  it('does not show the reviewed checkbox without a handler', () => {
    renderWithProvider(<DiffFile file={mockFile} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('starts collapsed when reviewed', () => {
    renderWithProvider(<DiffFile file={mockFile} defaultExpanded reviewed onReviewedChange={() => {}} />)

    expect(screen.queryByText('line 1')).toBeNull()
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('collapses when marked reviewed and expands when unmarked', () => {
    const onReviewedChange = vi.fn()
    const { rerender } = renderWithProvider(
      <DiffFile file={mockFile} defaultExpanded onReviewedChange={onReviewedChange} />
    )
    expect(screen.getByText('line 1')).toBeDefined()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onReviewedChange).toHaveBeenCalledWith('src/app.ts', true)

    rerender(
      <CommentProvider reviewId={null}>
        <DiffFile file={mockFile} defaultExpanded reviewed onReviewedChange={onReviewedChange} />
      </CommentProvider>
    )
    expect(screen.queryByText('line 1')).toBeNull()

    rerender(
      <CommentProvider reviewId={null}>
        <DiffFile file={mockFile} defaultExpanded reviewed={false} onReviewedChange={onReviewedChange} />
      </CommentProvider>
    )
    expect(screen.getByText('line 1')).toBeDefined()
  })

  it('shows renamed file path format', () => {
    const renamedFile: DiffFileType = {
      oldPath: 'old-name.ts',
      newPath: 'new-name.ts',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      hunks: [],
    }

    renderWithProvider(<DiffFile file={renamedFile} />)

    expect(screen.getByText('old-name.ts → new-name.ts')).toBeDefined()
    expect(screen.getByText('Renamed')).toBeDefined()
  })

  it('shows message for renamed file without content changes', () => {
    const renamedFile: DiffFileType = {
      oldPath: 'old.ts',
      newPath: 'new.ts',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      hunks: [],
    }

    renderWithProvider(<DiffFile file={renamedFile} defaultExpanded />)

    expect(screen.getByText('File renamed (no content changes)')).toBeDefined()
  })

  it('renders added file badge', () => {
    const addedFile: DiffFileType = {
      oldPath: 'new-file.ts',
      newPath: 'new-file.ts',
      status: 'added',
      additions: 10,
      deletions: 0,
      hunks: [],
    }

    renderWithProvider(<DiffFile file={addedFile} />)

    expect(screen.getByText('Added')).toBeDefined()
  })

  it('renders deleted file badge', () => {
    const deletedFile: DiffFileType = {
      oldPath: 'old-file.ts',
      newPath: 'old-file.ts',
      status: 'deleted',
      additions: 0,
      deletions: 15,
      hunks: [],
    }

    renderWithProvider(<DiffFile file={deletedFile} />)

    expect(screen.getByText('Deleted')).toBeDefined()
  })
})
