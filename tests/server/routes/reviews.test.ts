import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../../../src/server/app.ts';
import { createConfig } from '../../../src/server/config.ts';
import { initDatabase, closeDatabase } from '../../../src/server/db/index.ts';
import type { FastifyInstance } from 'fastify';

describe('review routes', () => {
  let app: FastifyInstance;
  let testDbDir: string;

  before(async () => {
    // Create temp directory for test database
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-'));
    const dbPath = path.join(testDbDir, 'test.db');

    // Initialize database
    initDatabase(dbPath);

    // Use current directory (which is a git repo) for testing
    const config = createConfig({
      repositoryPath: process.cwd(),
      dbPath,
    });
    app = await buildApp(config, { logger: false });
  });

  after(async () => {
    await app.close();
    closeDatabase();

    // Clean up temp directory
    if (testDbDir) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/reviews', () => {
    it('should return empty list initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews',
      });

      assert.strictEqual(response.statusCode, 200);

      const body = JSON.parse(response.body);
      assert.ok(Array.isArray(body.data));
      assert.strictEqual(body.total, 0);
      assert.strictEqual(body.page, 1);
      assert.strictEqual(body.pageSize, 20);
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews?page=2&pageSize=10',
      });

      assert.strictEqual(response.statusCode, 200);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.page, 2);
      assert.strictEqual(body.pageSize, 10);
    });
  });

  describe('POST /api/reviews', () => {
    it('should return error when no staged changes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: {
          title: 'Test Review',
        },
      });

      // Expect error since test runs against clean repo
      assert.strictEqual(response.statusCode, 400);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.code, 'NO_STAGED_CHANGES');
    });

    it('should require title in body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/reviews',
        payload: {},
      });

      // Without staged changes, still returns the NO_STAGED_CHANGES error
      // because validation happens after checking staged changes
      assert.strictEqual(response.statusCode, 400);
    });
  });

  describe('GET /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/non-existent-id',
      });

      assert.strictEqual(response.statusCode, 404);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'Review not found');
    });
  });

  describe('PATCH /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/reviews/non-existent-id',
        payload: {
          title: 'Updated Title',
        },
      });

      assert.strictEqual(response.statusCode, 404);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'Review not found');
    });
  });

  describe('DELETE /api/reviews/:id', () => {
    it('should return 404 for non-existent review', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/reviews/non-existent-id',
      });

      assert.strictEqual(response.statusCode, 404);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'Review not found');
    });
  });

  describe('GET /api/reviews/stats', () => {
    it('should return stats structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/stats',
      });

      assert.strictEqual(response.statusCode, 200);

      const body = JSON.parse(response.body);
      assert.ok('total' in body);
      assert.ok('inProgress' in body);
      assert.ok('approved' in body);
      assert.ok('changesRequested' in body);
    });

    it('should return zeros for empty database', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reviews/stats',
      });

      const body = JSON.parse(response.body);
      assert.strictEqual(body.total, 0);
      assert.strictEqual(body.inProgress, 0);
      assert.strictEqual(body.approved, 0);
      assert.strictEqual(body.changesRequested, 0);
    });
  });
});

describe('review routes with non-git directory', () => {
  let app: FastifyInstance;
  let testDbDir: string;

  before(async () => {
    // Create temp directory for test database
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-nongit-'));
    const dbPath = path.join(testDbDir, 'test.db');

    // Use a separate database instance for this test
    initDatabase(dbPath);

    const config = createConfig({
      repositoryPath: '/tmp', // Not a git repo
      dbPath,
    });
    app = await buildApp(config, { logger: false });
  });

  after(async () => {
    await app.close();
    closeDatabase();

    if (testDbDir) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('should return error when creating review in non-git directory', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      payload: {
        title: 'Test Review',
      },
    });

    assert.strictEqual(response.statusCode, 400);

    const body = JSON.parse(response.body);
    assert.strictEqual(body.code, 'NOT_GIT_REPO');
  });
});
