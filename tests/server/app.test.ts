import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { buildApp } from '../../src/server/app.ts'
import { createConfig } from '../../src/server/config.ts'
import type { FastifyInstance } from 'fastify'
import { TEST_TOKEN } from './helpers.ts'

describe('app', () => {
  describe('health endpoint', () => {
    // Auth is disabled by default for localhost (no token)
    describe('without auth token (localhost default)', () => {
      let app: FastifyInstance

      before(async () => {
        const config = createConfig()
        app = await buildApp(config, { logger: false })
      })

      after(async () => {
        await app.close()
      })

      it('should return status ok', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/health',
        })

        assert.strictEqual(response.statusCode, 200)
        const body = JSON.parse(response.body)
        assert.strictEqual(body.status, 'ok')
      })

      it('should indicate auth is not required', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/health',
        })

        const body = JSON.parse(response.body)
        assert.strictEqual(body.authRequired, false)
      })
    })

    describe('with explicit token', () => {
      let app: FastifyInstance

      before(async () => {
        const config = createConfig({
          authToken: TEST_TOKEN,
        })
        app = await buildApp(config, { logger: false })
      })

      after(async () => {
        await app.close()
      })

      it('should indicate auth is required', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/health',
        })

        assert.strictEqual(response.statusCode, 200)
        const body = JSON.parse(response.body)
        assert.strictEqual(body.authRequired, true)
      })
    })
  })

  describe('config decorator', () => {
    it('should expose config on app instance', async () => {
      const config = createConfig({
        port: 4000,
        host: '0.0.0.0',
      })
      const app = await buildApp(config, { logger: false })

      assert.strictEqual(app.config.port, 4000)
      assert.strictEqual(app.config.host, '0.0.0.0')

      await app.close()
    })
  })

  describe('CORS', () => {
    let app: FastifyInstance

    before(async () => {
      const config = createConfig()
      app = await buildApp(config, { logger: false })
    })

    after(async () => {
      await app.close()
    })

    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'http://localhost:5173',
        },
      })

      assert.ok(response.headers['access-control-allow-origin'])
    })
  })

  describe('verbose option', () => {
    it('should build app with verbose option', async () => {
      const config = createConfig()
      const app = await buildApp(config, { logger: false, verbose: true })

      // App should build successfully with verbose option
      assert.ok(app)

      await app.close()
    })
  })
})
