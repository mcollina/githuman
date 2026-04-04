/**
 * Ask command - start or reuse GitHuman, wait for human review, then print feedback
 */
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import open from 'open'
import { getDatabase } from '../../server/db/index.ts'
import { TodoRepository } from '../../server/repositories/todo.repo.ts'
import { CommentRepository } from '../../server/repositories/comment.repo.ts'
import { ReviewRepository } from '../../server/repositories/review.repo.ts'
import type { Comment, Review, Todo } from '../../shared/types.ts'
import { ensureServerRunning, extractAuthArg, getAccessUrl, resolveServerRuntime, stripAuthArg } from '../server-runtime.ts'

const DEFAULT_INTERVAL_MS = 1500

interface AskResult {
  url: string;
  requestTodo: Todo;
  reviewStatus: Review['status'] | null;
  todos: Todo[];
  comments: Comment[];
}

function printHelp () {
  console.log(`
Usage: githuman ask [message] [options]

Ask a human to review, wait for them to finish, then print their feedback.

Arguments:
  message                Optional request for the human reviewer

Options:
  -p, --port <number>    Port to use for GitHuman
  --host <string>        Host to bind to when starting GitHuman
  --https                Enable HTTPS
  --no-https             Disable HTTPS
  --cert <path>          Path to TLS certificate file (PEM format)
  --key <path>           Path to TLS private key file (PEM format)
  --auth [token]         Enable auth (auto-generate token if omitted)
  --open                 Open the browser automatically
  --no-open              Don't open the browser automatically
  --review <id>          Scope feedback to a specific review
  --interval <ms>        Polling interval in milliseconds (default: 1500)
  --json                 Output the final feedback as JSON
  -v, --verbose          Enable verbose logging while starting GitHuman
  -h, --help             Show this help message

Config file:
  - .githuman/config.json can provide default host, port, https, open, and authToken
  - CLI flags override config file values

Examples:
  githuman ask
  githuman ask "Please review the parser changes"
  githuman ask --review abc123 --no-open
`)
}

function buildRequestContent (message: string): string {
  const trimmed = message.trim()
  if (!trimmed) {
    return 'AI review request: Please review the current changes.'
  }

  return `AI review request: ${trimmed}`
}

async function notifyServer (url: string, authToken: string | null) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    await fetch(new URL('/api/events/notify', url), {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'todos', action: 'updated' }),
      signal: AbortSignal.timeout(1000),
    })
  } catch {
    // Best effort only
  }
}

function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function wasTouchedDuringSession (record: { createdAt: string; updatedAt: string }, sessionStartedAt: number): boolean {
  return Math.max(Date.parse(record.createdAt), Date.parse(record.updatedAt)) >= sessionStartedAt
}

function formatTodo (todo: Todo): string {
  const suffix = todo.reviewId ? ` (review ${todo.reviewId.slice(0, 8)})` : ''
  return `- ${todo.content}${suffix}`
}

function formatComment (comment: Comment): string {
  const location = comment.lineNumber == null
    ? comment.filePath
    : `${comment.filePath}:${comment.lineNumber}`

  return `- ${location}\n  ${JSON.stringify(comment.content)}`
}

function formatPlainTextResult (result: AskResult): string {
  const lines = [
    'GitHuman feedback ready',
    `URL: ${result.url}`,
    `Request todo: completed (${result.requestTodo.id.slice(0, 8)})`,
    `Review status: ${result.reviewStatus ?? 'unknown'}`,
    '',
    'Todos:',
  ]

  if (result.todos.length === 0) {
    lines.push('- None')
  } else {
    lines.push(...result.todos.map(formatTodo))
  }

  lines.push('', 'Comments:')

  if (result.comments.length === 0) {
    lines.push('- None')
  } else {
    lines.push(...result.comments.map(formatComment))
  }

  return lines.join('\n')
}

function getLatestReviewStatus (reviews: Review[], sessionStartedAt: number, reviewId?: string): Review['status'] | null {
  if (reviewId) {
    return reviews.find(review => review.id === reviewId)?.status ?? null
  }

  const recent = reviews
    .filter(review => wasTouchedDuringSession(review, sessionStartedAt))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]

  return recent?.status ?? null
}

export async function askCommand (args: string[]) {
  const authValue = extractAuthArg(args)
  const filteredArgs = stripAuthArg(args, authValue)
  const { values, positionals } = parseArgs({
    args: filteredArgs,
    allowNegative: true,
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      open: { type: 'boolean' },
      host: { type: 'string' },
      https: { type: 'boolean' },
      cert: { type: 'string' },
      key: { type: 'string' },
      review: { type: 'string' },
      interval: { type: 'string' },
      json: { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const intervalMs = values.interval ? parseInt(values.interval, 10) : DEFAULT_INTERVAL_MS
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.error('Error: --interval must be a positive integer')
    process.exit(1)
  }

  const runtime = await resolveServerRuntime(args, {
    port: values.port,
    open: values.open,
    host: values.host,
    https: values.https,
    cert: values.cert,
    key: values.key,
    verbose: values.verbose,
  })

  const server = await ensureServerRunning(runtime)
  const url = getAccessUrl(runtime.config)

  let interrupted = false
  const onInterrupt = () => {
    interrupted = true
  }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onInterrupt)

  try {
    if (runtime.openBrowser) {
      await open(url)
    }

    const db = getDatabase()
    const todoRepo = new TodoRepository(db)
    const commentRepo = new CommentRepository(db)
    const reviewRepo = new ReviewRepository(db)

    if (values.review) {
      const review = reviewRepo.findById(values.review)
      if (!review) {
        console.error(`Error: Review not found: ${values.review}`)
        process.exitCode = 1
        return
      }
    }

    const sessionStartedAt = Date.now()

    const requestTodo = todoRepo.create({
      id: randomUUID(),
      content: buildRequestContent(positionals.join(' ')),
      completed: false,
      reviewId: values.review ?? null,
    })

    await notifyServer(url, runtime.config.authToken)

    if (!values.json) {
      console.error(`GitHuman available at: ${url}`)
      console.error(`Waiting for human review: ${requestTodo.content}`)
      console.error('Mark the request todo as done in GitHuman when feedback is ready.')
    }

    while (true) {
      if (interrupted) {
        console.error(`\nInterrupted. GitHuman is still available at: ${url}`)
        process.exitCode = 1
        return
      }

      const currentTodo = todoRepo.findById(requestTodo.id)
      if (!currentTodo) {
        console.error('Review request was cancelled')
        process.exitCode = 1
        return
      }

      if (currentTodo.completed) {
        const allTodos = todoRepo.findAll()
        const filteredTodos = allTodos
          .filter(todo => todo.id !== requestTodo.id)
          .filter(todo => !todo.completed)
          .filter(todo => !values.review || todo.reviewId === values.review)
          .filter(todo => wasTouchedDuringSession(todo, sessionStartedAt))

        const reviews = reviewRepo.findAll({
          repositoryPath: runtime.config.repositoryPath,
          pageSize: 1000,
        }).data

        const comments = (values.review
          ? commentRepo.findByReview(values.review)
          : reviews.flatMap(review => commentRepo.findByReview(review.id)))
          .filter(comment => wasTouchedDuringSession(comment, sessionStartedAt))
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

        const result: AskResult = {
          url,
          requestTodo: currentTodo,
          reviewStatus: getLatestReviewStatus(reviews, sessionStartedAt, values.review),
          todos: filteredTodos,
          comments,
        }

        if (values.json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(formatPlainTextResult(result))
        }
        return
      }

      await sleep(intervalMs)
    }
  } finally {
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onInterrupt)
    await server.close()
  }
}

export { buildRequestContent }
