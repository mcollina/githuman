/**
 * Ask command - request human review by creating a todo item
 */
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/index.ts'
import { createConfig } from '../../server/config.ts'
import { TodoRepository } from '../../server/repositories/todo.repo.ts'

/**
 * Notify the running server that todos have changed.
 * This is fire-and-forget - if the server isn't running, we silently continue.
 */
async function notifyServer (config: { port: number; host: string; authToken: string | null }) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.authToken) {
      headers.Authorization = `Bearer ${config.authToken}`
    }

    const res = await fetch(`http://${config.host}:${config.port}/api/events/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'todos', action: 'updated' }),
      signal: AbortSignal.timeout(1000),
    })
    await res.text()
  } catch {
    // Server not running or unreachable - silently continue
  }
}

function printHelp () {
  console.log(`
Usage: githuman ask [message] [options]

Ask a human to review something by creating a visible todo item.

Arguments:
  message                Optional request for the human reviewer

Options:
  --review <id>          Scope the request to a specific review
  --json                 Output the created todo as JSON
  -h, --help             Show this help message

Examples:
  githuman ask
  githuman ask "Please review the parser changes"
  githuman ask "Does this migration look safe?" --review abc123
`)
}

function buildRequestContent (message: string): string {
  const trimmed = message.trim()
  if (!trimmed) {
    return 'Review request: Please review the current changes.'
  }

  return `Review request: ${trimmed}`
}

export async function askCommand (args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      review: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const content = buildRequestContent(positionals.join(' '))
  const config = createConfig()

  try {
    initDatabase(config.dbPath)
    const db = getDatabase()
    const repo = new TodoRepository(db)

    const todo = repo.create({
      id: randomUUID(),
      content,
      completed: false,
      reviewId: values.review ?? null,
    })

    if (values.json) {
      console.log(JSON.stringify(todo, null, 2))
    } else {
      console.log(`Created review request: ${todo.id.slice(0, 8)}`)
      console.log(`  ${todo.content}`)
      if (todo.reviewId) {
        console.log(`  Review: ${todo.reviewId.slice(0, 8)}`)
      }
    }

    await notifyServer(config)
    closeDatabase()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('Error: Database does not exist yet. Run "githuman serve" first.')
      process.exit(1)
    } else {
      throw err
    }
  }
}

export { buildRequestContent }
