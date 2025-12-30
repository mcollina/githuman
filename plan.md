# Local Code Review CLI - Implementation Plan

A local CLI tool that starts a server offering a web interface to review staged code changes, similar to GitHub PR review but fully local. Optimized for agent-assisted code review workflows.

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Runtime | Node.js 24+ | Native TypeScript (--experimental-strip-types), stable node:sqlite |
| Language | TypeScript 5.x | Type safety, better maintainability |
| Backend | Fastify 5.x | Fast, schema-based validation, OpenAPI support |
| Database | SQLite (node:sqlite) | Zero deps, native Node.js, synchronous API |
| Frontend | React 18 + Vite | Modern tooling, fast HMR, easy embedding |
| Styling | Tailwind CSS | Utility-first, minimal CSS maintenance |
| Diff Engine | diff2html + diff | Battle-tested diff visualization |
| Syntax Highlighting | Shiki | VSCode-quality highlighting, many themes |
| CLI | Commander.js | Mature, well-documented CLI framework |
| Server Testing | node:test | Zero deps, native Node.js, fast |
| Frontend Testing | Vitest + Testing Library | Fast, Vite-integrated, excellent DX |
| E2E Testing | Playwright | Cross-browser, reliable, great debugging |
| API Docs | @fastify/swagger | Auto-generated OpenAPI from schemas |

---

## Project Structure

```
local-code-reviewer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
├── index.html                    # Vite entry point
├── src/
│   ├── cli/                      # CLI entry points
│   │   ├── index.ts              # Main CLI entry
│   │   ├── commands/
│   │   │   ├── serve.ts          # Start server command
│   │   │   ├── list.ts           # List reviews command
│   │   │   └── export.ts         # Export review command
│   │   └── utils/
│   │       └── open-browser.ts
│   │
│   ├── server/                   # Fastify backend
│   │   ├── index.ts              # Server entry & plugin registration
│   │   ├── app.ts                # Fastify app factory
│   │   ├── config.ts             # Server configuration
│   │   ├── plugins/
│   │   │   ├── static.ts         # Serve embedded SPA
│   │   │   ├── cors.ts           # CORS for development
│   │   │   ├── auth.ts           # Optional token authentication
│   │   │   └── swagger.ts        # OpenAPI documentation
│   │   ├── routes/
│   │   │   ├── reviews.ts        # Review CRUD endpoints
│   │   │   ├── comments.ts       # Comment endpoints
│   │   │   ├── diff.ts           # Diff generation endpoints
│   │   │   └── export.ts         # Export endpoints
│   │   ├── services/
│   │   │   ├── git.service.ts    # Git operations
│   │   │   ├── diff.service.ts   # Diff parsing & formatting
│   │   │   ├── review.service.ts # Review business logic
│   │   │   ├── comment.service.ts
│   │   │   └── export.service.ts # Markdown export
│   │   ├── repositories/
│   │   │   ├── review.repo.ts    # Review data access
│   │   │   └── comment.repo.ts   # Comment data access
│   │   ├── db/
│   │   │   ├── index.ts          # Database connection
│   │   │   ├── schema.ts         # Table definitions
│   │   │   └── migrations/       # Schema migrations
│   │   └── schemas/              # JSON schemas for validation
│   │       ├── review.schema.ts
│   │       └── comment.schema.ts
│   │
│   ├── web/                      # React frontend
│   │   ├── main.tsx              # React entry point
│   │   ├── App.tsx               # Root component
│   │   ├── api/
│   │   │   └── client.ts         # API client (fetch wrapper)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── diff/
│   │   │   │   ├── DiffView.tsx          # Main diff container
│   │   │   │   ├── DiffFile.tsx          # Single file diff
│   │   │   │   ├── DiffLine.tsx          # Single line with gutter
│   │   │   │   ├── LineComment.tsx       # Inline comment display
│   │   │   │   └── CommentForm.tsx       # Add/edit comment form
│   │   │   ├── review/
│   │   │   │   ├── ReviewList.tsx        # List of saved reviews
│   │   │   │   ├── ReviewHeader.tsx      # Review metadata
│   │   │   │   └── ReviewSummary.tsx     # Stats & overview
│   │   │   ├── suggestions/
│   │   │   │   ├── SuggestionBlock.tsx   # Code suggestion display
│   │   │   │   └── SuggestionEditor.tsx  # Create suggestions
│   │   │   └── ui/                       # Reusable UI components
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Badge.tsx
│   │   │       └── Spinner.tsx
│   │   ├── hooks/
│   │   │   ├── useReview.ts
│   │   │   ├── useComments.ts
│   │   │   └── useDiff.ts
│   │   ├── stores/               # State management (Zustand)
│   │   │   ├── review.store.ts
│   │   │   └── ui.store.ts
│   │   ├── types/
│   │   │   └── index.ts          # Shared TypeScript types
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── shared/                   # Shared between server & web
│       └── types.ts              # API types, DTOs
│
├── scripts/
│   └── build.ts                  # Build script for embedding SPA
│
├── tests/
│   ├── server/                   # node:test for backend
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes/
│   ├── web/                      # Vitest for React components
│   │   └── components/
│   ├── e2e/                      # Playwright E2E tests
│   │   ├── review.spec.ts        # Review creation flow
│   │   ├── comments.spec.ts      # Commenting flow
│   │   └── export.spec.ts        # Export functionality
│   └── fixtures/
│       └── sample-diffs/
│
├── playwright.config.ts          # Playwright configuration
│
└── dist/                         # Build output
    ├── cli/                      # Compiled CLI
    ├── server/                   # Compiled server
    └── web/                      # Bundled SPA assets
```

---

## Database Schema

```sql
-- Reviews table: snapshots of staged changes
CREATE TABLE reviews (
    id TEXT PRIMARY KEY,                    -- UUID
    title TEXT NOT NULL,
    description TEXT,
    repository_path TEXT NOT NULL,          -- Absolute path to repo
    base_ref TEXT,                          -- Git ref (HEAD, commit SHA)
    snapshot_data TEXT NOT NULL,            -- JSON: serialized diff data
    status TEXT DEFAULT 'in_progress',      -- in_progress | approved | changes_requested
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Comments table: line and file-level comments
CREATE TABLE comments (
    id TEXT PRIMARY KEY,                    -- UUID
    review_id TEXT NOT NULL,
    file_path TEXT NOT NULL,                -- Relative path in repo
    line_number INTEGER,                    -- NULL for file-level comments
    line_type TEXT,                         -- 'added' | 'removed' | 'context'
    content TEXT NOT NULL,                  -- Markdown content
    suggestion TEXT,                        -- Optional code suggestion
    resolved INTEGER DEFAULT 0,             -- Boolean: 0 or 1
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_comments_review ON comments(review_id);
CREATE INDEX idx_comments_file ON comments(review_id, file_path);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
```

---

## API Endpoints

### Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reviews` | List all reviews (paginated) |
| `POST` | `/api/reviews` | Create review from staged changes |
| `GET` | `/api/reviews/:id` | Get review with full diff data |
| `PATCH` | `/api/reviews/:id` | Update review (title, status, description) |
| `DELETE` | `/api/reviews/:id` | Delete review and all comments |
| `GET` | `/api/reviews/:id/export` | Export review as markdown |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reviews/:id/comments` | List comments for review |
| `POST` | `/api/reviews/:id/comments` | Add comment to review |
| `PATCH` | `/api/comments/:id` | Update comment content |
| `DELETE` | `/api/comments/:id` | Delete comment |
| `POST` | `/api/comments/:id/resolve` | Mark comment as resolved |
| `POST` | `/api/comments/:id/unresolve` | Mark comment as unresolved |

### Diff

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/diff/staged` | Get current staged changes |
| `GET` | `/api/diff/files` | List files with staged changes |

### Health & Meta

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/info` | Repository info (name, branch, etc.) |

---

## CLI Commands

### `code-review serve`

Start the review server and open web interface.

```bash
code-review serve [options]

Options:
  -p, --port <number>    Port to run server on (default: 3847)
  --no-open              Don't auto-open browser
  -h, --host <string>    Host to bind to (default: localhost)
  --auth <token>         Enable token authentication (optional)
```

When `--auth` is provided:
- All API endpoints require `Authorization: Bearer <token>` header
- Web interface prompts for token on first visit (stored in localStorage)
- Token can also be set via `CODE_REVIEW_TOKEN` environment variable

### `code-review list`

List all saved reviews for the current repository.

```bash
code-review list [options]

Options:
  --status <status>      Filter by status (in_progress|approved|changes_requested)
  --json                 Output as JSON
```

### `code-review export`

Export a review to markdown.

```bash
code-review export <review-id> [options]

Options:
  -o, --output <file>    Output file path (default: stdout)
```

---

## Implementation Phases

### Phase 1: Foundation

**Goal**: Basic CLI + server + database setup

1. Initialize project with TypeScript configuration
   - Configure `tsconfig.json` for Node.js 20+ with ES modules
   - Set up path aliases (`@/server`, `@/web`, `@/shared`)

2. Set up Fastify server skeleton
   - Create app factory with plugin registration
   - Add health check endpoint
   - Configure CORS for development

3. Implement SQLite database layer
   - Set up node:sqlite connection (DatabaseSync)
   - Create version-based migration system using PRAGMA user_version
   - Implement repository pattern for data access

4. Build CLI with Commander.js
   - Implement `serve` command with port/host options
   - Add browser auto-open functionality
   - Implement `list` command (basic)

### Phase 2: Git Integration & Diff Engine

**Goal**: Parse staged changes and generate diffs

1. Implement Git service
   - Detect repository root
   - Get staged files list
   - Generate unified diff for staged changes
   - Parse repository metadata (name, branch, remote)

2. Build diff parsing service
   - Parse unified diff format
   - Extract file-level metadata (additions, deletions, renames)
   - Structure diff data for frontend consumption

3. Create diff API endpoints
   - `/api/diff/staged` - returns parsed diff data
   - `/api/diff/files` - returns file list with stats

### Phase 3: Review Management

**Goal**: Create, save, and manage reviews

1. Implement review service
   - Create review from current staged changes
   - Snapshot diff data (JSON serialization)
   - Update review metadata and status

2. Build review API endpoints
   - Full CRUD operations
   - Pagination for list endpoint
   - Status filtering

3. Add review validation schemas
   - Fastify JSON schema validation
   - OpenAPI documentation generation

### Phase 4: React Frontend - Core

**Goal**: Basic diff viewing interface

1. Set up Vite + React project
   - Configure Vite for library mode (embedding)
   - Set up Tailwind CSS
   - Create build pipeline for SPA embedding

2. Build layout components
   - Header with navigation
   - Sidebar with file tree
   - Responsive layout

3. Implement diff visualization
   - Integrate diff2html for rendering
   - Configure Shiki for syntax highlighting
   - Side-by-side and unified view modes

4. Create API client
   - Typed fetch wrapper
   - Error handling
   - Loading states

### Phase 5: Comments & Suggestions

**Goal**: Full commenting functionality

1. Implement comment service
   - CRUD operations
   - Resolve/unresolve functionality
   - Code suggestion storage

2. Build comment API endpoints
   - All CRUD endpoints
   - Batch operations support

3. Create comment UI components
   - Inline comment display
   - Comment form with markdown support
   - Code suggestion blocks
   - Thread-style comment display

4. Add suggestion editor
   - Monaco editor integration for code suggestions
   - Diff preview for suggestions

### Phase 6: Export & Polish

**Goal**: Export functionality and UX improvements

1. Implement markdown export service
   - Generate structured markdown report
   - Include diff snippets with comments
   - Summary statistics

2. Build export CLI command
   - File output option
   - Stdout support for piping

3. Add UI polish
   - Keyboard shortcuts (j/k navigation, c for comment)
   - File search/filter
   - Comment count badges
   - Status indicators

### Phase 7: Testing & Documentation

**Goal**: Comprehensive test coverage

1. Server tests (node:test)
   - Service layer unit tests
   - Repository tests with in-memory SQLite
   - Route/API integration tests using Fastify's inject()
   - Git operations with fixture repos

2. Frontend tests (Vitest)
   - React component tests with Testing Library
   - Hook tests
   - Store tests

3. E2E tests (Playwright)
   - Full review creation workflow
   - Adding comments to diff lines
   - Resolving/unresolving comments
   - Export functionality
   - Navigation and keyboard shortcuts
   - Cross-browser testing (Chromium, Firefox, WebKit)

4. Documentation
   - README with usage examples
   - API documentation (auto-generated OpenAPI)
   - Contributing guide

---

## Key Technical Decisions

### 1. Snapshot-based Reviews

Reviews store a complete snapshot of the diff at creation time. This ensures:
- Reviews remain viewable even after changes are committed
- Historical record of what was reviewed
- No dependency on current git state after creation

### 2. Embedded SPA Strategy

The React frontend is bundled and embedded into the CLI package:
- Single `npm install` for everything
- No separate frontend server in production
- Vite builds to `dist/web/`, served by Fastify's static plugin
- Development mode proxies API requests to backend

### 3. Code Suggestions Format

Suggestions are stored as markdown code blocks with metadata:
```markdown
```suggestion
const result = items.filter(Boolean);
```
```

This allows:
- Easy rendering in the UI
- Clean markdown export
- Potential future "apply suggestion" functionality

### 4. Database Location

SQLite database is stored at:
- `<repository-root>/.code-review/reviews.db`
- Gitignored by default
- Portable with the repository if desired

### 5. Migration System

Version-based migrations using SQLite's `PRAGMA user_version`:

```typescript
interface Migration {
  version: number;
  name: string;
  up: string;  // SQL to apply
}

function migrate(db: DatabaseSync, migrations: Migration[]): void {
  const currentVersion = getCurrentVersion(db);  // PRAGMA user_version
  const pending = migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.exec('BEGIN TRANSACTION');
    try {
      db.exec(migration.up);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
```

Benefits:
- No external migration tool needed
- Atomic migrations with transaction rollback
- Version tracked in database itself
- Simple, auditable migration files

### 6. Optional Token Authentication

When `--auth <token>` flag is provided:

```typescript
// Server-side: Fastify preHandler hook
fastify.addHook('preHandler', async (request, reply) => {
  if (!config.authToken) return;  // Auth disabled

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  if (token !== config.authToken) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
});
```

Client-side flow:
1. Check `/api/health` for auth requirement
2. If 401, prompt for token input
3. Store token in localStorage
4. Include `Authorization: Bearer <token>` in all requests

---

## Dependencies

### Runtime Dependencies

```json
{
  "fastify": "^5.0.0",
  "@fastify/static": "^8.0.0",
  "@fastify/cors": "^10.0.0",
  "@fastify/swagger": "^9.0.0",
  "@fastify/swagger-ui": "^5.0.0",
  "commander": "^12.0.0",
  "open": "^10.0.0",
  "simple-git": "^3.25.0",
  "diff": "^5.2.0",
  "diff2html": "^3.4.0",
  "shiki": "^1.0.0",
  "uuid": "^10.0.0",
  "zod": "^3.23.0"
}
```

### Frontend Dependencies

```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.26.0",
  "zustand": "^5.0.0",
  "@tanstack/react-query": "^5.50.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.4.0"
}
```

### Development Dependencies

```json
{
  "typescript": "^5.6.0",
  "vite": "^6.0.0",
  "@vitejs/plugin-react": "^4.3.0",
  "vitest": "^2.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/user-event": "^14.5.0",
  "jsdom": "^25.0.0",
  "@playwright/test": "^1.49.0",
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "@types/node": "^22.0.0",
  "@types/react": "^18.3.0",
  "@types/diff": "^5.2.0"
}
```

### NPM Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "node --experimental-strip-types --watch src/cli/index.ts serve",
    "build": "vite build && tsc -p tsconfig.server.json",
    "test": "npm run test:server && npm run test:web",
    "test:server": "node --experimental-strip-types --test tests/server/**/*.test.ts",
    "test:web": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:e2e",
    "lint": "eslint src tests"
  }
}
```

---

## Configuration Files

### tsconfig.json (highlights)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@/server/*": ["./src/server/*"],
      "@/web/*": ["./src/web/*"],
      "@/shared/*": ["./src/shared/*"]
    }
  }
}
```

### vite.config.ts (highlights)

```typescript
export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist/web',
    emptyDirOnly: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847'
    }
  }
});
```

### playwright.config.ts (highlights)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3847',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev:server',
    url: 'http://localhost:3847',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Success Criteria

1. **Functional**: Can create reviews, add comments, and export to markdown
2. **Fast**: Server starts in < 500ms, UI renders diff in < 100ms for typical files
3. **Reliable**: No data loss, graceful error handling
4. **Maintainable**: Clear separation of concerns, comprehensive types, good test coverage
5. **Portable**: Single npm package, works on macOS/Linux/Windows

---

## Future Considerations (Out of Scope for MVP)

- Branch-to-branch comparison mode
- Commit range comparison
- AI-assisted review suggestions
- Team collaboration (multi-user)
- GitHub/GitLab integration for pushing reviews
- VS Code extension
- Apply suggestions directly to files
- Review templates
- Webhooks for CI integration
