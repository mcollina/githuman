/**
 * Serve command - start the review server
 */
import { parseArgs } from 'node:util'
import open from 'open'
import { startServer, createConfig } from '../../server/index.ts'

function printHelp () {
  console.log(`
Usage: githuman serve [options]

Start the review server and open web interface.

Options:
  -p, --port <number>    Port to run server on (default: 3847)
  --no-open              Don't auto-open browser
  --host <string>        Host to bind to (default: localhost)
  --auth <token>         Enable token authentication
  -v, --verbose          Enable verbose logging (full pino-pretty output)
  -h, --help             Show this help message
`)
}

export async function serveCommand (args: string[]) {
  const { values } = parseArgs({
    args,
    allowNegative: true,
    options: {
      port: { type: 'string', short: 'p', default: '3847' },
      open: { type: 'boolean', default: true },
      host: { type: 'string', default: 'localhost' },
      auth: { type: 'string' },
      verbose: { type: 'boolean', short: 'v', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const config = createConfig({
    port: parseInt(values.port!, 10),
    host: values.host,
    authToken: values.auth,
  })

  // Start the server
  await startServer(config, { verbose: values.verbose })

  // Open browser if requested
  if (values.open) {
    const url = `http://${config.host}:${config.port}`
    await open(url)
  }
}
