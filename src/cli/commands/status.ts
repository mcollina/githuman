/**
 * Status command - show overview of reviews and todos
 */
import { parseArgs } from 'node:util'
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/index.ts'
import { createConfig } from '../../server/config.ts'
import { ReviewRepository } from '../../server/repositories/review.repo.ts'
import { TodoRepository } from '../../server/repositories/todo.repo.ts'

function printHelp () {
  console.log(`
Usage: githuman status [options]

Show an overview of reviews and todos in the current repository.

Options:
  --json                 Output as JSON
  -h, --help             Show this help message
`)
}

interface StatusResult {
  reviews: {
    total: number;
    inProgress: number;
    approved: number;
    changesRequested: number;
  };
  todos: {
    total: number;
    pending: number;
    completed: number;
  };
}

export async function statusCommand (args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const config = createConfig()

  try {
    initDatabase(config.dbPath)
    const db = getDatabase()
    const reviewRepo = new ReviewRepository(db)
    const todoRepo = new TodoRepository(db)

    const status: StatusResult = {
      reviews: {
        total: reviewRepo.countAll(),
        inProgress: reviewRepo.countByStatus('in_progress'),
        approved: reviewRepo.countByStatus('approved'),
        changesRequested: reviewRepo.countByStatus('changes_requested'),
      },
      todos: {
        total: todoRepo.countAll(),
        pending: todoRepo.countPending(),
        completed: todoRepo.countCompleted(),
      },
    }

    if (values.json) {
      console.log(JSON.stringify(status, null, 2))
    } else {
      console.log('GitHuman Status\n')

      // Reviews section
      console.log('Reviews:')
      if (status.reviews.total === 0) {
        console.log('  No reviews yet')
      } else {
        console.log(`  Total: ${status.reviews.total}`)
        if (status.reviews.inProgress > 0) {
          console.log(`  [ ] In progress: ${status.reviews.inProgress}`)
        }
        if (status.reviews.approved > 0) {
          console.log(`  [+] Approved: ${status.reviews.approved}`)
        }
        if (status.reviews.changesRequested > 0) {
          console.log(`  [!] Changes requested: ${status.reviews.changesRequested}`)
        }
      }

      console.log('')

      // Todos section
      console.log('Todos:')
      if (status.todos.total === 0) {
        console.log('  No todos yet')
      } else {
        console.log(`  Total: ${status.todos.total}`)
        console.log(`  [ ] Pending: ${status.todos.pending}`)
        console.log(`  [x] Completed: ${status.todos.completed}`)
      }
    }

    closeDatabase()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      if (values.json) {
        console.log(JSON.stringify({
          reviews: { total: 0, inProgress: 0, approved: 0, changesRequested: 0 },
          todos: { total: 0, pending: 0, completed: 0 },
        }, null, 2))
      } else {
        console.log('GitHuman Status\n')
        console.log('No database found. Run "githuman serve" to get started.')
      }
    } else {
      throw err
    }
  }
}
