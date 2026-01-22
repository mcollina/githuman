/**
 * Server entry point
 */
import closeWithGrace from 'close-with-grace'
import { buildApp, type AppOptions } from './app.ts'
import { initDatabase, closeDatabase } from './db/index.ts'
import type { ServerConfig } from './config.ts'

export async function startServer (config: ServerConfig, options: AppOptions = {}): Promise<void> {
  // Initialize database
  initDatabase(config.dbPath)

  // Build and start the app
  const app = await buildApp(config, options)

  // Graceful shutdown with timeout
  closeWithGrace({ delay: 5000 }, async ({ signal, err }) => {
    if (err) {
      app.log.error({ err }, 'Server closing due to error')
    } else {
      app.log.info({ signal }, 'Server shutting down')
    }
    await app.close()
    closeDatabase()
  })

  try {
    await app.listen({ port: config.port, host: config.host })

    // Log URLs with token for easy access (double-clickable in terminals)
    if (config.authToken) {
      const addresses = app.addresses()
      for (const addr of addresses) {
        if (addr.family === 'IPv4') {
          const url = `http://${addr.address}:${addr.port}?token=${config.authToken}`
          app.log.info(`GitHuman running at: ${url}`)
        }
      }
      app.log.info('Authentication enabled')
    }
  } catch (err) {
    app.log.error(err)
    closeDatabase()
    process.exit(1)
  }
}

export { buildApp } from './app.ts'
export { createConfig } from './config.ts'
export type { ServerConfig } from './config.ts'
