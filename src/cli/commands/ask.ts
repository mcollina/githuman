/**
 * Ask command - create an assistant↔human handoff session and wait for completion
 */
import { parseArgs } from 'node:util'
import open from 'open'
import type { AskFeedback, AskSession, AskSessionDetails, Comment, CreateAskSessionRequest, Todo } from '../../shared/types.ts'
import { ensureServerRunning, extractAuthArg, getAppUrl, resolveServerRuntime, stripAuthArg } from '../server-runtime.ts'

const DEFAULT_INTERVAL_MS = 1500

interface AskResult extends AskFeedback {
  url: string;
}

interface ApiErrorResponse {
  error?: string;
  code?: string;
}

class AskCommandApiError extends Error {
  status: number
  code?: string

  constructor (message: string, status: number, code?: string) {
    super(message)
    this.name = 'AskCommandApiError'
    this.status = status
    this.code = code
  }
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

function buildRequestMessage (message: string): string {
  const trimmed = message.trim()
  if (!trimmed) {
    return 'Please review the current changes.'
  }

  return trimmed
}

function getHeaders (authToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return headers
}

async function parseResponse<T> (response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new AskCommandApiError(
      error.error ?? `HTTP ${response.status}`,
      response.status,
      error.code
    )
  }

  return await response.json() as T
}

async function createAskSession (baseUrl: string, authToken: string | null, request: CreateAskSessionRequest): Promise<AskSession> {
  const response = await fetch(new URL('/api/asks', baseUrl), {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  })

  return await parseResponse<AskSession>(response)
}

async function getAskSession (baseUrl: string, authToken: string | null, id: string): Promise<AskSessionDetails> {
  const response = await fetch(new URL(`/api/asks/${id}`, baseUrl), {
    method: 'GET',
    headers: getHeaders(authToken),
  })

  return await parseResponse<AskSessionDetails>(response)
}

async function getAskFeedback (baseUrl: string, authToken: string | null, id: string): Promise<AskFeedback> {
  const response = await fetch(new URL(`/api/asks/${id}/feedback`, baseUrl), {
    method: 'GET',
    headers: getHeaders(authToken),
  })

  return await parseResponse<AskFeedback>(response)
}

async function notifyServer (baseUrl: string, authToken: string | null, type: 'asks' | 'todos' | 'reviews' | 'comments') {
  try {
    await fetch(new URL('/api/events/notify', baseUrl), {
      method: 'POST',
      headers: getHeaders(authToken),
      body: JSON.stringify({ type, action: 'updated' }),
      signal: AbortSignal.timeout(1000),
    })
  } catch {
    // Best effort only
  }
}

function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatTodo (todo: Todo): string {
  const status = todo.completed ? '[done] ' : ''
  const suffix = todo.reviewId ? ` (review ${todo.reviewId.slice(0, 8)})` : ''
  return `- ${status}${todo.content}${suffix}`
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
    `Ask status: ${result.ask.status}`,
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
  const baseUrl = getAppUrl(runtime.config, '/')

  let interrupted = false
  const onInterrupt = () => {
    interrupted = true
  }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onInterrupt)

  try {
    let ask: AskSession
    try {
      ask = await createAskSession(baseUrl, runtime.config.authToken, {
        message: buildRequestMessage(positionals.join(' ')),
        reviewId: values.review,
      })
    } catch (err) {
      if (err instanceof AskCommandApiError && err.status < 500) {
        console.error(`Error: ${err.message}`)
        process.exitCode = 1
        return
      }
      throw err
    }

    const askUrl = getAppUrl(runtime.config, `/ask/${ask.id}`)

    await notifyServer(baseUrl, runtime.config.authToken, 'asks')

    if (runtime.openBrowser) {
      await open(askUrl)
    }

    if (!values.json) {
      console.error(`GitHuman ask page: ${askUrl}`)
      console.error(`Waiting for human review: ${ask.message}`)
      console.error('The reviewer should click "Continue assistant" in the ask UI when feedback is ready.')
    }

    while (true) {
      if (interrupted) {
        console.error(`\nInterrupted. GitHuman ask page is still available at: ${askUrl}`)
        process.exitCode = 1
        return
      }

      let currentAsk: AskSessionDetails
      try {
        currentAsk = await getAskSession(baseUrl, runtime.config.authToken, ask.id)
      } catch (err) {
        if (err instanceof AskCommandApiError && err.status === 404) {
          console.error('Ask session no longer exists')
          process.exitCode = 1
          return
        }
        throw err
      }

      if (currentAsk.status === 'cancelled') {
        console.error('Review request was cancelled')
        process.exitCode = 1
        return
      }

      if (currentAsk.status === 'ready_for_agent') {
        const feedback = await getAskFeedback(baseUrl, runtime.config.authToken, currentAsk.id)

        const result: AskResult = {
          ...feedback,
          url: askUrl,
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

export { buildRequestMessage }
