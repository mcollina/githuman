import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify, { type FastifyInstance } from 'fastify';
import authPlugin from '../../../src/server/plugins/auth.ts';

describe('auth plugin', () => {
  describe('when auth is disabled', () => {
    let app: FastifyInstance;

    before(async () => {
      app = Fastify();
      await app.register(authPlugin, { token: null });
      app.get('/api/test', async () => ({ message: 'ok' }));
      await app.ready();
    });

    after(async () => {
      await app.close();
    });

    it('should set authEnabled to false', () => {
      assert.strictEqual(app.authEnabled, false);
    });

    it('should allow requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });

      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(JSON.parse(response.body), { message: 'ok' });
    });
  });

  describe('when auth is enabled', () => {
    let app: FastifyInstance;
    const TOKEN = 'test-secret-token';

    before(async () => {
      app = Fastify();
      await app.register(authPlugin, { token: TOKEN });
      app.get('/api/test', async () => ({ message: 'ok' }));
      app.get('/api/health', async () => ({ status: 'ok' }));
      app.get('/static/file.js', async () => 'console.log("hello")');
      await app.ready();
    });

    after(async () => {
      await app.close();
    });

    it('should set authEnabled to true', () => {
      assert.strictEqual(app.authEnabled, true);
    });

    it('should reject requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });

      assert.strictEqual(response.statusCode, 401);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'Unauthorized');
    });

    it('should reject requests with invalid auth header format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          authorization: 'Basic invalid',
        },
      });

      assert.strictEqual(response.statusCode, 401);
    });

    it('should reject requests with wrong token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          authorization: 'Bearer wrong-token',
        },
      });

      assert.strictEqual(response.statusCode, 401);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.message, 'Invalid token');
    });

    it('should allow requests with correct token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          authorization: `Bearer ${TOKEN}`,
        },
      });

      assert.strictEqual(response.statusCode, 200);
      assert.deepStrictEqual(JSON.parse(response.body), { message: 'ok' });
    });

    it('should skip auth for /api/health endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      assert.strictEqual(response.statusCode, 200);
    });

    it('should skip auth for non-api routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/static/file.js',
      });

      assert.strictEqual(response.statusCode, 200);
    });
  });
});
