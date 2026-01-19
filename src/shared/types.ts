/**
 * Shared types between server and web client
 */

export interface Review {
  id: string;
  repositoryPath: string;
  baseRef: string | null;
  sourceType: ReviewSourceType;
  sourceRef: string | null; // branch name, commit SHAs, etc.
  snapshotData: string; // JSON serialized diff data
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReviewStatus = 'in_progress' | 'approved' | 'changes_requested'
export type ReviewSourceType = 'staged' | 'branch' | 'commits'

export interface Comment {
  id: string;
  reviewId: string;
  filePath: string;
  lineNumber: number | null; // null for file-level comments
  lineType: 'added' | 'removed' | 'context' | null;
  content: string;
  suggestion: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  reviewId: string | null; // null for global todos
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

/** File metadata without hunks (for lazy loading) */
export interface DiffFileMetadata {
  oldPath: string;
  newPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface RepositoryInfo {
  name: string;
  branch: string;
  remote: string | null;
  path: string;
}

// API request/response types
export interface CreateReviewRequest {
  sourceType?: ReviewSourceType;
  sourceRef?: string; // branch name or commit SHAs
}

export interface UpdateReviewRequest {
  status?: ReviewStatus;
}

export interface CreateCommentRequest {
  filePath: string;
  lineNumber?: number;
  lineType?: 'added' | 'removed' | 'context';
  content: string;
  suggestion?: string;
}

export interface UpdateCommentRequest {
  content?: string;
  suggestion?: string;
}

export interface CreateTodoRequest {
  content: string;
  reviewId?: string;
}

export interface UpdateTodoRequest {
  content?: string;
  completed?: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthResponse {
  status: 'ok';
  authRequired: boolean;
}

export interface PaginatedResponse<T> {
  reviews: T[];
  total: number;
  page: number;
  pageSize: number;
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

// File browser types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  isChanged?: boolean; // true if file is in the current review diff
}

export interface FileContentAtRef {
  path: string;
  ref: string;
  content: string;
  lines: string[];
  lineCount: number;
  isBinary: boolean;
}

export interface FileTreeResponse {
  ref: string;
  files: string[];
}
