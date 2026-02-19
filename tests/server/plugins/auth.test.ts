import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify, { type FastifyInstance } from 'fastify'
import authPlugin from '../../../src/server/plugins/auth.ts'
import { TEST_TOKEN } from '../helpers.ts'

/**
 * Create a test app with auth plugin
 */
async function createTestApp (token: string | null = TEST_TOKEN): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(authPlugin, { token })
  app.get('/api/test', async () => ({ message: 'ok' }))
  app.get('/api/health', async () => ({ status: 'ok' }))
  app.get('/static/file.js', async () => 'console.log("hello")')
  await app.ready()
  return app
}

describe('auth plugin', () => {
  describe('when auth is disabled (testing only)', () => {
    let app: FastifyInstance

    before(async () => {
      app = await createTestApp(null)
    })

    after(async () => {
      await app.close()
    })

    it('should set authEnabled to false', () => {
      assert.strictEqual(app.authEnabled, false)
    })

    it('should allow requests without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      })

      assert.strictEqual(response.statusCode, 200)
      assert.deepStrictEqual(JSON.parse(response.body), { message: 'ok' })
    })
  })

  describe('when auth is enabled', () => {
    // Tests that don't trigger rate limiting can share an app
    describe('positive auth tests', () => {
      let app: FastifyInstance

      before(async () => {
        app = await createTestApp()
      })

      after(async () => {
        await app.close()
      })

      it('should set authEnabled to true', () => {
        assert.strictEqual(app.authEnabled, true)
      })

      it('should allow requests with correct token', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: `Bearer ${TEST_TOKEN}`,
          },
        })

        assert.strictEqual(response.statusCode, 200)
        assert.deepStrictEqual(JSON.parse(response.body), { message: 'ok' })
      })

      it('should skip auth for 404 endpoint', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/non-existent-endpoint',
        })

        assert.strictEqual(response.statusCode, 404)
      })

      it('should skip auth for /api/health endpoint', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/health',
        })

        assert.strictEqual(response.statusCode, 200)
      })

      it('should skip auth for non-api routes', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/static/file.js',
        })

        assert.strictEqual(response.statusCode, 200)
      })

      it('should allow requests with token in query parameter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/api/test?token=${TEST_TOKEN}`,
        })

        assert.strictEqual(response.statusCode, 200)
        assert.deepStrictEqual(JSON.parse(response.body), { message: 'ok' })
      })

      it('should prefer valid header token over invalid query token', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test?token=wrong-token',
          headers: {
            authorization: `Bearer ${TEST_TOKEN}`,
          },
        })

        assert.strictEqual(response.statusCode, 200)
      })
    })

    // Tests that make failed auth attempts use fresh instances to avoid rate limiting
    describe('failed auth tests', () => {
      it('should reject requests without auth header', async () => {
        const app = await createTestApp()
        try {
          const response = await app.inject({
            method: 'GET',
            url: '/api/test',
          })

          assert.strictEqual(response.statusCode, 401)
          const body = JSON.parse(response.body)
          assert.strictEqual(body.error, 'Unauthorized')
        } finally {
          await app.close()
        }
      })

      it('should reject requests with invalid auth header format', async () => {
        const app = await createTestApp()
        try {
          const response = await app.inject({
            method: 'GET',
            url: '/api/test',
            headers: {
              authorization: 'Basic invalid',
            },
          })

          assert.strictEqual(response.statusCode, 401)
        } finally {
          await app.close()
        }
      })

      it('should reject requests with wrong token', async () => {
        const app = await createTestApp()
        try {
          const response = await app.inject({
            method: 'GET',
            url: '/api/test',
            headers: {
              authorization: 'Bearer wrong-token',
            },
          })

          assert.strictEqual(response.statusCode, 401)
          const body = JSON.parse(response.body)
          assert.strictEqual(body.message, 'Missing or invalid authorization')
        } finally {
          await app.close()
        }
      })

      it('should reject requests with wrong token in query parameter', async () => {
        const app = await createTestApp()
        try {
          const response = await app.inject({
            method: 'GET',
            url: '/api/test?token=wrong-token',
          })

          assert.strictEqual(response.statusCode, 401)
        } finally {
          await app.close()
        }
      })
    })
  })

  describe('brute force protection', () => {
    it('should return 429 after multiple failed attempts', async () => {
      const app = await createTestApp()
      try {
        // Make several failed attempts
        for (let i = 0; i < 3; i++) {
          await app.inject({
            method: 'GET',
            url: '/api/test',
            headers: {
              authorization: 'Bearer wrong-token',
            },
          })
        }

        // Next request should be rate limited
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: 'Bearer wrong-token',
          },
        })

        assert.strictEqual(response.statusCode, 429)
        const body = JSON.parse(response.body)
        assert.strictEqual(body.error, 'Too Many Requests')
        assert.ok(body.retryAfter > 0)
        assert.ok(response.headers['retry-after'])
      } finally {
        await app.close()
      }
    })

    it('should include Retry-After header in 429 response', async () => {
      const app = await createTestApp()
      try {
        // Make failed attempts to trigger rate limiting
        for (let i = 0; i < 3; i++) {
          await app.inject({
            method: 'GET',
            url: '/api/test',
            headers: {
              authorization: 'Bearer wrong-token',
            },
          })
        }

        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: 'Bearer wrong-token',
          },
        })

        assert.strictEqual(response.statusCode, 429)
        assert.ok(response.headers['retry-after'])
        const retryAfter = parseInt(response.headers['retry-after'] as string, 10)
        assert.ok(retryAfter > 0)
      } finally {
        await app.close()
      }
    })

    it('should clear rate limit on successful auth', async () => {
      const app = await createTestApp()
      try {
        // Make some failed attempts
        await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: 'Bearer wrong-token',
          },
        })

        // Successful auth should clear the record
        const successResponse = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: `Bearer ${TEST_TOKEN}`,
          },
        })
        assert.strictEqual(successResponse.statusCode, 200)

        // More failed attempts should start fresh (not accumulate)
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            authorization: 'Bearer wrong-token',
          },
        })

        // Should be 401, not 429, because we just made one failed attempt after reset
        assert.strictEqual(response.statusCode, 401)
      } finally {
        await app.close()
      }
    })
  })
})
