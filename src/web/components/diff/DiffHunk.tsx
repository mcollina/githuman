import { useEffect } from 'react';
import { DiffLine } from './DiffLine';
import { useHighlighterContext } from '../../contexts/HighlighterContext';
import type { DiffHunk as DiffHunkType } from '../../../shared/types';

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath: string;
  showLineNumbers?: boolean;
  allowComments?: boolean;
  onLineClick?: (filePath: string, lineNumber: number, lineType: 'added' | 'removed' | 'context') => void;
}

export function DiffHunk({ hunk, filePath, showLineNumbers = true, allowComments = false, onLineClick }: DiffHunkProps) {
  const highlighter = useHighlighterContext();
  const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;

  // Trigger highlighting for this file's lines
  useEffect(() => {
    if (highlighter?.isReady) {
      const lines = hunk.lines.map((l) => l.content);
      highlighter.highlightFile(filePath, lines);
    }
  }, [highlighter?.isReady, filePath, hunk.lines, highlighter]);

  return (
    <div className="border-b border-[var(--gh-border)] last:border-b-0 min-w-max">
      <div className="bg-[var(--gh-accent-secondary)]/10 px-4 py-1 font-mono text-sm text-[var(--gh-accent-secondary)] border-y border-[var(--gh-accent-secondary)]/20">
        {header}
      </div>
      <div>
        {hunk.lines.map((line, index) => (
          <DiffLine
            key={index}
            line={line}
            filePath={filePath}
            showLineNumbers={showLineNumbers}
            allowComments={allowComments}
            onLineClick={onLineClick}
          />
        ))}
      </div>
    </div>
  );
}
