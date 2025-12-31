import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffView } from '../../../src/web/components/diff/DiffView';
import type { DiffFile, DiffSummary } from '../../../src/shared/types';

describe('DiffView', () => {
  const mockFiles: DiffFile[] = [
    {
      oldPath: 'file1.ts',
      newPath: 'file1.ts',
      status: 'modified',
      additions: 3,
      deletions: 1,
      hunks: [],
    },
    {
      oldPath: 'file2.ts',
      newPath: 'file2.ts',
      status: 'added',
      additions: 10,
      deletions: 0,
      hunks: [],
    },
  ];

  const mockSummary: DiffSummary = {
    totalFiles: 2,
    totalAdditions: 13,
    totalDeletions: 1,
    filesAdded: 1,
    filesModified: 1,
    filesDeleted: 0,
    filesRenamed: 0,
  };

  it('renders empty state when no files', () => {
    render(<DiffView files={[]} />);

    expect(screen.getByText('No changes to display')).toBeDefined();
    expect(screen.getByText('Stage some changes to see them here')).toBeDefined();
  });

  it('renders files list', () => {
    render(<DiffView files={mockFiles} />);

    expect(screen.getByText('file1.ts')).toBeDefined();
    expect(screen.getByText('file2.ts')).toBeDefined();
  });

  it('renders summary when provided', () => {
    render(<DiffView files={mockFiles} summary={mockSummary} />);

    expect(screen.getByText('2')).toBeDefined(); // totalFiles
    expect(screen.getByText('+13')).toBeDefined(); // additions
    expect(screen.getByText('files changed')).toBeDefined();
    expect(screen.getByText('additions')).toBeDefined();
    expect(screen.getByText('deletions')).toBeDefined();
  });

  it('shows file counts by status in summary', () => {
    render(<DiffView files={mockFiles} summary={mockSummary} />);

    expect(screen.getByText('1 added')).toBeDefined();
    expect(screen.getByText('1 modified')).toBeDefined();
  });

  it('filters to selected file when provided', () => {
    render(<DiffView files={mockFiles} selectedFile="file1.ts" />);

    expect(screen.getByText('file1.ts')).toBeDefined();
    expect(screen.queryByText('file2.ts')).toBeNull();
  });

  it('shows all files when no selection', () => {
    render(<DiffView files={mockFiles} />);

    expect(screen.getByText('file1.ts')).toBeDefined();
    expect(screen.getByText('file2.ts')).toBeDefined();
  });
});
