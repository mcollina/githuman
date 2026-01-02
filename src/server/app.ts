/**
 * Fastify application factory
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { fastifyRequestContext, requestContext } from '@fastify/request-context';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import authPlugin from './plugins/auth.ts';
import diffRoutes, { imageRoute } from './routes/diff.ts';
import reviewRoutes from './routes/reviews.ts';
import commentRoutes from './routes/comments.ts';
import todoRoutes from './routes/todos.ts';
import gitRoutes from './routes/git.ts';
import type { ServerConfig } from './config.ts';
import type { HealthResponse } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  logger?: boolean;
  serveStatic?: boolean;
}

function getLoggerConfig(enabled: boolean) {
  if (!enabled) return false;

  // Use one-line-logger for pretty output when running in a TTY
  if (process.stdout.isTTY) {
    return {
      transport: {
        target: '@fastify/one-line-logger',
      },
    };
  }

  // Default JSON logging for non-TTY (e.g., piped output, log files)
  return true;
}

export async function buildApp(
  config: ServerConfig,
  options: AppOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: getLoggerConfig(options.logger ?? true),
  });

  // Register request context plugin
  await app.register(fastifyRequestContext);

  // Store request logger in context for access from services
  app.addHook('onRequest', (request, _reply, done) => {
    request.requestContext.set('log', request.log);
    done();
  });

  // Register CORS for development
  await app.register(cors, {
    origin: true,
  });

  // Register auth plugin
  await app.register(authPlugin, {
    token: config.authToken,
  });

  // Health check endpoint
  app.get<{ Reply: HealthResponse }>('/api/health', async () => {
    return {
      status: 'ok',
      authRequired: app.authEnabled,
    };
  });

  // Store config on app instance for routes to access
  app.decorate('config', config);

  // Register routes
  await app.register(diffRoutes);
  await app.register(imageRoute);
  await app.register(reviewRoutes);
  await app.register(commentRoutes);
  await app.register(todoRoutes);
  await app.register(gitRoutes);

  // Serve static files if enabled and dist/web exists
  if (options.serveStatic !== false) {
    const staticPath = join(__dirname, '../../dist/web');
    if (existsSync(staticPath)) {
      await app.register(fastifyStatic, {
        root: staticPath,
        prefix: '/',
        wildcard: false,
      });

      // SPA fallback - serve index.html for non-API routes
      app.setNotFoundHandler(async (request, reply) => {
        if (!request.url.startsWith('/api/')) {
          return reply.sendFile('index.html');
        }
        return reply.code(404).send({ error: 'Not found' });
      });
    }
  }

  return app;
}

// Re-export requestContext for use in services
export { requestContext };

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
