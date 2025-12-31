/**
 * Export service - generates markdown reports from reviews
 */
import type { DatabaseSync } from 'node:sqlite';
import { ReviewRepository } from '../repositories/review.repo.ts';
import { CommentRepository } from '../repositories/comment.repo.ts';
import { getDiffSummary } from './diff.service.ts';
import type { DiffFile, DiffLine, Comment, RepositoryInfo } from '../../shared/types.ts';

export interface ExportOptions {
  includeResolved?: boolean;
  includeDiffSnippets?: boolean;
}

export class ExportService {
  private reviewRepo: ReviewRepository;
  private commentRepo: CommentRepository;

  constructor(db: DatabaseSync) {
    this.reviewRepo = new ReviewRepository(db);
    this.commentRepo = new CommentRepository(db);
  }

  /**
   * Export a review to markdown format
   */
  exportToMarkdown(reviewId: string, options: ExportOptions = {}): string | null {
    const { includeResolved = true, includeDiffSnippets = true } = options;

    const review = this.reviewRepo.findById(reviewId);
    if (!review) {
      return null;
    }

    const snapshot = JSON.parse(review.snapshotData) as {
      files: DiffFile[];
      repository: RepositoryInfo;
    };

    const allComments = this.commentRepo.findByReview(reviewId);
    const comments = includeResolved
      ? allComments
      : allComments.filter((c) => !c.resolved);

    const summary = getDiffSummary(snapshot.files);

    const lines: string[] = [];

    // Header
    lines.push(`# Code Review: ${review.title}`);
    lines.push('');

    // Metadata
    lines.push('## Overview');
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Repository | ${snapshot.repository.name} |`);
    lines.push(`| Branch | ${snapshot.repository.branch} |`);
    lines.push(`| Status | ${formatStatus(review.status)} |`);
    lines.push(`| Created | ${formatDate(review.createdAt)} |`);
    if (review.baseRef) {
      lines.push(`| Base Commit | \`${review.baseRef.slice(0, 8)}\` |`);
    }
    lines.push('');

    if (review.description) {
      lines.push('### Description');
      lines.push('');
      lines.push(review.description);
      lines.push('');
    }

    // Summary
    lines.push('## Changes Summary');
    lines.push('');
    lines.push(`- **${summary.totalFiles}** files changed`);
    lines.push(`- **+${summary.totalAdditions}** additions`);
    lines.push(`- **-${summary.totalDeletions}** deletions`);
    if (summary.filesAdded > 0) lines.push(`- ${summary.filesAdded} files added`);
    if (summary.filesModified > 0) lines.push(`- ${summary.filesModified} files modified`);
    if (summary.filesDeleted > 0) lines.push(`- ${summary.filesDeleted} files deleted`);
    if (summary.filesRenamed > 0) lines.push(`- ${summary.filesRenamed} files renamed`);
    lines.push('');

    // Comments summary
    if (comments.length > 0) {
      const resolved = comments.filter((c) => c.resolved).length;
      const unresolved = comments.filter((c) => !c.resolved).length;
      const withSuggestions = comments.filter((c) => c.suggestion).length;

      lines.push('## Comments Summary');
      lines.push('');
      lines.push(`- **${comments.length}** total comments`);
      if (unresolved > 0) lines.push(`- **${unresolved}** unresolved`);
      if (resolved > 0) lines.push(`- **${resolved}** resolved`);
      if (withSuggestions > 0) lines.push(`- **${withSuggestions}** with suggestions`);
      lines.push('');
    }

    // Files with comments
    if (comments.length > 0) {
      lines.push('## Review Comments');
      lines.push('');

      // Group comments by file
      const commentsByFile = new Map<string, Comment[]>();
      for (const comment of comments) {
        const existing = commentsByFile.get(comment.filePath) || [];
        commentsByFile.set(comment.filePath, [...existing, comment]);
      }

      for (const [filePath, fileComments] of commentsByFile) {
        lines.push(`### ${filePath}`);
        lines.push('');

        // Sort by line number
        const sorted = [...fileComments].sort((a, b) =>
          (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
        );

        for (const comment of sorted) {
          const resolvedBadge = comment.resolved ? ' ✅' : '';
          const lineInfo = comment.lineNumber
            ? `Line ${comment.lineNumber}`
            : 'File-level comment';

          lines.push(`#### ${lineInfo}${resolvedBadge}`);
          lines.push('');

          // Include diff snippet if requested
          if (includeDiffSnippets && comment.lineNumber) {
            const file = snapshot.files.find(
              (f) => f.newPath === filePath || f.oldPath === filePath
            );
            if (file) {
              const snippet = getDiffSnippet(file, comment.lineNumber, comment.lineType);
              if (snippet) {
                lines.push('```diff');
                lines.push(snippet);
                lines.push('```');
                lines.push('');
              }
            }
          }

          lines.push(comment.content);
          lines.push('');

          if (comment.suggestion) {
            lines.push('**Suggested change:**');
            lines.push('');
            lines.push('```');
            lines.push(comment.suggestion);
            lines.push('```');
            lines.push('');
          }
        }
      }
    }

    // Files changed list
    lines.push('## Files Changed');
    lines.push('');
    for (const file of snapshot.files) {
      const path = file.newPath || file.oldPath;
      const badge = {
        added: '🆕',
        deleted: '🗑️',
        modified: '📝',
        renamed: '📋',
      }[file.status];
      lines.push(`- ${badge} \`${path}\` (+${file.additions}/-${file.deletions})`);
    }
    lines.push('');

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Exported from local-code-reviewer on ${formatDate(new Date().toISOString())}*`);

    return lines.join('\n');
  }
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    in_progress: '🔄 In Progress',
    approved: '✅ Approved',
    changes_requested: '⚠️ Changes Requested',
  };
  return labels[status] || status;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDiffSnippet(
  file: DiffFile,
  lineNumber: number,
  lineType: string | null
): string | null {
  // Find the line in the hunks
  for (const hunk of file.hunks) {
    for (let i = 0; i < hunk.lines.length; i++) {
      const line = hunk.lines[i];
      const matchesLine = lineType === 'removed'
        ? line.oldLineNumber === lineNumber
        : line.newLineNumber === lineNumber;

      if (matchesLine && (lineType === null || line.type === lineType)) {
        // Get context: 2 lines before and after
        const start = Math.max(0, i - 2);
        const end = Math.min(hunk.lines.length, i + 3);
        const snippetLines = hunk.lines.slice(start, end);

        return snippetLines
          .map((l) => formatDiffLine(l))
          .join('\n');
      }
    }
  }
  return null;
}

function formatDiffLine(line: DiffLine): string {
  const prefix = {
    added: '+',
    removed: '-',
    context: ' ',
  }[line.type];
  return `${prefix}${line.content}`;
}
