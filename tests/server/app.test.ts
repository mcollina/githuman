import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

  describe('static app assets', () => {
    let app: FastifyInstance

    before(async () => {
      const config = createConfig()
      app = await buildApp(config, { logger: false })
    })

    after(async () => {
      await app.close()
    })

    it('should serve built JavaScript assets instead of index.html', async () => {
      const webDir = join(process.cwd(), 'dist', 'web')
      const indexHtml = readFileSync(join(webDir, 'index.html'), 'utf-8')
      const scriptMatch = indexHtml.match(/<script[^>]+src="([^"]+)"/)

      assert.ok(scriptMatch, 'expected built index.html to reference a script asset')
      const assetPath = scriptMatch[1]

      const response = await app.inject({
        method: 'GET',
        url: assetPath,
      })

      assert.strictEqual(response.statusCode, 200)
      assert.match(response.headers['content-type'] ?? '', /javascript|ecmascript|text\/plain/)
      assert.doesNotMatch(response.body, /<!DOCTYPE html>/)
    })

    it('should return 404 for missing asset paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/assets/does-not-exist.js',
      })

      assert.strictEqual(response.statusCode, 404)
      assert.doesNotMatch(response.body, /<!DOCTYPE html>/)
    })
  })

  describe('HTTPS configuration', () => {
    it('should build app without HTTPS when https is false', async () => {
      const config = createConfig({ https: false })
      const app = await buildApp(config, { logger: false })

      // App should build successfully without HTTPS
      assert.ok(app)
      assert.strictEqual(app.config.https, false)

      await app.close()
    })

    it('should expose https setting in config', async () => {
      // Test that config is correctly passed through without actually creating HTTPS server
      // (creating HTTPS server requires valid certificates)
      const config = createConfig({
        https: true,
        tlsCert: 'test-cert',
        tlsKey: 'test-key',
      })

      // Verify config has the right values
      assert.strictEqual(config.https, true)
      assert.strictEqual(config.tlsCert, 'test-cert')
      assert.strictEqual(config.tlsKey, 'test-key')
    })
  })
})
