# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

This project dogfoods itself: we use GitHuman to review GitHuman changes.

- **Always run tests before committing** with `npm test` - fix any failing tests before proceeding
- **Ask the user to review changes in GitHuman** before committing - staging can be done directly in the GitHuman UI
- **Tasks are tracked in GitHuman's todo feature**, not external tools - check `githuman todo list` for pending work

## Critical Warnings

**NEVER delete or lose the `.githuman/` directory.** This directory contains:
- `reviews.db` - SQLite database with all reviews, comments, and todos
- This data is NOT tracked by git and cannot be recovered if deleted

When renaming or refactoring the project:
- Always migrate the database file to the new location
- Never assume the old data directory can be recreated

## TypeScript

This project uses Node.js native TypeScript support (type stripping). **Never use tsx** - always run TypeScript files directly with `node`:

```bash
# Correct
node scripts/screenshots.ts
node src/cli/index.ts serve

# Wrong - do NOT use tsx
tsx scripts/screenshots.ts  # NO!
```

## Build and Development Commands

```bash
# Development
npm run dev              # Start Vite dev server (frontend only, uses API proxy)
npm run dev:server       # Start backend in watch mode with --no-open

# Build
npm run build            # Build both server and web
npm run build:server     # Build server only (tsc)
npm run build:web        # Build web only (vite)

# Testing
npm test                 # Run all tests (server + cli + web)
npm run test:server      # Run server tests only
npm run test:cli         # Run CLI tests only
npm run test:web         # Run web tests (vitest)
npm run test:e2e         # Run Playwright e2e tests

# Run a single test file
node --test tests/server/routes/todos.test.ts
node --test 'tests/server/**/*.test.ts'  # Pattern match

# Type checking
npm run typecheck        # Check both server and web
npm run typecheck:server # Server only
npm run typecheck:web    # Web only

# Linting
npm run lint
```

## Architecture Overview

### Three-Layer Backend

The server follows a layered architecture:

1. **Routes** (`src/server/routes/`) - HTTP endpoints with TypeBox schemas for OpenAPI validation
2. **Services** (`src/server/services/`) - Business logic, orchestrates repositories
3. **Repositories** (`src/server/repositories/`) - Direct database access using `node:sqlite` synchronous API

### Database

Uses Node.js native SQLite (`node:sqlite` - requires Node 24+):
- Synchronous API via `DatabaseSync`
- Migrations in `src/server/db/migrations.ts`
- In-memory databases for testing via `createTestDatabase()`
- Global singleton accessed via `getDatabase()` after `initDatabase()`

### Shared Types

`src/shared/types.ts` contains TypeScript interfaces shared between server and web client. These are the source of truth for data shapes.

### TypeBox Schemas

Routes define TypeBox schemas for OpenAPI documentation and runtime validation. Schemas are defined inline in route files or in `src/server/schemas/common.ts` for reuse.

### Request Context

Uses `@fastify/request-context` to pass the request logger to services:
```typescript
import { requestContext } from '../app.ts';
const log = requestContext.get('log');
```

### CLI Structure

- `src/cli/index.ts` - Entry point, command dispatcher
- `src/cli/commands/` - Individual commands (serve, list, export, todo)
- Uses `parseArgs` from `node:util` for argument parsing

### Frontend

React 19 SPA with:
- Vite for bundling
- TailwindCSS v4 for styling
- React Router for navigation
- API calls to `/api/*` endpoints

## Environment Variables

- `GITHUMAN_TOKEN` - Auth token for API access (optional)
- `GITHUMAN_DB_PATH` - Custom database path (default: `.githuman/reviews.db`)

## Testing Patterns

Server tests use Node.js test runner with in-memory SQLite:
```typescript
import { createTestDatabase } from '../../src/server/db/index.ts';
const db = createTestDatabase();
const repo = new SomeRepository(db);
```

**Important:** Always close Fastify apps in an `after()` hook, never inline:
```typescript
// Correct
after(async () => {
  await app.close()
})

// Wrong - don't close inline in tests
await app.close() // NO!
```

Web tests use Vitest with Testing Library.

## Documentation

### Screenshots

To update screenshots for the README and website, run:

```bash
node scripts/screenshots.ts
```

This captures screenshots of the home page and staged changes page to `docs/screenshots/` and copies them to `website/` for the landing page.

### Website

The `website/` folder contains the GitHub Pages landing page (`index.html`). It's a standalone static page that describes the project.
