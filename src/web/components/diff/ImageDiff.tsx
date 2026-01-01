import { useState } from 'react';
import { cn } from '../../lib/utils';
import type { DiffFile } from '../../../shared/types';

interface ImageDiffProps {
  file: DiffFile;
}

// Image extensions that we can render
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'
]);

export function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function ImageDiff({ file }: ImageDiffProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);

  const filePath = file.newPath || file.oldPath;
  const oldPath = file.oldPath;
  const newPath = file.newPath;

  // Build image URLs
  const oldImageUrl = file.status !== 'added' ? `/api/diff/image/${oldPath}?version=head` : null;
  const newImageUrl = file.status !== 'deleted' ? `/api/diff/image/${newPath}?version=staged` : null;

  return (
    <div className="p-4">
      {/* View mode toggle for modified files */}
      {file.status === 'modified' && oldImageUrl && newImageUrl && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={cn(
              'px-3 py-1 text-sm rounded border',
              viewMode === 'side-by-side'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('overlay')}
            className={cn(
              'px-3 py-1 text-sm rounded border',
              viewMode === 'overlay'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}
          >
            Overlay
          </button>
        </div>
      )}

      {/* Added file - show new image */}
      {file.status === 'added' && newImageUrl && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-green-700">New Image</span>
          <ImageWithDimensions src={newImageUrl} alt={`Added: ${filePath}`} />
        </div>
      )}

      {/* Deleted file - show old image */}
      {file.status === 'deleted' && oldImageUrl && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-red-700">Deleted Image</span>
          <ImageWithDimensions src={oldImageUrl} alt={`Deleted: ${filePath}`} />
        </div>
      )}

      {/* Modified file - side by side view */}
      {(file.status === 'modified' || file.status === 'renamed') && viewMode === 'side-by-side' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {oldImageUrl && (
            <div className="flex flex-col items-center gap-2 p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-700">Before</span>
              <ImageWithDimensions src={oldImageUrl} alt={`Before: ${filePath}`} />
            </div>
          )}
          {newImageUrl && (
            <div className="flex flex-col items-center gap-2 p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-700">After</span>
              <ImageWithDimensions src={newImageUrl} alt={`After: ${filePath}`} />
            </div>
          )}
        </div>
      )}

      {/* Modified file - overlay view */}
      {file.status === 'modified' && viewMode === 'overlay' && oldImageUrl && newImageUrl && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative inline-block">
            <img
              src={oldImageUrl}
              alt={`Before: ${filePath}`}
              className="max-w-full h-auto border border-gray-200 rounded"
            />
            <img
              src={newImageUrl}
              alt={`After: ${filePath}`}
              className="absolute inset-0 max-w-full h-auto border border-gray-200 rounded"
              style={{ opacity: overlayOpacity }}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Before</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-32"
            />
            <span>After</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageWithDimensions({ src, alt }: { src: string; alt: string }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  if (error) {
    return (
      <div className="p-4 text-center text-gray-500 bg-gray-100 rounded">
        Failed to load image
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto border border-gray-200 rounded"
        onLoad={handleLoad}
        onError={() => setError(true)}
      />
      {dimensions && (
        <span className="text-xs text-gray-500">
          {dimensions.width} x {dimensions.height} px
        </span>
      )}
    </div>
  );
}
