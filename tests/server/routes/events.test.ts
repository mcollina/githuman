import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { buildApp } from '../../../src/server/app.ts'
import { createConfig } from '../../../src/server/config.ts'
import { initDatabase, closeDatabase } from '../../../src/server/db/index.ts'
import type { FastifyInstance } from 'fastify'
import { TEST_TOKEN, authHeader } from '../helpers.ts'

describe('events routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    const config = createConfig({ dbPath: ':memory:', authToken: TEST_TOKEN })
    initDatabase(config.dbPath)
    app = await buildApp(config, { logger: false, serveStatic: false })
  })

  afterEach(async () => {
    await app.close()
    closeDatabase()
  })

  describe('GET /api/events/clients', () => {
    it('should return count of connected clients', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/events/clients',
        headers: authHeader(),
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(typeof body.count, 'number')
      assert.strictEqual(body.count, 0)
    })
  })

  describe('POST /api/events/notify', () => {
    it('should accept todos notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: { type: 'todos', action: 'updated' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
    })

    it('should accept reviews notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: { type: 'reviews', action: 'created' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
    })

    it('should accept comments notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: { type: 'comments', action: 'deleted' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
    })

    it('should accept notification without action', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: { type: 'todos' },
      })

      assert.strictEqual(response.statusCode, 200)
      const body = JSON.parse(response.body)
      assert.strictEqual(body.success, true)
    })

    it('should reject invalid event type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: { type: 'invalid' },
      })

      assert.strictEqual(response.statusCode, 400)
    })

    it('should reject missing type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/events/notify',
        headers: authHeader(),
        payload: {},
      })

      assert.strictEqual(response.statusCode, 400)
    })
  })

  // Note: GET /api/events (SSE endpoint) cannot be easily tested with Fastify's inject
  // because it hijacks the response for streaming. The endpoint is tested via
  // integration testing when needed.

  describe('server shutdown', () => {
    it('should close cleanly without hanging', async () => {
      // This test verifies that the SIGINT fix works - the server should close
      // quickly without waiting for timeout. We use a separate app instance
      // to avoid interfering with the afterEach hook.
      const config = createConfig({ dbPath: ':memory:', authToken: TEST_TOKEN })
      const testApp = await buildApp(config, { logger: false, serveStatic: false })

      // Start time tracking
      const startTime = Date.now()

      // Close the app - this should complete quickly
      await testApp.close()

      // Verify it closed within a reasonable time (less than 2 seconds)
      // If the SIGINT fix regresses, this would hang until timeout
      const elapsed = Date.now() - startTime
      assert.ok(elapsed < 2000, `Server close took ${elapsed}ms, expected < 2000ms`)
    })
  })
})
