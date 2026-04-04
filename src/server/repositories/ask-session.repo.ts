/**
 * Ask session repository - data access layer for assistant↔human handoff sessions
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite'
import type { AskSession, AskStatus } from '../../shared/types.ts'

interface AskSessionRow {
  id: string;
  repository_path: string;
  review_id: string | null;
  message: string;
  status: string;
  assistant_context: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAskSession (row: AskSessionRow): AskSession {
  return {
    id: row.id,
    repositoryPath: row.repository_path,
    reviewId: row.review_id,
    message: row.message,
    status: row.status as AskStatus,
    assistantContext: row.assistant_context,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AskSessionRepository {
  private stmtFindById: StatementSync
  private stmtFindLatestByReview: StatementSync
  private stmtInsert: StatementSync
  private stmtUpdate: StatementSync

  constructor (db: DatabaseSync) {
    this.stmtFindById = db.prepare(`
      SELECT * FROM ask_sessions WHERE id = ?
    `)

    this.stmtFindLatestByReview = db.prepare(`
      SELECT * FROM ask_sessions
      WHERE review_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)

    this.stmtInsert = db.prepare(`
      INSERT INTO ask_sessions (
        id, repository_path, review_id, message, status, assistant_context, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.stmtUpdate = db.prepare(`
      UPDATE ask_sessions
      SET status = COALESCE(?, status),
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `)
  }

  findById (id: string): AskSession | null {
    const row = this.stmtFindById.get(id) as AskSessionRow | undefined
    return row ? rowToAskSession(row) : null
  }

  findLatestByReview (reviewId: string): AskSession | null {
    const row = this.stmtFindLatestByReview.get(reviewId) as AskSessionRow | undefined
    return row ? rowToAskSession(row) : null
  }

  create (ask: Omit<AskSession, 'createdAt' | 'updatedAt'>): AskSession {
    const now = new Date().toISOString()

    this.stmtInsert.run(
      ask.id,
      ask.repositoryPath,
      ask.reviewId,
      ask.message,
      ask.status,
      ask.assistantContext,
      ask.completedAt,
      now,
      now
    )

    return this.findById(ask.id)!
  }

  update (id: string, updates: { status?: AskStatus; completedAt?: string | null }): AskSession | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }

    const now = new Date().toISOString()
    const completedAt = updates.completedAt === undefined ? existing.completedAt : updates.completedAt

    this.stmtUpdate.run(
      updates.status ?? null,
      completedAt,
      now,
      id
    )

    return this.findById(id)
  }
}
