import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageDiff, isImageFile } from '../../../src/web/components/diff/ImageDiff';
import type { DiffFile } from '../../../src/shared/types';

describe('isImageFile', () => {
  it('should detect PNG files', () => {
    expect(isImageFile('image.png')).toBe(true);
    expect(isImageFile('path/to/image.png')).toBe(true);
  });

  it('should detect JPG/JPEG files', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
  });

  it('should detect GIF files', () => {
    expect(isImageFile('animation.gif')).toBe(true);
  });

  it('should detect SVG files', () => {
    expect(isImageFile('icon.svg')).toBe(true);
  });

  it('should detect WebP files', () => {
    expect(isImageFile('modern.webp')).toBe(true);
  });

  it('should detect ICO files', () => {
    expect(isImageFile('favicon.ico')).toBe(true);
  });

  it('should detect BMP files', () => {
    expect(isImageFile('bitmap.bmp')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isImageFile('IMAGE.PNG')).toBe(true);
    expect(isImageFile('Photo.JPG')).toBe(true);
    expect(isImageFile('icon.SVG')).toBe(true);
  });

  it('should return false for non-image files', () => {
    expect(isImageFile('script.js')).toBe(false);
    expect(isImageFile('style.css')).toBe(false);
    expect(isImageFile('document.pdf')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
    expect(isImageFile('README.md')).toBe(false);
  });
});

describe('ImageDiff', () => {
  const createMockFile = (status: DiffFile['status']): DiffFile => ({
    oldPath: 'image.png',
    newPath: 'image.png',
    status,
    additions: 0,
    deletions: 0,
    hunks: [],
  });

  it('should render view mode toggle for modified files', () => {
    render(<ImageDiff file={createMockFile('modified')} />);

    expect(screen.getByText('Side by Side')).toBeDefined();
    expect(screen.getByText('Overlay')).toBeDefined();
  });

  it('should show side-by-side view by default for modified files', () => {
    render(<ImageDiff file={createMockFile('modified')} />);

    // Side by Side button should be active (uses accent color)
    const sideBySideButton = screen.getByText('Side by Side');
    expect(sideBySideButton.className).toContain('--gh-accent-primary');

    // Should show both old and new labels
    expect(screen.getByText('Before')).toBeDefined();
    expect(screen.getByText('After')).toBeDefined();
  });

  it('should switch to overlay view when clicking Overlay button', () => {
    render(<ImageDiff file={createMockFile('modified')} />);

    fireEvent.click(screen.getByText('Overlay'));

    // Overlay button should now be active (uses accent color)
    const overlayButton = screen.getByText('Overlay');
    expect(overlayButton.className).toContain('--gh-accent-primary');

    // Should show slider
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('should show only new image for added files', () => {
    render(<ImageDiff file={createMockFile('added')} />);

    expect(screen.getByText('New Image')).toBeDefined();
    expect(screen.queryByText('Before')).toBeNull();
    expect(screen.queryByText('Side by Side')).toBeNull();
  });

  it('should show only old image for deleted files', () => {
    render(<ImageDiff file={createMockFile('deleted')} />);

    expect(screen.getByText('Deleted Image')).toBeDefined();
    expect(screen.queryByText('After')).toBeNull();
    expect(screen.queryByText('Side by Side')).toBeNull();
  });

  it('should render images with correct src attributes for modified files', () => {
    const file: DiffFile = {
      oldPath: 'old-image.png',
      newPath: 'new-image.png',
      status: 'modified',
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    render(<ImageDiff file={file} />);

    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);

    // Find images by their alt text
    const beforeImg = screen.getByAltText(/Before:/);
    const afterImg = screen.getByAltText(/After:/);

    expect(beforeImg.getAttribute('src')).toBe('/api/diff/image/old-image.png?version=head');
    expect(afterImg.getAttribute('src')).toBe('/api/diff/image/new-image.png?version=staged');
  });

  it('should update overlay opacity with slider', () => {
    render(<ImageDiff file={createMockFile('modified')} />);

    // Switch to overlay mode
    fireEvent.click(screen.getByText('Overlay'));

    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('0.5');

    // Change slider value
    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(slider.value).toBe('0.75');
  });

  it('should show side-by-side view for renamed files', () => {
    const renamedFile: DiffFile = {
      oldPath: 'old-name.png',
      newPath: 'new-name.png',
      status: 'renamed',
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    render(<ImageDiff file={renamedFile} />);

    // Should show Before and After labels
    expect(screen.getByText('Before')).toBeDefined();
    expect(screen.getByText('After')).toBeDefined();
  });
});
