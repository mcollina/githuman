<p align="center">
  <img src="public/logo.svg" alt="GitHuman Logo" width="120" height="120">
</p>

# GitHuman

**Review AI agent code changes before commit.**

GitHub revolutionized how humans collaborate on code.

GitHuman defines how humans review code written by AI.

## The Problem

AI coding agents write code. But the traditional PR workflow assumes humans are the authors. By the time AI-generated code reaches a pull request, you've already committed to the approach. Review happens too late.

## The Solution

GitHuman moves the review checkpoint to where it belongs: **the staging area**.

Before `git commit`, you get a proper review interface—not a wall of terminal diff output. Add comments, track issues, and make informed decisions about what the AI produced.

## Screenshots

### Reviews List
![Reviews List](docs/screenshots/home.png)

### Staged Changes
![Staged Changes](docs/screenshots/staged-changes.png)

## Features

- **Visual diff review** - Review staged changes in a clean, GitHub-like interface
- **Human handoff for agents** - Run `githuman ask` to ask a human for review, wait, and hand their feedback back to the agent
- **Inline comments** - Add comments to specific lines with code suggestions
- **Review workflow** - Track status: in progress, approved, or changes requested
- **Todo tracking** - Create tasks for follow-up work via CLI or web interface
- **Markdown export** - Export reviews with comments for documentation
- **Keyboard shortcuts** - Navigate quickly with vim-style bindings
- **Local & private** - Everything runs on your machine, no data leaves

## Requirements

- Node.js 24.0.0 or higher

## Installation

```bash
npm install -g githuman
```

Or run directly:

```bash
npx githuman@latest serve
```

## Quick Start

### Review staged changes before commit

```bash
# Stage your changes (from AI agent or manual edits)
git add .

# Start the review interface
githuman serve
```

This opens a web interface at `http://localhost:3847` where you can review your staged changes before committing.

### Ask a human to review and wait for feedback

```bash
githuman ask "Please review the parser refactor"
```

`githuman ask` starts or reuses GitHuman, prints the review URL, optionally opens the browser, waits for the human to mark the request todo as done, and then prints the new todos, comments, and review status updates for the agent.

In v1, the completion signal is simple and explicit: the human finishes their turn by marking the ask todo as done in the UI.

## Agent Skills

GitHuman provides an agent skill that teaches AI coding agents when and how to use GitHuman for reviewing changes.

Install it with the [skills](https://skills.sh/) CLI:

```bash
npx skills add mcollina/githuman-skills
```

## CLI Reference

### Start Review Server

```bash
githuman serve [options]

Options:
  -p, --port <port>    Port to listen on (default: 3847)
  --host <host>        Host to bind to (default: localhost)
  --open               Auto-open browser
  --no-open            Don't open browser automatically
  --https              Enable HTTPS
  --no-https           Disable HTTPS
  --cert <path>        Use a custom TLS certificate
  --key <path>         Use a custom TLS private key
  --auth [token]       Enable auth, optionally with a provided token
  -v, --verbose        Enable verbose logging
  -h, --help           Show help
```

### Ask a Human to Review

```bash
githuman ask [message] [options]

Options:
  -p, --port <port>    Port to use for GitHuman
  --host <host>        Host to bind to when starting GitHuman
  --open               Open the browser automatically
  --no-open            Don't open the browser automatically
  --review <id>        Scope feedback to a specific review
  --interval <ms>      Polling interval in milliseconds
  --json               Output final feedback as JSON
  -h, --help           Show help
```

### List Reviews

```bash
githuman list [options]

Options:
  --status <status>    Filter by status (in_progress|approved|changes_requested)
  --json               Output as JSON
  -h, --help           Show help
```

### Export Review

```bash
githuman export <review-id|last> [options]

Arguments:
  review-id            The ID of the review, or "last" for most recent

Options:
  -o, --output <file>  Output file path (default: stdout)
  --no-resolved        Exclude resolved comments
  --no-snippets        Exclude diff snippets
  -h, --help           Show help
```

### Manage Todos

```bash
githuman todo <subcommand> [options]

Subcommands:
  add <content>     Add a new todo item
  list              List all todos (pending by default)
  done <id>         Mark todo as completed
  undone <id>       Mark todo as not completed
  remove <id>       Delete a todo
  clear --done      Remove all completed todos

Options:
  --review <id>     Scope todo to a specific review
  --all             Show all todos (not just pending)
  --done            Filter to show only completed todos
  --json            Output as JSON
  -h, --help        Show help
```

## Workflow

### Staging-area review

1. **AI agent makes changes** - Claude, Copilot, Cursor, or any tool stages code
2. **Run `githuman serve`** - Opens the review interface
3. **Review the diff** - See exactly what changed, file by file
4. **Add comments** - Note issues, questions, or suggestions
5. **Create todos** - Track follow-up work
6. **Decide** - Approve and commit, or request changes from the agent
7. **Export** - Optionally save the review as documentation

### Human-in-the-loop agent handoff

1. **The agent runs `githuman ask`**
2. **GitHuman starts or reconnects** and prints the review URL
3. **The human reviews in the browser** and leaves comments or todos
4. **The human marks the ask todo as done** when feedback is ready
5. **`githuman ask` exits with the new feedback** so the agent can continue

## Web Interface

### Creating a Review

1. Stage your changes with `git add`
2. Run `githuman serve`
3. Click "New Review" or navigate to Staged Changes
4. Click "Create Review"

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

## API

The server exposes a REST API with OpenAPI documentation at `/docs`.

### Authentication

Set a token to require authentication:

```bash
# Via CLI flag
githuman serve --auth mysecrettoken-that-is-at-least-32-characters

# Auto-generate a token
githuman serve --auth

# Via environment variable
GITHUMAN_TOKEN=mysecrettoken-that-is-at-least-32-characters githuman serve
```

Clients must include the token in the `Authorization` header:

```
Authorization: Bearer mysecrettoken-that-is-at-least-32-characters
```

## Configuration

GitHuman can read repo-local defaults from `.githuman/config.json`.

```json
{
  "host": "localhost",
  "port": 3847,
  "https": false,
  "open": true
}
```

Config precedence is:

1. CLI flags
2. `.githuman/config.json`
3. built-in defaults

## Data Storage

GitHuman stores local data in:

```
<repository>/.githuman/
```

Important files include:

- `reviews.db` - reviews, comments, and todos
- `config.json` - optional repo-local CLI defaults

This directory is typically gitignored.

## Development

```bash
# Clone the repository
git clone https://github.com/mcollina/local-code-reviewer.git
cd local-code-reviewer

# Install dependencies
npm install

# Run server in watch mode
npm run dev:server

# Run web dev server (Vite)
npm run dev

# Run all tests
npm test
```

## Tech Stack

- **Backend**: Fastify, Node.js native SQLite
- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Testing**: Node.js test runner, Vitest, Playwright

## Why "GitHuman"?

In the age of AI coding assistants, someone needs to review the code before it's committed. That someone is you. GitHuman is the human checkpoint in an AI-assisted workflow.

## License

MIT License for the code.

The GitHuman logo is Copyright (c) Matteo Collina, All Rights Reserved.
