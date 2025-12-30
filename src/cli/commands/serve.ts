/**
 * Serve command - start the review server
 */
import { parseArgs } from 'node:util';
import open from 'open';
import { startServer, createConfig } from '../../server/index.ts';

function printHelp() {
  console.log(`
Usage: code-review serve [options]

Start the review server and open web interface.

Options:
  -p, --port <number>    Port to run server on (default: 3847)
  --no-open              Don't auto-open browser
  --host <string>        Host to bind to (default: localhost)
  --auth <token>         Enable token authentication
  -h, --help             Show this help message
`);
}

export async function serveCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    allowNegative: true,
    options: {
      port: { type: 'string', short: 'p', default: '3847' },
      open: { type: 'boolean', default: true },
      host: { type: 'string', default: 'localhost' },
      auth: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const config = createConfig({
    port: parseInt(values.port!, 10),
    host: values.host,
    authToken: values.auth,
  });

  // Start the server
  await startServer(config);

  // Open browser if requested
  if (values.open) {
    const url = `http://${config.host}:${config.port}`;
    await open(url);
  }
}
