import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { createConfig } from '../../src/server/config.ts'

describe('config', () => {
  describe('createConfig', () => {
    it('should use default values with no auth token', () => {
      const config = createConfig()

      assert.strictEqual(config.port, 3847)
      assert.strictEqual(config.host, 'localhost')
      // No auto-generation - localhost is safe by default
      assert.strictEqual(config.authToken, null)
      assert.strictEqual(config.repositoryPath, process.cwd())
      assert.strictEqual(config.dbPath, `${process.cwd()}/.githuman/reviews.db`)
    })

    it('should allow overriding port', () => {
      const config = createConfig({ port: 4000 })
      assert.strictEqual(config.port, 4000)
    })

    it('should allow overriding host', () => {
      const config = createConfig({ host: '0.0.0.0' })
      assert.strictEqual(config.host, '0.0.0.0')
    })

    it('should allow setting auth token with minimum length', () => {
      const validToken = 'this-is-a-valid-token-32-chars!!'
      const config = createConfig({ authToken: validToken })
      assert.strictEqual(config.authToken, validToken)
    })

    it('should reject auth token shorter than 32 characters', () => {
      assert.throws(
        () => createConfig({ authToken: 'short' }),
        /Auth token must be at least 32 characters/
      )
    })

    it('should allow overriding repository path', () => {
      const config = createConfig({ repositoryPath: '/custom/path' })
      assert.strictEqual(config.repositoryPath, '/custom/path')
      assert.strictEqual(config.dbPath, '/custom/path/.githuman/reviews.db')
    })

    it('should allow overriding db path', () => {
      const config = createConfig({ dbPath: '/custom/db.sqlite' })
      assert.strictEqual(config.dbPath, '/custom/db.sqlite')
    })

    describe('with GITHUMAN_TOKEN env var', () => {
      const originalEnv = process.env.GITHUMAN_TOKEN

      before(() => {
        process.env.GITHUMAN_TOKEN = 'env-token-that-is-at-least-32-chars'
      })

      after(() => {
        if (originalEnv === undefined) {
          delete process.env.GITHUMAN_TOKEN
        } else {
          process.env.GITHUMAN_TOKEN = originalEnv
        }
      })

      it('should use token from environment', () => {
        const config = createConfig()
        assert.strictEqual(config.authToken, 'env-token-that-is-at-least-32-chars')
      })

      it('should prefer explicit token over env var', () => {
        const explicitToken = 'explicit-token-that-is-32-chars!'
        const config = createConfig({ authToken: explicitToken })
        assert.strictEqual(config.authToken, explicitToken)
      })
    })

    describe('with short GITHUMAN_TOKEN env var', () => {
      const originalEnv = process.env.GITHUMAN_TOKEN

      before(() => {
        process.env.GITHUMAN_TOKEN = 'short'
      })

      after(() => {
        if (originalEnv === undefined) {
          delete process.env.GITHUMAN_TOKEN
        } else {
          process.env.GITHUMAN_TOKEN = originalEnv
        }
      })

      it('should reject short token from environment', () => {
        assert.throws(
          () => createConfig(),
          /Auth token must be at least 32 characters/
        )
      })
    })
  })
})
