/**
 * Fastify application factory
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import authPlugin from './plugins/auth.ts';
import diffRoutes from './routes/diff.ts';
import reviewRoutes from './routes/reviews.ts';
import commentRoutes from './routes/comments.ts';
import type { ServerConfig } from './config.ts';
import type { HealthResponse } from '../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  logger?: boolean;
  serveStatic?: boolean;
}

export async function buildApp(
  config: ServerConfig,
  options: AppOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
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
  await app.register(reviewRoutes);
  await app.register(commentRoutes);

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

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}
