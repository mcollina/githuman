#!/usr/bin/env node
/**
 * GitHuman CLI - Review AI agent code changes before commit
 */

// Suppress SQLite experimental warning
// Must be done before any imports that might load sqlite
const originalEmitWarning = process.emitWarning
process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  if (typeof warning === 'string' && warning.includes('SQLite')) {
    return
  }
  if (warning instanceof Error && warning.message.includes('SQLite')) {
    return
  }
  return (originalEmitWarning as Function).call(process, warning, ...args)
}) as typeof process.emitWarning

// Use dynamic imports so warning suppression is in place first
const { parseArgs } = await import('node:util')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
})

const command = positionals[0]

function printHelp () {
  console.log(`
GitHuman - Review AI agent code changes before commit

Usage: githuman <command> [options]

Commands:
  serve          Start the review server and open web interface
  list           List all saved reviews for the current repository
  export         Export a review to markdown
  resolve        Mark a review as approved and resolve all comments
  todo           Manage todo items for tracking tasks

Options:
  -h, --help      Show this help message
  -v, --version   Show version number

Run 'githuman <command> --help' for command-specific help.
`)
}

function printVersion () {
  console.log('githuman v0.1.0')
}

if (values.version && !command) {
  printVersion()
  process.exit(0)
}

if (!command) {
  printHelp()
  process.exit(0)
}

switch (command) {
  case 'serve': {
    const { serveCommand } = await import('./commands/serve.ts')
    await serveCommand(process.argv.slice(3))
    break
  }
  case 'list': {
    const { listCommand } = await import('./commands/list.ts')
    await listCommand(process.argv.slice(3))
    break
  }
  case 'export': {
    const { exportCommand } = await import('./commands/export.ts')
    await exportCommand(process.argv.slice(3))
    break
  }
  case 'resolve': {
    const { resolveCommand } = await import('./commands/resolve.ts')
    await resolveCommand(process.argv.slice(3))
    break
  }
  case 'todo': {
    const { todoCommand } = await import('./commands/todo.ts')
    await todoCommand(process.argv.slice(3))
    break
  }
  default:
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
}
