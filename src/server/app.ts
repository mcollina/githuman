/**
 * Fastify application factory
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.ts';
import type { ServerConfig } from './config.ts';
import type { HealthResponse } from '../shared/types.ts';

export interface AppOptions {
  logger?: boolean;
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

  return app;
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}
