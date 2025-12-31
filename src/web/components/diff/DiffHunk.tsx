import { DiffLine } from './DiffLine';
import type { DiffHunk as DiffHunkType } from '../../../shared/types';

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath: string;
  showLineNumbers?: boolean;
  allowComments?: boolean;
}

export function DiffHunk({ hunk, filePath, showLineNumbers = true, allowComments = false }: DiffHunkProps) {
  const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <div className="bg-blue-50 px-4 py-1 font-mono text-sm text-blue-700 border-y border-blue-200">
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
          />
        ))}
      </div>
    </div>
  );
}
