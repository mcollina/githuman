/**
 * Fastify application factory
 */
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { fastifyRequestContext, requestContext } from '@fastify/request-context'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fastifySSE from '@fastify/sse'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import authPlugin from './plugins/auth.ts'
import diffRoutes, { imageRoute } from './routes/diff.ts'
import reviewRoutes from './routes/reviews.ts'
import commentRoutes from './routes/comments.ts'
import todoRoutes from './routes/todos.ts'
import gitRoutes from './routes/git.ts'
import eventsRoutes from './routes/events.ts'
import type { ServerConfig } from './config.ts'
import type { HealthResponse } from '../shared/types.ts'
import { HealthResponseSchema } from './schemas/common.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface AppOptions {
  logger?: boolean;
  serveStatic?: boolean;
  verbose?: boolean;
}

function getLoggerConfig (enabled: boolean, verbose: boolean) {
  if (!enabled) return false

  // Use pino-pretty for verbose output, one-line-logger for compact output
  if (process.stdout.isTTY) {
    return {
      level: verbose ? 'debug' : 'info',
      transport: {
        target: verbose ? 'pino-pretty' : '@fastify/one-line-logger',
      },
    }
  }

  // Default JSON logging for non-TTY (e.g., piped output, log files)
  return {
    level: verbose ? 'debug' : 'info',
  }
}

export async function buildApp (
  config: ServerConfig,
  options: AppOptions = {}
): Promise<FastifyInstance> {
  // Configure HTTPS if enabled with valid certificates
  const httpsOptions = config.https && config.tlsCert && config.tlsKey
    ? { https: { cert: config.tlsCert, key: config.tlsKey } }
    : {}

  const app = Fastify({
    logger: getLoggerConfig(options.logger ?? true, options.verbose ?? false),
    forceCloseConnections: true, // Close all connections on shutdown (important for SSE)
    ...httpsOptions,
  }).withTypeProvider<TypeBoxTypeProvider>()

  // Register request context plugin
  await app.register(fastifyRequestContext)

  // Store request logger in context for access from services
  app.addHook('onRequest', (request, _reply, done) => {
    request.requestContext.set('log', request.log)
    done()
  })

  // Register security headers with helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"], // Needed for Swagger UI, Vite, and Shiki syntax highlighter (WebAssembly)
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Needed for inline styles and Google Fonts
        imgSrc: ["'self'", 'data:', 'blob:'], // Allow data URIs for images
        fontSrc: ["'self'", 'https://fonts.gstatic.com'], // Allow Google Fonts
        connectSrc: ["'self'"], // For API calls and SSE
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"], // Prevent clickjacking
        upgradeInsecureRequests: null, // Disable for local HTTP development
      },
    },
    // Prevent MIME type sniffing
    crossOriginEmbedderPolicy: false, // Disable for compatibility with external resources
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Enable HSTS only when HTTPS is active
    strictTransportSecurity: config.https
      ? { maxAge: 31536000, includeSubDomains: false, preload: false }
      : false,
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xXssProtection: true,
  })

  // Register Swagger for OpenAPI documentation
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'GitHuman API',
        description: 'API for reviewing AI agent code changes before commit',
        version: '0.1.0',
      },
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'todos', description: 'Todo management' },
        { name: 'reviews', description: 'Code review management' },
        { name: 'comments', description: 'Review comments' },
        { name: 'diff', description: 'Git diff operations' },
        { name: 'git', description: 'Git repository information' },
        { name: 'events', description: 'Server-sent events for real-time updates' },
      ],
      servers: [
        {
          url: `${config.https ? 'https' : 'http'}://${config.host}:${config.port}`,
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Optional Bearer token authentication. Set via GITHUMAN_TOKEN env var or --token flag.',
          },
        },
      },
      security: config.authToken ? [{ bearerAuth: [] }] : []
    },
  })

  // Register Swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  })

  // Register CORS for development
  await app.register(cors, {
    origin: true,
  })

  // Register SSE plugin for server-sent events
  // Cast needed because TypeBox type provider changes instance signature
  await app.register(fastifySSE as unknown as FastifyPluginAsync)

  // Register auth plugin
  await app.register(authPlugin, {
    token: config.authToken,
  })

  // Health check endpoint
  app.get<{ Reply: HealthResponse }>('/api/health', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      description: 'Check if the server is running and authentication status',
      response: {
        200: HealthResponseSchema,
      },
    },
  }, async () => {
    return {
      status: 'ok',
      authRequired: app.authEnabled,
    }
  })

  // Store config on app instance for routes to access
  app.decorate('config', config)

  // Register routes
  await app.register(diffRoutes)
  await app.register(imageRoute)
  await app.register(reviewRoutes)
  await app.register(commentRoutes)
  await app.register(todoRoutes)
  await app.register(gitRoutes)
  await app.register(eventsRoutes)

  // Serve static files if enabled and dist/web exists
  if (options.serveStatic !== false) {
    const staticPath = join(__dirname, '../../dist/web')
    if (existsSync(staticPath)) {
      await app.register(fastifyStatic, {
        root: staticPath,
        prefix: '/',
        wildcard: false,
      })

      // SPA fallback - serve index.html for non-API routes
      app.setNotFoundHandler(async (request, reply) => {
        if (!request.url.startsWith('/api/')) {
          return reply.sendFile('index.html')
        }
        return reply.code(404).send({ error: 'Not found' })
      })
    }
  }

  return app
}

// Re-export requestContext for use in services
export { requestContext }

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}

// Extend request context types
declare module '@fastify/request-context' {
  interface RequestContextData {
    log: import('fastify').FastifyBaseLogger;
  }
}
