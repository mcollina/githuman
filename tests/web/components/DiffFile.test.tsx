import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffFile } from '../../../src/web/components/diff/DiffFile';
import type { DiffFile as DiffFileType } from '../../../src/shared/types';

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
  };

  it('renders file path', () => {
    render(<DiffFile file={mockFile} />);

    expect(screen.getByText('src/app.ts')).toBeDefined();
  });

  it('renders status badge', () => {
    render(<DiffFile file={mockFile} />);

    expect(screen.getByText('Modified')).toBeDefined();
  });

  it('renders addition and deletion counts', () => {
    render(<DiffFile file={mockFile} />);

    expect(screen.getByText('+5')).toBeDefined();
    expect(screen.getByText('-2')).toBeDefined();
  });

  it('shows diff content when expanded', () => {
    render(<DiffFile file={mockFile} defaultExpanded={true} />);

    expect(screen.getByText('line 1')).toBeDefined();
    expect(screen.getByText('old line')).toBeDefined();
    expect(screen.getByText('new line')).toBeDefined();
  });

  it('hides diff content when collapsed', () => {
    render(<DiffFile file={mockFile} defaultExpanded={false} />);

    expect(screen.queryByText('line 1')).toBeNull();
    expect(screen.queryByText('old line')).toBeNull();
  });

  it('toggles expansion on click', () => {
    render(<DiffFile file={mockFile} defaultExpanded={false} />);

    // Initially collapsed
    expect(screen.queryByText('line 1')).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('line 1')).toBeDefined();

    // Click to collapse
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('line 1')).toBeNull();
  });

  it('shows renamed file path format', () => {
    const renamedFile: DiffFileType = {
      oldPath: 'old-name.ts',
      newPath: 'new-name.ts',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    render(<DiffFile file={renamedFile} />);

    expect(screen.getByText('old-name.ts → new-name.ts')).toBeDefined();
    expect(screen.getByText('Renamed')).toBeDefined();
  });

  it('shows message for renamed file without content changes', () => {
    const renamedFile: DiffFileType = {
      oldPath: 'old.ts',
      newPath: 'new.ts',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    render(<DiffFile file={renamedFile} defaultExpanded={true} />);

    expect(screen.getByText('File renamed (no content changes)')).toBeDefined();
  });

  it('renders added file badge', () => {
    const addedFile: DiffFileType = {
      oldPath: 'new-file.ts',
      newPath: 'new-file.ts',
      status: 'added',
      additions: 10,
      deletions: 0,
      hunks: [],
    };

    render(<DiffFile file={addedFile} />);

    expect(screen.getByText('Added')).toBeDefined();
  });

  it('renders deleted file badge', () => {
    const deletedFile: DiffFileType = {
      oldPath: 'old-file.ts',
      newPath: 'old-file.ts',
      status: 'deleted',
      additions: 0,
      deletions: 15,
      hunks: [],
    };

    render(<DiffFile file={deletedFile} />);

    expect(screen.getByText('Deleted')).toBeDefined();
  });
});
