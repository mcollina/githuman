/**
 * Review file repository - data access layer for review files
 * Stores per-file diff data for lazy loading
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite'
import type { DiffHunk } from '../../shared/types.ts'

export interface ReviewFile {
  id: string;
  reviewId: string;
  filePath: string;
  oldPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunksData: string | null; // JSON-encoded DiffHunk[], null for committed reviews
  createdAt: string;
}

export interface ReviewFileMetadata {
  id: string;
  reviewId: string;
  filePath: string;
  oldPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface CreateReviewFileInput {
  id: string;
  reviewId: string;
  filePath: string;
  oldPath?: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunksData?: string | null;
}

interface ReviewFileRow {
  id: string;
  review_id: string;
  file_path: string;
  old_path: string | null;
  status: string;
  additions: number;
  deletions: number;
  hunks_data: string | null;
  created_at: string;
}

function rowToReviewFile (row: ReviewFileRow): ReviewFile {
  return {
    id: row.id,
    reviewId: row.review_id,
    filePath: row.file_path,
    oldPath: row.old_path,
    status: row.status as ReviewFile['status'],
    additions: row.additions,
    deletions: row.deletions,
    hunksData: row.hunks_data,
    createdAt: row.created_at,
  }
}

function rowToReviewFileMetadata (row: ReviewFileRow): ReviewFileMetadata {
  return {
    id: row.id,
    reviewId: row.review_id,
    filePath: row.file_path,
    oldPath: row.old_path,
    status: row.status as ReviewFileMetadata['status'],
    additions: row.additions,
    deletions: row.deletions,
    createdAt: row.created_at,
  }
}

export class ReviewFileRepository {
  private db: DatabaseSync
  private stmtFindByReview: StatementSync
  private stmtFindByReviewAndPath: StatementSync
  private stmtInsert: StatementSync
  private stmtDeleteByReview: StatementSync
  private stmtCountByReview: StatementSync

  constructor (db: DatabaseSync) {
    this.db = db

    // Returns metadata only (no hunks_data for performance)
    this.stmtFindByReview = db.prepare(`
      SELECT id, review_id, file_path, old_path, status, additions, deletions, created_at
      FROM review_files
      WHERE review_id = ?
      ORDER BY file_path
    `)

    // Returns full data including hunks
    this.stmtFindByReviewAndPath = db.prepare(`
      SELECT * FROM review_files
      WHERE review_id = ? AND file_path = ?
    `)

    this.stmtInsert = db.prepare(`
      INSERT INTO review_files (id, review_id, file_path, old_path, status, additions, deletions, hunks_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.stmtDeleteByReview = db.prepare(`
      DELETE FROM review_files WHERE review_id = ?
    `)

    this.stmtCountByReview = db.prepare(`
      SELECT COUNT(*) as count FROM review_files WHERE review_id = ?
    `)
  }

  /**
   * Find all files for a review (metadata only, no hunks)
   */
  findByReview (reviewId: string): ReviewFileMetadata[] {
    const rows = this.stmtFindByReview.all(reviewId) as unknown as ReviewFileRow[]
    return rows.map(rowToReviewFileMetadata)
  }

  /**
   * Find a specific file by review and path (includes hunks)
   */
  findByReviewAndPath (reviewId: string, filePath: string): ReviewFile | null {
    const row = this.stmtFindByReviewAndPath.get(reviewId, filePath) as ReviewFileRow | undefined
    return row ? rowToReviewFile(row) : null
  }

  /**
   * Create a single file record
   */
  create (file: CreateReviewFileInput): ReviewFile {
    const now = new Date().toISOString()

    this.stmtInsert.run(
      file.id,
      file.reviewId,
      file.filePath,
      file.oldPath ?? null,
      file.status,
      file.additions,
      file.deletions,
      file.hunksData ?? null,
      now
    )

    return this.findByReviewAndPath(file.reviewId, file.filePath)!
  }

  /**
   * Create multiple file records in a single transaction
   */
  createBulk (files: CreateReviewFileInput[]): void {
    if (files.length === 0) return

    const now = new Date().toISOString()

    this.db.exec('BEGIN TRANSACTION')
    try {
      for (const file of files) {
        this.stmtInsert.run(
          file.id,
          file.reviewId,
          file.filePath,
          file.oldPath ?? null,
          file.status,
          file.additions,
          file.deletions,
          file.hunksData ?? null,
          now
        )
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * Delete all files for a review
   */
  deleteByReview (reviewId: string): number {
    const result = this.stmtDeleteByReview.run(reviewId)
    return Number(result.changes)
  }

  /**
   * Count files for a review
   */
  countByReview (reviewId: string): number {
    const result = this.stmtCountByReview.get(reviewId) as { count: number }
    return result.count
  }

  /**
   * Parse hunks data from JSON string
   */
  static parseHunks (hunksData: string | null): DiffHunk[] {
    if (!hunksData) return []
    try {
      return JSON.parse(hunksData) as DiffHunk[]
    } catch {
      return []
    }
  }

  /**
   * Serialize hunks to JSON string
   */
  static serializeHunks (hunks: DiffHunk[]): string {
    return JSON.stringify(hunks)
  }
}
