import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownDiff, isMarkdownFile } from '../../../src/web/components/diff/MarkdownDiff';
import type { DiffFile } from '../../../src/shared/types';

// Mock the diff API
vi.mock('../../../src/web/api/diff', () => ({
  diffApi: {
    getFileContent: vi.fn(),
  },
}));

import { diffApi } from '../../../src/web/api/diff';

const mockDiffApi = diffApi as {
  getFileContent: ReturnType<typeof vi.fn>;
};

describe('isMarkdownFile', () => {
  it('should detect .md files', () => {
    expect(isMarkdownFile('README.md')).toBe(true);
    expect(isMarkdownFile('docs/guide.md')).toBe(true);
  });

  it('should detect .markdown files', () => {
    expect(isMarkdownFile('README.markdown')).toBe(true);
  });

  it('should detect .mdx files', () => {
    expect(isMarkdownFile('component.mdx')).toBe(true);
  });

  it('should detect .mdown files', () => {
    expect(isMarkdownFile('notes.mdown')).toBe(true);
  });

  it('should detect .mkd files', () => {
    expect(isMarkdownFile('doc.mkd')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isMarkdownFile('README.MD')).toBe(true);
    expect(isMarkdownFile('guide.Markdown')).toBe(true);
  });

  it('should return false for non-markdown files', () => {
    expect(isMarkdownFile('script.js')).toBe(false);
    expect(isMarkdownFile('style.css')).toBe(false);
    expect(isMarkdownFile('index.html')).toBe(false);
    expect(isMarkdownFile('data.json')).toBe(false);
  });
});

describe('MarkdownDiff', () => {
  const mockFile: DiffFile = {
    oldPath: 'README.md',
    newPath: 'README.md',
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
          { type: 'context', content: '# Title', oldLineNumber: 1, newLineNumber: 1 },
          { type: 'removed', content: 'Old content', oldLineNumber: 2, newLineNumber: null },
          { type: 'added', content: 'New content', oldLineNumber: null, newLineNumber: 2 },
          { type: 'added', content: 'More content', oldLineNumber: null, newLineNumber: 3 },
          { type: 'context', content: '', oldLineNumber: 3, newLineNumber: 4 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with diff view by default', () => {
    render(<MarkdownDiff file={mockFile} />);

    // Should show diff button as active (has accent color)
    const diffButton = screen.getByRole('button', { name: 'Diff' });
    expect(diffButton.className).toContain('--gh-accent-primary');

    // Should show hunk header
    expect(screen.getByText(/@@ -1,3 \+1,4 @@/)).toBeDefined();
  });

  it('should show view mode toggle buttons', () => {
    render(<MarkdownDiff file={mockFile} />);

    expect(screen.getByRole('button', { name: 'Diff' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Split' })).toBeDefined();
  });

  it('should switch to preview mode and load content', async () => {
    mockDiffApi.getFileContent.mockResolvedValue({
      filePath: 'README.md',
      lines: ['# Hello World', '', 'This is a test.'],
    });

    render(<MarkdownDiff file={mockFile} />);

    // Click preview button
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeDefined();
    });

    // Should have called API
    expect(mockDiffApi.getFileContent).toHaveBeenCalledWith('README.md', 'staged');
  });

  it('should switch to split mode', async () => {
    mockDiffApi.getFileContent.mockResolvedValue({
      filePath: 'README.md',
      lines: ['# Test'],
    });

    render(<MarkdownDiff file={mockFile} />);

    fireEvent.click(screen.getByRole('button', { name: 'Split' }));

    await waitFor(() => {
      // Split mode should show both panes
      const splitButton = screen.getByRole('button', { name: 'Split' });
      expect(splitButton.className).toContain('--gh-accent-primary');
    });
  });

  it('should handle API errors gracefully', async () => {
    mockDiffApi.getFileContent.mockRejectedValue(new Error('Failed to load'));

    render(<MarkdownDiff file={mockFile} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeDefined();
    });
  });

  it('should not show preview/split for deleted files', () => {
    const deletedFile: DiffFile = {
      ...mockFile,
      status: 'deleted',
    };

    render(<MarkdownDiff file={deletedFile} />);

    expect(screen.getByRole('button', { name: 'Diff' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Split' })).toBeNull();
  });

  it('should cache file content between view mode switches', async () => {
    mockDiffApi.getFileContent.mockResolvedValue({
      filePath: 'README.md',
      lines: ['# Test'],
    });

    render(<MarkdownDiff file={mockFile} />);

    // Switch to preview
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });

    // Switch back to diff
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }));

    // Switch to preview again
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // Should only have called API once (cached)
    expect(mockDiffApi.getFileContent).toHaveBeenCalledTimes(1);
  });

  describe('HTML rendering', () => {
    it('should render safe HTML elements', async () => {
      mockDiffApi.getFileContent.mockResolvedValue({
        filePath: 'README.md',
        lines: [
          '# Test',
          '',
          '<details>',
          '<summary>Click to expand</summary>',
          'Hidden content',
          '</details>',
        ],
      });

      render(<MarkdownDiff file={mockFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

      await waitFor(() => {
        // Details/summary should be rendered
        expect(screen.getByText('Click to expand')).toBeDefined();
        expect(screen.getByText('Hidden content')).toBeDefined();
      });
    });

    it('should render kbd elements', async () => {
      mockDiffApi.getFileContent.mockResolvedValue({
        filePath: 'README.md',
        lines: ['Press <kbd>Ctrl</kbd> + <kbd>C</kbd>'],
      });

      render(<MarkdownDiff file={mockFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

      await waitFor(() => {
        const kbdElements = document.querySelectorAll('kbd');
        expect(kbdElements.length).toBe(2);
      });
    });

    it('should sanitize script tags', async () => {
      mockDiffApi.getFileContent.mockResolvedValue({
        filePath: 'README.md',
        lines: ["# Test", "<script>alert('XSS')</script>", 'Safe text'],
      });

      render(<MarkdownDiff file={mockFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

      await waitFor(() => {
        // Safe content should render
        expect(screen.getByText('Safe text')).toBeDefined();
        // Script tag should not exist
        expect(document.querySelector('script')).toBeNull();
      });
    });

    it('should sanitize javascript: links', async () => {
      mockDiffApi.getFileContent.mockResolvedValue({
        filePath: 'README.md',
        lines: ["<a href=\"javascript:alert('XSS')\">Click me</a>"],
      });

      render(<MarkdownDiff file={mockFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

      await waitFor(() => {
        const link = screen.getByText('Click me');
        expect(link).toBeDefined();
        // href should be sanitized (removed or empty)
        const href = link.getAttribute('href');
        expect(href === null || href === '' || !href.includes('javascript')).toBe(true);
      });
    });

    it('should sanitize onerror attributes', async () => {
      mockDiffApi.getFileContent.mockResolvedValue({
        filePath: 'README.md',
        lines: ["<img src=\"x\" onerror=\"alert('XSS')\">"],
      });

      render(<MarkdownDiff file={mockFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

      await waitFor(() => {
        const img = document.querySelector('img');
        // Image might exist but onerror should be removed
        if (img) {
          expect(img.getAttribute('onerror')).toBeNull();
        }
      });
    });
  });
});
