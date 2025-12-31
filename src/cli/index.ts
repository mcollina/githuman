#!/usr/bin/env node
/**
 * Local Code Reviewer CLI
 */
import { parseArgs } from 'node:util';
import { serveCommand } from './commands/serve.ts';
import { listCommand } from './commands/list.ts';
import { exportCommand } from './commands/export.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
  options: {
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});

const command = positionals[0];

function printHelp() {
  console.log(`
Local Code Reviewer - Review staged changes locally

Usage: code-review <command> [options]

Commands:
  serve     Start the review server and open web interface
  list      List all saved reviews for the current repository
  export    Export a review to markdown

Options:
  -h, --help      Show this help message
  -v, --version   Show version number

Run 'code-review <command> --help' for command-specific help.
`);
}

function printVersion() {
  console.log('code-review v0.1.0');
}

if (values.version && !command) {
  printVersion();
  process.exit(0);
}

if (!command) {
  printHelp();
  process.exit(0);
}

switch (command) {
  case 'serve':
    await serveCommand(process.argv.slice(3));
    break;
  case 'list':
    await listCommand(process.argv.slice(3));
    break;
  case 'export':
    await exportCommand(process.argv.slice(3));
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
