/**
 * Todo command - manage todo items
 */
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/index.ts';
import { createConfig } from '../../server/config.ts';
import { TodoRepository } from '../../server/repositories/todo.repo.ts';

function printHelp() {
  console.log(`
Usage: code-review todo <subcommand> [options]

Manage todo items for tracking tasks during review.

Subcommands:
  add <content>          Add a new todo item
  list                   List todos (defaults to pending only)
  done <id>              Mark todo as completed
  undone <id>            Mark todo as not completed
  move <id> <position>   Move todo to a new position (0-indexed)
  remove <id>            Delete a todo
  clear                  Remove todos (use with --done to clear completed)

Options:
  --review <id>          Scope todo to a specific review
  --done                 Show/clear completed (done) todos instead of pending
  --all                  Show all todos (list only)
  --json                 Output as JSON
  -h, --help             Show this help message

Examples:
  code-review todo add "Fix the type error in utils.ts"
  code-review todo list                    # Shows pending todos
  code-review todo list --done             # Shows completed todos
  code-review todo list --all              # Shows all todos
  code-review todo done abc123
  code-review todo move abc123 0           # Move to top
  code-review todo clear --done
`);
}

export async function todoCommand(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      review: { type: 'string' },
      done: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    printHelp();
    process.exit(0);
  }

  const subcommand = positionals[0];
  const config = createConfig();

  try {
    initDatabase(config.dbPath);
    const db = getDatabase();
    const repo = new TodoRepository(db);

    switch (subcommand) {
      case 'add': {
        const content = positionals.slice(1).join(' ');
        if (!content) {
          console.error('Error: Todo content is required');
          console.error('Usage: code-review todo add <content>');
          process.exit(1);
        }

        const todo = repo.create({
          id: randomUUID(),
          content,
          completed: false,
          reviewId: values.review ?? null,
        });

        if (values.json) {
          console.log(JSON.stringify(todo, null, 2));
        } else {
          console.log(`Created todo: ${todo.id.slice(0, 8)}`);
          console.log(`  ${todo.content}`);
        }
        break;
      }

      case 'list': {
        let todos;
        // Default to showing pending only, unless --all or --done is specified
        const showDone = values.done;
        const showAll = values.all;

        if (values.review) {
          if (showAll) {
            todos = repo.findByReview(values.review);
          } else {
            todos = repo.findByReviewAndCompleted(values.review, showDone);
          }
        } else if (showAll) {
          todos = repo.findAll();
        } else {
          todos = repo.findByCompleted(showDone);
        }

        if (values.json) {
          console.log(JSON.stringify(todos, null, 2));
        } else if (todos.length === 0) {
          console.log('No todos found.');
        } else {
          console.log('Todos:\n');
          for (const todo of todos) {
            const statusIcon = todo.completed ? '[x]' : '[ ]';
            console.log(`${statusIcon} ${todo.content}`);
            console.log(`    ID: ${todo.id.slice(0, 8)}`);
            if (todo.reviewId) {
              console.log(`    Review: ${todo.reviewId.slice(0, 8)}`);
            }
            console.log('');
          }

          // Show summary
          const pending = todos.filter(t => !t.completed).length;
          const completed = todos.filter(t => t.completed).length;
          console.log(`Total: ${todos.length} (${pending} pending, ${completed} completed)`);
        }
        break;
      }

      case 'done': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: Todo ID is required');
          console.error('Usage: code-review todo done <id>');
          process.exit(1);
        }

        const todo = findTodoByPrefix(repo, id);
        if (!todo) {
          console.error(`Error: Todo not found: ${id}`);
          process.exit(1);
        }

        const updated = repo.update(todo.id, { completed: true });
        if (values.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(`Marked as done: ${todo.content}`);
        }
        break;
      }

      case 'undone': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: Todo ID is required');
          console.error('Usage: code-review todo undone <id>');
          process.exit(1);
        }

        const todo = findTodoByPrefix(repo, id);
        if (!todo) {
          console.error(`Error: Todo not found: ${id}`);
          process.exit(1);
        }

        const updated = repo.update(todo.id, { completed: false });
        if (values.json) {
          console.log(JSON.stringify(updated, null, 2));
        } else {
          console.log(`Marked as pending: ${todo.content}`);
        }
        break;
      }

      case 'move': {
        const id = positionals[1];
        const posStr = positionals[2];
        if (!id || posStr === undefined) {
          console.error('Error: Todo ID and position are required');
          console.error('Usage: code-review todo move <id> <position>');
          process.exit(1);
        }

        const position = parseInt(posStr, 10);
        if (Number.isNaN(position) || position < 0) {
          console.error('Error: Position must be a non-negative integer');
          process.exit(1);
        }

        const todo = findTodoByPrefix(repo, id);
        if (!todo) {
          console.error(`Error: Todo not found: ${id}`);
          process.exit(1);
        }

        const moved = repo.move(todo.id, position);
        if (values.json) {
          console.log(JSON.stringify(moved, null, 2));
        } else {
          console.log(`Moved "${todo.content}" to position ${position}`);
        }
        break;
      }

      case 'remove': {
        const id = positionals[1];
        if (!id) {
          console.error('Error: Todo ID is required');
          console.error('Usage: code-review todo remove <id>');
          process.exit(1);
        }

        const todo = findTodoByPrefix(repo, id);
        if (!todo) {
          console.error(`Error: Todo not found: ${id}`);
          process.exit(1);
        }

        repo.delete(todo.id);
        if (values.json) {
          console.log(JSON.stringify({ success: true, id: todo.id }, null, 2));
        } else {
          console.log(`Removed: ${todo.content}`);
        }
        break;
      }

      case 'clear': {
        if (values.done) {
          const count = repo.deleteCompleted();
          if (values.json) {
            console.log(JSON.stringify({ deleted: count }, null, 2));
          } else {
            console.log(`Cleared ${count} completed todo${count === 1 ? '' : 's'}`);
          }
        } else {
          console.error('Error: --done flag is required to clear todos');
          console.error('Usage: code-review todo clear --done');
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown subcommand: ${subcommand}`);
        printHelp();
        process.exit(1);
    }

    closeDatabase();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      if (subcommand === 'list') {
        if (values.json) {
          console.log('[]');
        } else {
          console.log('No todos found.');
        }
      } else {
        console.error('Error: Database does not exist yet. Run "code-review serve" first.');
        process.exit(1);
      }
    } else {
      throw err;
    }
  }
}

/**
 * Find a todo by ID prefix (for convenience)
 */
function findTodoByPrefix(repo: TodoRepository, prefix: string) {
  // First try exact match
  const exact = repo.findById(prefix);
  if (exact) return exact;

  // Then try prefix match
  const all = repo.findAll();
  const matches = all.filter(t => t.id.startsWith(prefix));

  if (matches.length === 1) {
    return matches[0];
  } else if (matches.length > 1) {
    console.error(`Error: Multiple todos match prefix "${prefix}". Be more specific.`);
    for (const match of matches) {
      console.error(`  ${match.id.slice(0, 8)}: ${match.content}`);
    }
    process.exit(1);
  }

  return null;
}
