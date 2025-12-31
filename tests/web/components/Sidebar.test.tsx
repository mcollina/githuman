import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../../src/web/components/layout/Sidebar';
import type { DiffFile } from '../../../src/shared/types';

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
  ];

  it('renders empty state when no files', () => {
    render(<Sidebar files={[]} onFileSelect={() => {}} />);

    expect(screen.getByText('No files to display')).toBeDefined();
  });

  it('renders file count', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} />);

    expect(screen.getByText('Files (3)')).toBeDefined();
  });

  it('renders file names', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} />);

    expect(screen.getByText('app.ts')).toBeDefined();
    expect(screen.getByText('utils.ts')).toBeDefined();
    expect(screen.getByText('old.ts')).toBeDefined();
  });

  it('renders status indicators', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} />);

    expect(screen.getByText('M')).toBeDefined(); // Modified
    expect(screen.getByText('A')).toBeDefined(); // Added
    expect(screen.getByText('D')).toBeDefined(); // Deleted
  });

  it('renders addition/deletion counts', () => {
    render(<Sidebar files={mockFiles} onFileSelect={() => {}} />);

    expect(screen.getByText('+5')).toBeDefined();
    expect(screen.getByText('-2')).toBeDefined();
  });

  it('calls onFileSelect when file is clicked', () => {
    const onFileSelect = vi.fn();
    render(<Sidebar files={mockFiles} onFileSelect={onFileSelect} />);

    fireEvent.click(screen.getByText('app.ts'));

    expect(onFileSelect).toHaveBeenCalledWith('src/app.ts');
  });

  it('highlights selected file', () => {
    const { container } = render(
      <Sidebar files={mockFiles} selectedFile="src/app.ts" onFileSelect={() => {}} />
    );

    const selectedButton = container.querySelector('.bg-blue-50');
    expect(selectedButton).toBeDefined();
  });
});
