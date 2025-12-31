/**
 * Comment repository - data access layer for comments
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Comment } from '../../shared/types.ts';

interface CommentRow {
  id: string;
  review_id: string;
  file_path: string;
  line_number: number | null;
  line_type: string | null;
  content: string;
  suggestion: string | null;
  resolved: number;
  created_at: string;
  updated_at: string;
}

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    reviewId: row.review_id,
    filePath: row.file_path,
    lineNumber: row.line_number,
    lineType: row.line_type as Comment['lineType'],
    content: row.content,
    suggestion: row.suggestion,
    resolved: row.resolved === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CommentRepository {
  private db: DatabaseSync;
  private stmtFindById: StatementSync;
  private stmtFindByReview: StatementSync;
  private stmtFindByFile: StatementSync;
  private stmtInsert: StatementSync;
  private stmtUpdate: StatementSync;
  private stmtSetResolved: StatementSync;
  private stmtDelete: StatementSync;
  private stmtDeleteByReview: StatementSync;
  private stmtCountByReview: StatementSync;
  private stmtCountUnresolvedByReview: StatementSync;

  constructor(db: DatabaseSync) {
    this.db = db;

    this.stmtFindById = db.prepare(`
      SELECT * FROM comments WHERE id = ?
    `);

    this.stmtFindByReview = db.prepare(`
      SELECT * FROM comments
      WHERE review_id = ?
      ORDER BY file_path, line_number NULLS FIRST, created_at
    `);

    this.stmtFindByFile = db.prepare(`
      SELECT * FROM comments
      WHERE review_id = ? AND file_path = ?
      ORDER BY line_number NULLS FIRST, created_at
    `);

    this.stmtInsert = db.prepare(`
      INSERT INTO comments (id, review_id, file_path, line_number, line_type, content, suggestion, resolved, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdate = db.prepare(`
      UPDATE comments
      SET content = COALESCE(?, content),
          suggestion = ?,
          updated_at = ?
      WHERE id = ?
    `);

    this.stmtSetResolved = db.prepare(`
      UPDATE comments
      SET resolved = ?,
          updated_at = ?
      WHERE id = ?
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM comments WHERE id = ?
    `);

    this.stmtDeleteByReview = db.prepare(`
      DELETE FROM comments WHERE review_id = ?
    `);

    this.stmtCountByReview = db.prepare(`
      SELECT COUNT(*) as count FROM comments WHERE review_id = ?
    `);

    this.stmtCountUnresolvedByReview = db.prepare(`
      SELECT COUNT(*) as count FROM comments WHERE review_id = ? AND resolved = 0
    `);
  }

  findById(id: string): Comment | null {
    const row = this.stmtFindById.get(id) as CommentRow | undefined;
    return row ? rowToComment(row) : null;
  }

  findByReview(reviewId: string): Comment[] {
    const rows = this.stmtFindByReview.all(reviewId) as unknown as CommentRow[];
    return rows.map(rowToComment);
  }

  findByFile(reviewId: string, filePath: string): Comment[] {
    const rows = this.stmtFindByFile.all(reviewId, filePath) as unknown as CommentRow[];
    return rows.map(rowToComment);
  }

  create(comment: Omit<Comment, 'createdAt' | 'updatedAt'>): Comment {
    const now = new Date().toISOString();

    this.stmtInsert.run(
      comment.id,
      comment.reviewId,
      comment.filePath,
      comment.lineNumber,
      comment.lineType,
      comment.content,
      comment.suggestion,
      comment.resolved ? 1 : 0,
      now,
      now
    );

    return this.findById(comment.id)!;
  }

  update(
    id: string,
    updates: { content?: string; suggestion?: string | null }
  ): Comment | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    // For suggestion, we want to allow setting it to null explicitly
    const suggestionValue =
      updates.suggestion === undefined ? existing.suggestion : updates.suggestion;

    this.stmtUpdate.run(
      updates.content ?? null,
      suggestionValue,
      now,
      id
    );

    return this.findById(id);
  }

  setResolved(id: string, resolved: boolean): Comment | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    this.stmtSetResolved.run(resolved ? 1 : 0, now, id);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }

  deleteByReview(reviewId: string): number {
    const result = this.stmtDeleteByReview.run(reviewId);
    return Number(result.changes);
  }

  countByReview(reviewId: string): number {
    const result = this.stmtCountByReview.get(reviewId) as { count: number };
    return result.count;
  }

  countUnresolvedByReview(reviewId: string): number {
    const result = this.stmtCountUnresolvedByReview.get(reviewId) as { count: number };
    return result.count;
  }
}
