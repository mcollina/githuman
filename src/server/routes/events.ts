/**
 * Server-Sent Events (SSE) routes for real-time updates
 * Uses @fastify/sse for SSE handling and mqemitter for local event dispatching
 * Includes file watching for live unstaged diff updates
 */
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import MQEmitter, { type Message, type MQEmitter as MQEmitterType } from 'mqemitter'
import { watch, type FSWatcher } from 'node:fs'
import { SuccessSchema } from '../schemas/common.ts'

// Event types that can be broadcast
export type EventType = 'todos' | 'reviews' | 'comments' | 'files'

// Extended message type for our events
interface EventMessage extends Message {
  type: EventType;
  data?: unknown;
  timestamp: number;
}

// Track connected clients for the /clients endpoint
let clientCount = 0

/**
 * Broadcast an event to all connected SSE clients via mqemitter
 */
async function broadcast (emitter: MQEmitterType, eventType: EventType, data?: unknown): Promise<void> {
  const message = { type: eventType, data, timestamp: Date.now() }
  return new Promise((resolve) => {
    emitter.emit({ topic: 'events', ...message }, () => resolve())
  })
}

const NotifyBodySchema = Type.Object(
  {
    type: Type.Union([Type.Literal('todos'), Type.Literal('reviews'), Type.Literal('comments'), Type.Literal('files')], {
      description: 'Type of resource that changed',
    }),
    action: Type.Optional(
      Type.Union([
        Type.Literal('created'),
        Type.Literal('updated'),
        Type.Literal('deleted'),
      ])
    ),
  },
  { description: 'Notification payload' }
)

// Debounce helper for file watcher
function debounce<T extends (...args: unknown[]) => void> (fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }) as T
}

const eventsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Decorate the emitter to the fastify instance
  const emitter = MQEmitter()
  fastify.decorate('eventEmitter', emitter)

  // Set up file watcher for live updates
  let fileWatcher: FSWatcher | null = null
  const repoPath = fastify.config.repositoryPath

  // Debounced broadcast to avoid flooding on rapid file changes
  const broadcastFileChange = debounce(() => {
    broadcast(emitter, 'files', { action: 'updated' })
    fastify.log.debug('File change detected, broadcasting event')
  }, 300)

  // Start watching when we have connected clients
  const startWatching = () => {
    if (fileWatcher) return

    try {
      fileWatcher = watch(repoPath, { recursive: true }, (eventType, filename) => {
        // Ignore .git directory and common non-source files
        if (
          !filename ||
          filename.startsWith('.git') ||
          filename.includes('node_modules') ||
          filename.endsWith('.log')
        ) {
          return
        }
        broadcastFileChange()
      })

      fileWatcher.on('error', (err) => {
        fastify.log.warn({ err }, 'File watcher error')
        stopWatching()
      })

      fastify.log.info({ path: repoPath }, 'File watcher started')
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to start file watcher')
    }
  }

  const stopWatching = () => {
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
      fastify.log.info('File watcher stopped')
    }
  }

  // Start watching immediately (could optimize to start only when clients connect)
  startWatching()

  // Clean up on server close
  fastify.addHook('onClose', async () => {
    stopWatching()
  })

  /**
   * GET /api/events
   * SSE endpoint for real-time updates
   */
  fastify.get(
    '/api/events',
    {
      sse: true,
      schema: {
        tags: ['events'],
        summary: 'Subscribe to server-sent events',
        description:
          'Open an SSE connection to receive real-time updates when data changes',
      },
    },
    async (request, reply) => {
      clientCount++
      request.log.info({ clients: clientCount }, 'SSE client connected')

      // Keep the connection alive
      reply.sse.keepAlive()

      // Send initial connection event
      await reply.sse.send({ data: { type: 'connected', timestamp: Date.now() } })

      // Subscribe to events from mqemitter
      const listener = (message: Message, cb: () => void) => {
        try {
          const eventMessage = message as EventMessage
          if (reply.sse.isConnected) {
            reply.sse.send({ data: { type: eventMessage.type, data: eventMessage.data, timestamp: eventMessage.timestamp } })
          }
        } catch (err) {
          request.log.error({ err }, 'Error sending SSE event')
        }
        cb()
      }

      fastify.eventEmitter.on('events', listener)

      // Clean up on disconnect
      reply.sse.onClose(() => {
        clientCount--
        fastify.eventEmitter.removeListener('events', listener)
        request.log.info({ clients: clientCount }, 'SSE client disconnected')
      })
    }
  )

  /**
   * POST /api/events/notify
   * Endpoint for CLI/external tools to trigger event broadcasts
   */
  fastify.post(
    '/api/events/notify',
    {
      schema: {
        tags: ['events'],
        summary: 'Broadcast an event notification',
        description:
          'Trigger a broadcast to all connected SSE clients. Used by CLI to notify UI of changes.',
        body: NotifyBodySchema,
        response: {
          200: SuccessSchema,
        },
      },
    },
    async (request) => {
      const { type, action } = request.body
      await broadcast(fastify.eventEmitter, type, { action })
      request.log.info({ type, action, clients: clientCount }, 'Event broadcast')
      return { success: true }
    }
  )

  /**
   * GET /api/events/clients
   * Debug endpoint to see connected client count
   */
  fastify.get(
    '/api/events/clients',
    {
      schema: {
        tags: ['events'],
        summary: 'Get connected client count',
        description: 'Returns the number of currently connected SSE clients',
        response: {
          200: Type.Object({
            count: Type.Integer({ description: 'Number of connected clients' }),
          }),
        },
      },
    },
    async () => {
      return { count: clientCount }
    }
  )
}

export default eventsRoutes

// Extend Fastify types for the eventEmitter decorator
declare module 'fastify' {
  interface FastifyInstance {
    eventEmitter: MQEmitterType;
  }
}
