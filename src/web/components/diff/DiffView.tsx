import { DiffFile } from './DiffFile';
import type { DiffFile as DiffFileType, DiffSummary } from '../../../shared/types';

interface DiffViewProps {
  files: DiffFileType[];
  summary?: DiffSummary;
  selectedFile?: string;
  allowComments?: boolean;
}

export function DiffView({ files, summary, selectedFile, allowComments = false }: DiffViewProps) {
  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No changes to display</p>
          <p className="text-sm">Stage some changes to see them here</p>
        </div>
      </div>
    );
  }

  // If a file is selected, scroll to it
  const filesToShow = selectedFile
    ? files.filter((f) => (f.newPath || f.oldPath) === selectedFile)
    : files;

  return (
    <div className="flex-1 overflow-y-auto p-4 min-w-0">
      {summary && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-600">
              <span className="font-medium">{summary.totalFiles}</span> files changed
            </span>
            <span className="text-green-600">
              <span className="font-medium">+{summary.totalAdditions}</span> additions
            </span>
            <span className="text-red-600">
              <span className="font-medium">-{summary.totalDeletions}</span> deletions
            </span>
            {summary.filesAdded > 0 && (
              <span className="text-gray-500">{summary.filesAdded} added</span>
            )}
            {summary.filesModified > 0 && (
              <span className="text-gray-500">{summary.filesModified} modified</span>
            )}
            {summary.filesDeleted > 0 && (
              <span className="text-gray-500">{summary.filesDeleted} deleted</span>
            )}
            {summary.filesRenamed > 0 && (
              <span className="text-gray-500">{summary.filesRenamed} renamed</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filesToShow.map((file) => (
          <DiffFile
            key={file.newPath || file.oldPath}
            file={file}
            defaultExpanded={filesToShow.length <= 5}
            allowComments={allowComments}
          />
        ))}
      </div>
    </div>
  );
}
