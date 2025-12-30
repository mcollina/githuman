/**
 * Diff parsing service - parses unified diff format into structured data
 */
import type { DiffFile, DiffHunk, DiffLine } from '../../shared/types.ts';

/**
 * Parse a unified diff string into structured diff files
 */
export function parseDiff(diffText: string): DiffFile[] {
  if (!diffText.trim()) {
    return [];
  }

  const files: DiffFile[] = [];
  const fileDiffs = splitIntoFiles(diffText);

  for (const fileDiff of fileDiffs) {
    const file = parseFileDiff(fileDiff);
    if (file) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Split a unified diff into separate file diffs
 */
function splitIntoFiles(diffText: string): string[] {
  const files: string[] = [];
  const lines = diffText.split('\n');
  let currentFile: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile.length > 0) {
        files.push(currentFile.join('\n'));
      }
      currentFile = [line];
    } else {
      currentFile.push(line);
    }
  }

  if (currentFile.length > 0) {
    files.push(currentFile.join('\n'));
  }

  return files;
}

/**
 * Parse a single file diff
 */
function parseFileDiff(fileDiff: string): DiffFile | null {
  const lines = fileDiff.split('\n');

  // Parse diff header
  const diffLine = lines.find((l) => l.startsWith('diff --git'));
  if (!diffLine) {
    return null;
  }

  // Extract file paths from diff --git a/path b/path
  const pathMatch = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
  if (!pathMatch) {
    return null;
  }

  const oldPath = pathMatch[1];
  const newPath = pathMatch[2];

  // Determine file status
  let status: DiffFile['status'] = 'modified';
  const hasOldMode = lines.some((l) => l.startsWith('deleted file mode'));
  const hasNewMode = lines.some((l) => l.startsWith('new file mode'));
  const hasRename = lines.some((l) => l.startsWith('rename from'));

  if (hasOldMode) {
    status = 'deleted';
  } else if (hasNewMode) {
    status = 'added';
  } else if (hasRename || oldPath !== newPath) {
    status = 'renamed';
  }

  // Parse hunks
  const hunks = parseHunks(lines);

  // Calculate additions and deletions
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') {
        additions++;
      } else if (line.type === 'removed') {
        deletions++;
      }
    }
  }

  return {
    oldPath,
    newPath,
    status,
    additions,
    deletions,
    hunks,
  };
}

/**
 * Parse hunks from file diff lines
 */
function parseHunks(lines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[3], 10);

      currentHunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(hunkMatch[2] ?? '1', 10),
        newStart: newLineNum,
        newLines: parseInt(hunkMatch[4] ?? '1', 10),
        lines: [],
      };
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    // Parse diff lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({
        type: 'added',
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLineNum,
      });
      newLineNum++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({
        type: 'removed',
        content: line.slice(1),
        oldLineNumber: oldLineNum,
        newLineNumber: null,
      });
      oldLineNum++;
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      oldLineNum++;
      newLineNum++;
    } else if (line === '\\ No newline at end of file') {
      // Skip this marker
      continue;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Get summary statistics from parsed diff files
 */
export function getDiffSummary(files: DiffFile[]): DiffSummary {
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;
  }

  return {
    totalFiles: files.length,
    totalAdditions,
    totalDeletions,
    filesAdded: files.filter((f) => f.status === 'added').length,
    filesModified: files.filter((f) => f.status === 'modified').length,
    filesDeleted: files.filter((f) => f.status === 'deleted').length,
    filesRenamed: files.filter((f) => f.status === 'renamed').length,
  };
}

export interface DiffSummary {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  filesRenamed: number;
}
