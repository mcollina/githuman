# Local Code Reviewer

A local CLI tool for reviewing staged git changes with a web interface. Review your code before committing, add comments and suggestions, and export reviews to markdown.

## Features

- **Web-based diff viewer** - Review staged changes in a clean, GitHub-like interface
- **Inline comments** - Add comments to specific lines with code suggestions
- **Review management** - Save reviews, track status (in progress, approved, changes requested)
- **Markdown export** - Export reviews with comments to markdown files
- **Keyboard shortcuts** - Navigate quickly with vim-style shortcuts
- **Local & private** - Everything runs locally, no data leaves your machine

## Requirements

- Node.js 24.0.0 or higher

## Installation

```bash
# Clone the repository
git clone https://github.com/mcollina/local-code-reviewer.git
cd local-code-reviewer

# Install dependencies
npm install

# Build the web interface
npm run build

# Link the CLI globally (optional)
npm link
```

## Usage

### Start the Review Server

```bash
# From the project directory
npm start

# Or if globally linked
code-review serve
```

This opens a web interface at `http://localhost:3847` showing your staged changes.

#### Options

```
code-review serve [options]

Options:
  -p, --port <port>    Port to listen on (default: 3847)
  --host <host>        Host to bind to (default: localhost)
  --no-open            Don't open browser automatically
  --token <token>      Require authentication token
  -h, --help           Show help
```

### List Reviews

```bash
code-review list [options]

Options:
  --status <status>    Filter by status (in_progress|approved|changes_requested)
  --json               Output as JSON
  -h, --help           Show help
```

### Export a Review

```bash
code-review export <review-id|last> [options]

Arguments:
  review-id            The ID of the review, or "last" for most recent

Options:
  -o, --output <file>  Output file path (default: stdout)
  --no-resolved        Exclude resolved comments
  --no-snippets        Exclude diff snippets
  -h, --help           Show help
```

Examples:

```bash
# Export the last review to stdout
code-review export last

# Export to a file
code-review export last -o review.md

# Export without resolved comments
code-review export last --no-resolved
```

## Web Interface

### Creating a Review

1. Stage your changes with `git add`
2. Run `code-review serve`
3. Click "New Review" or navigate to Staged Changes
4. Enter a title and optional description
5. Click "Create Review"

### Adding Comments

1. Hover over any line in the diff
2. Click the `+` button that appears
3. Write your comment
4. Optionally add a code suggestion
5. Click "Add Comment"

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Next file |
| `k` | Previous file |
| `Esc` | Cancel / Close |

### Review Status

- **In Progress** - Review is ongoing
- **Approved** - Changes look good
- **Changes Requested** - Modifications needed

## API

The server exposes a REST API at `/api`:

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/info` | Repository information |
| GET | `/api/diff/staged` | Get staged diff |
| GET | `/api/reviews` | List reviews |
| POST | `/api/reviews` | Create review |
| GET | `/api/reviews/:id` | Get review |
| PATCH | `/api/reviews/:id` | Update review |
| DELETE | `/api/reviews/:id` | Delete review |
| GET | `/api/reviews/:id/export` | Export as markdown |
| GET | `/api/reviews/:id/comments` | List comments |
| POST | `/api/reviews/:id/comments` | Add comment |
| PATCH | `/api/comments/:id` | Update comment |
| DELETE | `/api/comments/:id` | Delete comment |
| POST | `/api/comments/:id/resolve` | Resolve comment |
| POST | `/api/comments/:id/unresolve` | Unresolve comment |

### Authentication

Set a token to require authentication:

```bash
# Via CLI flag
code-review serve --token mysecrettoken

# Via environment variable
CODE_REVIEW_TOKEN=mysecrettoken code-review serve
```

Clients must include the token in the `Authorization` header:

```
Authorization: Bearer mysecrettoken
```

## Development

```bash
# Run server in watch mode
npm run dev:server

# Run web dev server (Vite)
npm run dev

# Run all tests
npm test

# Run specific test suites
npm run test:server    # Server/API tests
npm run test:web       # Frontend component tests
npm run test:e2e       # End-to-end tests

# Type checking
npm run typecheck      # Both server and web
npm run typecheck:server
npm run typecheck:web
```

## Data Storage

Reviews and comments are stored in a SQLite database at:

```
<repository>/.code-review/reviews.db
```

This file is typically gitignored.

## Tech Stack

- **Backend**: Fastify, Node.js native SQLite
- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Testing**: Node.js test runner, Vitest, Playwright

## License

MIT
