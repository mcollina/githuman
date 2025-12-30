import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { migrate, migrations } from '../../../src/server/db/migrations.ts';

describe('migrations', () => {
  let db: DatabaseSync;

  before(() => {
    db = new DatabaseSync(':memory:', {
      enableForeignKeyConstraints: true,
    });
  });

  after(() => {
    db.close();
  });

  it('should start with version 0', () => {
    const stmt = db.prepare('PRAGMA user_version');
    const result = stmt.get() as { user_version: number };
    assert.strictEqual(result.user_version, 0);
  });

  it('should apply all migrations', () => {
    migrate(db, migrations);

    const stmt = db.prepare('PRAGMA user_version');
    const result = stmt.get() as { user_version: number };
    assert.strictEqual(result.user_version, migrations.length);
  });

  it('should create reviews table', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'"
      )
      .all();
    assert.strictEqual(tables.length, 1);
  });

  it('should create comments table', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='comments'"
      )
      .all();
    assert.strictEqual(tables.length, 1);
  });

  it('should have correct reviews columns', () => {
    const columns = db.prepare('PRAGMA table_info(reviews)').all() as Array<{
      name: string;
    }>;
    const columnNames = columns.map((c) => c.name);

    assert.ok(columnNames.includes('id'));
    assert.ok(columnNames.includes('title'));
    assert.ok(columnNames.includes('description'));
    assert.ok(columnNames.includes('repository_path'));
    assert.ok(columnNames.includes('base_ref'));
    assert.ok(columnNames.includes('snapshot_data'));
    assert.ok(columnNames.includes('status'));
    assert.ok(columnNames.includes('created_at'));
    assert.ok(columnNames.includes('updated_at'));
  });

  it('should have correct comments columns', () => {
    const columns = db.prepare('PRAGMA table_info(comments)').all() as Array<{
      name: string;
    }>;
    const columnNames = columns.map((c) => c.name);

    assert.ok(columnNames.includes('id'));
    assert.ok(columnNames.includes('review_id'));
    assert.ok(columnNames.includes('file_path'));
    assert.ok(columnNames.includes('line_number'));
    assert.ok(columnNames.includes('line_type'));
    assert.ok(columnNames.includes('content'));
    assert.ok(columnNames.includes('suggestion'));
    assert.ok(columnNames.includes('resolved'));
    assert.ok(columnNames.includes('created_at'));
    assert.ok(columnNames.includes('updated_at'));
  });

  it('should be idempotent (running twice has no effect)', () => {
    const versionBefore = (
      db.prepare('PRAGMA user_version').get() as { user_version: number }
    ).user_version;

    migrate(db, migrations);

    const versionAfter = (
      db.prepare('PRAGMA user_version').get() as { user_version: number }
    ).user_version;

    assert.strictEqual(versionBefore, versionAfter);
  });

  it('should enforce foreign key constraints', () => {
    assert.throws(() => {
      db.prepare(
        "INSERT INTO comments (id, review_id, file_path, content) VALUES ('c1', 'nonexistent', 'test.ts', 'comment')"
      ).run();
    }, /FOREIGN KEY constraint failed/);
  });

  it('should cascade delete comments when review is deleted', () => {
    // Insert a review
    db.prepare(
      "INSERT INTO reviews (id, title, repository_path, snapshot_data) VALUES ('r1', 'Test', '/path', '{}')"
    ).run();

    // Insert a comment
    db.prepare(
      "INSERT INTO comments (id, review_id, file_path, content) VALUES ('c1', 'r1', 'test.ts', 'comment')"
    ).run();

    // Verify comment exists
    const commentsBefore = db
      .prepare("SELECT * FROM comments WHERE review_id = 'r1'")
      .all();
    assert.strictEqual(commentsBefore.length, 1);

    // Delete review
    db.prepare("DELETE FROM reviews WHERE id = 'r1'").run();

    // Verify comment is deleted
    const commentsAfter = db
      .prepare("SELECT * FROM comments WHERE review_id = 'r1'")
      .all();
    assert.strictEqual(commentsAfter.length, 0);
  });
});
