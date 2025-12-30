/**
 * Review repository - data access layer for reviews
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Review, ReviewStatus } from '../../shared/types.ts';

interface ReviewRow {
  id: string;
  title: string;
  description: string | null;
  repository_path: string;
  base_ref: string | null;
  snapshot_data: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    repositoryPath: row.repository_path,
    baseRef: row.base_ref,
    snapshotData: row.snapshot_data,
    status: row.status as ReviewStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ReviewRepository {
  private db: DatabaseSync;
  private stmtFindById: StatementSync;
  private stmtInsert: StatementSync;
  private stmtUpdateMeta: StatementSync;
  private stmtDelete: StatementSync;
  private stmtCountAll: StatementSync;
  private stmtCountByStatus: StatementSync;
  private stmtCountByRepo: StatementSync;

  constructor(db: DatabaseSync) {
    this.db = db;

    // Prepare statements for better performance
    this.stmtFindById = db.prepare(`
      SELECT * FROM reviews WHERE id = ?
    `);

    this.stmtInsert = db.prepare(`
      INSERT INTO reviews (id, title, description, repository_path, base_ref, snapshot_data, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdateMeta = db.prepare(`
      UPDATE reviews
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          updated_at = ?
      WHERE id = ?
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM reviews WHERE id = ?
    `);

    this.stmtCountAll = db.prepare(`
      SELECT COUNT(*) as count FROM reviews
    `);

    this.stmtCountByStatus = db.prepare(`
      SELECT COUNT(*) as count FROM reviews WHERE status = ?
    `);

    this.stmtCountByRepo = db.prepare(`
      SELECT COUNT(*) as count FROM reviews WHERE repository_path = ?
    `);
  }

  findById(id: string): Review | null {
    const row = this.stmtFindById.get(id) as ReviewRow | undefined;
    return row ? rowToReview(row) : null;
  }

  findAll(options: {
    status?: ReviewStatus;
    repositoryPath?: string;
    page?: number;
    pageSize?: number;
  } = {}): { data: Review[]; total: number } {
    const { status, repositoryPath, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (repositoryPath) {
      conditions.push('repository_path = ?');
      params.push(repositoryPath);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = this.db.prepare(`SELECT COUNT(*) as count FROM reviews ${whereClause}`);
    const countResult = countQuery.get(...params) as { count: number };
    const total = countResult.count;

    // Get paginated results
    const dataQuery = this.db.prepare(`
      SELECT * FROM reviews
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = dataQuery.all(...params, pageSize, offset) as unknown as ReviewRow[];

    return {
      data: rows.map(rowToReview),
      total,
    };
  }

  create(review: Omit<Review, 'createdAt' | 'updatedAt'>): Review {
    const now = new Date().toISOString();

    this.stmtInsert.run(
      review.id,
      review.title,
      review.description,
      review.repositoryPath,
      review.baseRef,
      review.snapshotData,
      review.status,
      now,
      now
    );

    return this.findById(review.id)!;
  }

  update(id: string, updates: {
    title?: string;
    description?: string | null;
    status?: ReviewStatus;
  }): Review | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    this.stmtUpdateMeta.run(
      updates.title ?? null,
      updates.description ?? null,
      updates.status ?? null,
      now,
      id
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }

  countByStatus(status: ReviewStatus): number {
    const result = this.stmtCountByStatus.get(status) as { count: number };
    return result.count;
  }

  countByRepository(repositoryPath: string): number {
    const result = this.stmtCountByRepo.get(repositoryPath) as { count: number };
    return result.count;
  }

  countAll(): number {
    const result = this.stmtCountAll.get() as { count: number };
    return result.count;
  }
}
