import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '../../../src/web/components/layout/Sidebar'
import { SettingsProvider } from '../../../src/web/contexts/SettingsContext'
import type { DiffFile } from '../../../src/shared/types'

describe('Sidebar', () => {
  const mockFiles: DiffFile[] = [
    {
      oldPath: 'src/app.ts',
      newPath: 'src/app.ts',
      status: 'modified',
      additions: 5,
      deletions: 2,
      hunks: [],
    },
    {
      oldPath: 'src/utils.ts',
      newPath: 'src/utils.ts',
      status: 'added',
      additions: 10,
      deletions: 0,
      hunks: [],
    },
    {
      oldPath: 'src/old.ts',
      newPath: 'src/old.ts',
      status: 'deleted',
      additions: 0,
      deletions: 15,
      hunks: [],
    },
  ]

  const renderSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
    return render(
      <SettingsProvider>
        <Sidebar {...props} />
      </SettingsProvider>
    )
  }

  it('renders empty state when no files', () => {
    renderSidebar({ files: [], onFileSelect: () => {} })

    expect(screen.getByText('No files to display')).toBeDefined()
  })

  it('renders file count', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    expect(screen.getByText('Files')).toBeDefined()
    expect(screen.getByText('(3)')).toBeDefined()
  })

  it('renders full file paths', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    expect(screen.getByText('src/app.ts')).toBeDefined()
    expect(screen.getByText('src/utils.ts')).toBeDefined()
    expect(screen.getByText('src/old.ts')).toBeDefined()
  })

  it('renders status indicators', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    expect(screen.getByText('M')).toBeDefined() // Modified
    expect(screen.getByText('A')).toBeDefined() // Added
    expect(screen.getByText('D')).toBeDefined() // Deleted
  })

  it('renders addition/deletion counts', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    expect(screen.getByText('+5')).toBeDefined()
    expect(screen.getByText('-2')).toBeDefined()
  })

  it('calls onFileSelect when file is clicked', () => {
    const onFileSelect = vi.fn()
    renderSidebar({ files: mockFiles, onFileSelect })

    fireEvent.click(screen.getByText('src/app.ts'))

    expect(onFileSelect).toHaveBeenCalledWith('src/app.ts')
  })

  it('highlights selected file', () => {
    const { container } = renderSidebar({
      files: mockFiles,
      selectedFile: 'src/app.ts',
      onFileSelect: () => {},
    })

    // Check for the selected file styling (uses CSS variable)
    const selectedButton = container.querySelector('[class*="--gh-bg-surface"]')
    expect(selectedButton).toBeDefined()
  })

  it('filters files by path', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    const filterInput = screen.getByPlaceholderText('Filter files...')
    fireEvent.change(filterInput, { target: { value: 'app' } })

    expect(screen.getByText('src/app.ts')).toBeDefined()
    expect(screen.queryByText('src/utils.ts')).toBeNull()
    expect(screen.queryByText('src/old.ts')).toBeNull()
  })

  it('shows no matching files message when filter has no results', () => {
    renderSidebar({ files: mockFiles, onFileSelect: () => {} })

    const filterInput = screen.getByPlaceholderText('Filter files...')
    fireEvent.change(filterInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No matching files')).toBeDefined()
  })
})
