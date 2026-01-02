/**
 * Database migrations using PRAGMA user_version
 */
import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_reviews_table',
    up: `
      CREATE TABLE reviews (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        repository_path TEXT NOT NULL,
        base_ref TEXT,
        snapshot_data TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      ) STRICT;

      CREATE INDEX idx_reviews_status ON reviews(status);
      CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
    `,
  },
  {
    version: 2,
    name: 'create_comments_table',
    up: `
      CREATE TABLE comments (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER,
        line_type TEXT,
        content TEXT NOT NULL,
        suggestion TEXT,
        resolved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX idx_comments_review ON comments(review_id);
      CREATE INDEX idx_comments_file ON comments(review_id, file_path);
    `,
  },
  {
    version: 3,
    name: 'streamline_reviews_schema',
    up: `
      -- SQLite doesn't support DROP COLUMN, so recreate the table
      -- Remove title and description, add source_type and source_ref

      CREATE TABLE reviews_new (
        id TEXT PRIMARY KEY,
        repository_path TEXT NOT NULL,
        base_ref TEXT,
        source_type TEXT DEFAULT 'staged',
        source_ref TEXT,
        snapshot_data TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      ) STRICT;

      -- Copy existing data (title and description are dropped)
      INSERT INTO reviews_new (id, repository_path, base_ref, source_type, source_ref, snapshot_data, status, created_at, updated_at)
      SELECT id, repository_path, base_ref, 'staged', NULL, snapshot_data, status, created_at, updated_at
      FROM reviews;

      -- Drop old table and rename new one
      DROP TABLE reviews;
      ALTER TABLE reviews_new RENAME TO reviews;

      -- Recreate indexes
      CREATE INDEX idx_reviews_status ON reviews(status);
      CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
      CREATE INDEX idx_reviews_source_type ON reviews(source_type);
    `,
  },
  {
    version: 4,
    name: 'create_todos_table',
    up: `
      CREATE TABLE todos (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        review_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX idx_todos_review ON todos(review_id);
      CREATE INDEX idx_todos_completed ON todos(completed);
    `,
  },
  {
    version: 5,
    name: 'add_todo_position',
    up: `
      ALTER TABLE todos ADD COLUMN position INTEGER DEFAULT 0;
      CREATE INDEX idx_todos_position ON todos(position);

      -- Initialize positions based on creation order
      UPDATE todos SET position = (
        SELECT COUNT(*) FROM todos t2
        WHERE t2.created_at <= todos.created_at AND t2.id != todos.id
      );
    `,
  },
];

function getCurrentVersion(db: DatabaseSync): number {
  const stmt = db.prepare('PRAGMA user_version');
  const result = stmt.get() as { user_version: number };
  return result.user_version;
}

function setVersion(db: DatabaseSync, version: number): void {
  db.exec(`PRAGMA user_version = ${version}`);
}

export function migrate(db: DatabaseSync, migrations: Migration[]): void {
  const currentVersion = getCurrentVersion(db);

  // Sort migrations by version
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  // Find pending migrations
  const pending = sorted.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return;
  }

  for (const migration of pending) {
    db.exec('BEGIN TRANSACTION');
    try {
      db.exec(migration.up);
      setVersion(db, migration.version);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${err}`
      );
    }
  }
}
