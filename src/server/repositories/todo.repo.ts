/**
 * Todo repository - data access layer for todos
 */
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Todo } from '../../shared/types.ts';

interface TodoRow {
  id: string;
  content: string;
  completed: number;
  review_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    content: row.content,
    completed: row.completed === 1,
    reviewId: row.review_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TodoRepository {
  private db: DatabaseSync;
  private stmtFindById: StatementSync;
  private stmtFindAll: StatementSync;
  private stmtFindByReview: StatementSync;
  private stmtFindByCompleted: StatementSync;
  private stmtFindByReviewAndCompleted: StatementSync;
  private stmtInsert: StatementSync;
  private stmtUpdate: StatementSync;
  private stmtToggle: StatementSync;
  private stmtDelete: StatementSync;
  private stmtDeleteCompleted: StatementSync;
  private stmtDeleteByReview: StatementSync;
  private stmtCountAll: StatementSync;
  private stmtCountCompleted: StatementSync;
  private stmtCountPending: StatementSync;
  private stmtGetMaxPosition: StatementSync;
  private stmtUpdatePosition: StatementSync;

  constructor(db: DatabaseSync) {
    this.db = db;

    this.stmtFindById = db.prepare(`
      SELECT * FROM todos WHERE id = ?
    `);

    this.stmtFindAll = db.prepare(`
      SELECT * FROM todos
      ORDER BY completed ASC, position ASC
    `);

    this.stmtFindByReview = db.prepare(`
      SELECT * FROM todos
      WHERE review_id = ?
      ORDER BY completed ASC, position ASC
    `);

    this.stmtFindByCompleted = db.prepare(`
      SELECT * FROM todos
      WHERE completed = ?
      ORDER BY position ASC
    `);

    this.stmtFindByReviewAndCompleted = db.prepare(`
      SELECT * FROM todos
      WHERE review_id = ? AND completed = ?
      ORDER BY position ASC
    `);

    this.stmtInsert = db.prepare(`
      INSERT INTO todos (id, content, completed, review_id, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtUpdate = db.prepare(`
      UPDATE todos
      SET content = COALESCE(?, content),
          completed = COALESCE(?, completed),
          updated_at = ?
      WHERE id = ?
    `);

    this.stmtToggle = db.prepare(`
      UPDATE todos
      SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END,
          updated_at = ?
      WHERE id = ?
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM todos WHERE id = ?
    `);

    this.stmtDeleteCompleted = db.prepare(`
      DELETE FROM todos WHERE completed = 1
    `);

    this.stmtDeleteByReview = db.prepare(`
      DELETE FROM todos WHERE review_id = ?
    `);

    this.stmtCountAll = db.prepare(`
      SELECT COUNT(*) as count FROM todos
    `);

    this.stmtCountCompleted = db.prepare(`
      SELECT COUNT(*) as count FROM todos WHERE completed = 1
    `);

    this.stmtCountPending = db.prepare(`
      SELECT COUNT(*) as count FROM todos WHERE completed = 0
    `);

    this.stmtGetMaxPosition = db.prepare(`
      SELECT MAX(position) as max_position FROM todos
    `);

    this.stmtUpdatePosition = db.prepare(`
      UPDATE todos SET position = ?, updated_at = ? WHERE id = ?
    `);
  }

  findById(id: string): Todo | null {
    const row = this.stmtFindById.get(id) as TodoRow | undefined;
    return row ? rowToTodo(row) : null;
  }

  findAll(): Todo[] {
    const rows = this.stmtFindAll.all() as unknown as TodoRow[];
    return rows.map(rowToTodo);
  }

  findByReview(reviewId: string): Todo[] {
    const rows = this.stmtFindByReview.all(reviewId) as unknown as TodoRow[];
    return rows.map(rowToTodo);
  }

  findByCompleted(completed: boolean): Todo[] {
    const rows = this.stmtFindByCompleted.all(completed ? 1 : 0) as unknown as TodoRow[];
    return rows.map(rowToTodo);
  }

  findByReviewAndCompleted(reviewId: string, completed: boolean): Todo[] {
    const rows = this.stmtFindByReviewAndCompleted.all(reviewId, completed ? 1 : 0) as unknown as TodoRow[];
    return rows.map(rowToTodo);
  }

  create(todo: Omit<Todo, 'createdAt' | 'updatedAt' | 'position'>): Todo {
    const now = new Date().toISOString();
    const maxResult = this.stmtGetMaxPosition.get() as { max_position: number | null };
    const nextPosition = (maxResult.max_position ?? -1) + 1;

    this.stmtInsert.run(
      todo.id,
      todo.content,
      todo.completed ? 1 : 0,
      todo.reviewId,
      nextPosition,
      now,
      now
    );

    return this.findById(todo.id)!;
  }

  update(
    id: string,
    updates: { content?: string; completed?: boolean }
  ): Todo | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    this.stmtUpdate.run(
      updates.content ?? null,
      updates.completed !== undefined ? (updates.completed ? 1 : 0) : null,
      now,
      id
    );

    return this.findById(id);
  }

  toggle(id: string): Todo | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    this.stmtToggle.run(now, id);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }

  deleteCompleted(): number {
    const result = this.stmtDeleteCompleted.run();
    return Number(result.changes);
  }

  deleteByReview(reviewId: string): number {
    const result = this.stmtDeleteByReview.run(reviewId);
    return Number(result.changes);
  }

  countAll(): number {
    const result = this.stmtCountAll.get() as { count: number };
    return result.count;
  }

  countCompleted(): number {
    const result = this.stmtCountCompleted.get() as { count: number };
    return result.count;
  }

  countPending(): number {
    const result = this.stmtCountPending.get() as { count: number };
    return result.count;
  }

  /**
   * Reorder todos by updating their positions.
   * @param orderedIds - Array of todo IDs in the desired order
   * @returns The number of todos updated
   */
  reorder(orderedIds: string[]): number {
    const now = new Date().toISOString();
    let updated = 0;

    for (let i = 0; i < orderedIds.length; i++) {
      const result = this.stmtUpdatePosition.run(i, now, orderedIds[i]);
      if (result.changes > 0) {
        updated++;
      }
    }

    return updated;
  }

  /**
   * Move a single todo to a new position
   * @param id - The ID of the todo to move
   * @param newPosition - The new position (0-indexed)
   * @returns The updated todo, or null if not found
   */
  move(id: string, newPosition: number): Todo | null {
    const todo = this.findById(id);
    if (!todo) {
      return null;
    }

    const allTodos = this.findAll();
    const currentIndex = allTodos.findIndex((t) => t.id === id);
    if (currentIndex === -1) {
      return null;
    }

    // Remove from current position and insert at new position
    const reorderedIds = allTodos.map((t) => t.id);
    reorderedIds.splice(currentIndex, 1);
    reorderedIds.splice(newPosition, 0, id);

    this.reorder(reorderedIds);
    return this.findById(id);
  }
}
