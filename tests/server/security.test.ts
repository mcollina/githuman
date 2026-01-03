/**
 * Security tests to prevent regressions
 * Tests for common vulnerabilities: SQL injection, path traversal, XSS, etc.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../../src/server/app.ts';
import { createConfig } from '../../src/server/config.ts';
import { initDatabase, closeDatabase } from '../../src/server/db/index.ts';
import type { FastifyInstance } from 'fastify';

describe('security tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const config = createConfig({ repositoryPath: process.cwd() });
    initDatabase(':memory:');
    app = await buildApp(config, { logger: false, serveStatic: false });
  });

  afterEach(async () => {
    await app?.close();
    closeDatabase();
  });

  describe('SQL injection prevention', () => {
    it('should store SQL injection attempt as literal string in todo content', async () => {
      const maliciousContent = "test' OR 1=1--";

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: maliciousContent },
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      // Content should be stored literally, not executed
      assert.strictEqual(data.content, maliciousContent);
    });

    it('should handle SQL injection in query parameters safely', async () => {
      const response = await app.inject({
        method: 'GET',
        url: "/api/todos?completed=1'%20OR%20'1'='1",
      });

      // Should not cause server error
      assert.ok(response.statusCode < 500);
    });

    it('should handle SQL injection in URL parameters safely', async () => {
      const response = await app.inject({
        method: 'GET',
        url: "/api/reviews/1'%20OR%20'1'='1",
      });

      // Should return 404, not 500
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('input validation', () => {
    it('should reject empty content in todo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: '' },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should reject null content in todo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: null },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should reject negative position in todo move', async () => {
      // First create a todo
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: 'test' },
      });
      const todo = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/todos/${todo.id}/move`,
        payload: { position: -1 },
      });

      assert.strictEqual(response.statusCode, 400);
    });

    it('should handle very large position gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/nonexistent-id/move',
        payload: { position: 999999999999 },
      });

      // Should not cause server error
      assert.ok(response.statusCode < 500);
    });
  });

  describe('XSS prevention', () => {
    it('should store script tags as literal content (API does not escape, frontend should)', async () => {
      const xssContent = '<script>alert(1)</script>';

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: xssContent },
      });

      assert.strictEqual(response.statusCode, 201);
      const data = JSON.parse(response.payload);
      // API stores literally - XSS prevention is frontend responsibility
      assert.strictEqual(data.content, xssContent);
    });
  });

  describe('prototype pollution prevention', () => {
    it('should reject __proto__ in JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        headers: { 'content-type': 'application/json' },
        payload: '{"content": "test", "__proto__": {"admin": true}}',
      });

      // Fastify should reject this as invalid JSON
      assert.strictEqual(response.statusCode, 400);
    });

    it('should reject constructor pollution in JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        headers: { 'content-type': 'application/json' },
        payload: '{"content": "test", "constructor": {"prototype": {"admin": true}}}',
      });

      // Fastify should reject this as invalid JSON
      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('large payload handling', () => {
    it('should handle large content without crashing', async () => {
      const largeContent = 'a'.repeat(10000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { content: largeContent },
      });

      // Should succeed or fail gracefully, not crash
      assert.ok(response.statusCode < 500);
    });

    it('should handle large array in reorder without crashing', async () => {
      const largeArray = Array(1000).fill('fake-id');

      const response = await app.inject({
        method: 'POST',
        url: '/api/todos/reorder',
        payload: { orderedIds: largeArray },
      });

      // Should succeed or fail gracefully, not crash
      assert.ok(response.statusCode < 500);
    });
  });
});

describe('schema validation tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const config = createConfig({ repositoryPath: process.cwd() });
    initDatabase(':memory:');
    app = await buildApp(config, { logger: false, serveStatic: false });
  });

  afterEach(async () => {
    await app?.close();
    closeDatabase();
  });

  describe('response schemas match actual data', () => {
    it('GET /api/reviews should return valid schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews',
      });

      // Should not return 500 due to schema mismatch
      assert.ok(response.statusCode < 500, `Expected status < 500 but got ${response.statusCode}: ${response.payload}`);
    });

    it('GET /api/git/commits should return valid schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/commits?limit=5',
      });

      // Should not return 500 due to schema mismatch
      assert.ok(response.statusCode < 500, `Expected status < 500 but got ${response.statusCode}: ${response.payload}`);
    });

    it('GET /api/git/branches should return valid schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/git/branches',
      });

      // Should not return 500 due to schema mismatch
      assert.ok(response.statusCode < 500, `Expected status < 500 but got ${response.statusCode}: ${response.payload}`);
    });
  });
});
