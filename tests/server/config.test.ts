import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createConfig } from '../../src/server/config.ts';

describe('config', () => {
  describe('createConfig', () => {
    it('should use default values', () => {
      const config = createConfig();

      assert.strictEqual(config.port, 3847);
      assert.strictEqual(config.host, 'localhost');
      assert.strictEqual(config.authToken, null);
      assert.strictEqual(config.repositoryPath, process.cwd());
      assert.strictEqual(config.dbPath, `${process.cwd()}/.code-review/reviews.db`);
    });

    it('should allow overriding port', () => {
      const config = createConfig({ port: 4000 });
      assert.strictEqual(config.port, 4000);
    });

    it('should allow overriding host', () => {
      const config = createConfig({ host: '0.0.0.0' });
      assert.strictEqual(config.host, '0.0.0.0');
    });

    it('should allow setting auth token', () => {
      const config = createConfig({ authToken: 'secret' });
      assert.strictEqual(config.authToken, 'secret');
    });

    it('should allow overriding repository path', () => {
      const config = createConfig({ repositoryPath: '/custom/path' });
      assert.strictEqual(config.repositoryPath, '/custom/path');
      assert.strictEqual(config.dbPath, '/custom/path/.code-review/reviews.db');
    });

    it('should allow overriding db path', () => {
      const config = createConfig({ dbPath: '/custom/db.sqlite' });
      assert.strictEqual(config.dbPath, '/custom/db.sqlite');
    });

    describe('with CODE_REVIEW_TOKEN env var', () => {
      const originalEnv = process.env.CODE_REVIEW_TOKEN;

      before(() => {
        process.env.CODE_REVIEW_TOKEN = 'env-token';
      });

      after(() => {
        if (originalEnv === undefined) {
          delete process.env.CODE_REVIEW_TOKEN;
        } else {
          process.env.CODE_REVIEW_TOKEN = originalEnv;
        }
      });

      it('should use token from environment', () => {
        const config = createConfig();
        assert.strictEqual(config.authToken, 'env-token');
      });

      it('should prefer explicit token over env var', () => {
        const config = createConfig({ authToken: 'explicit-token' });
        assert.strictEqual(config.authToken, 'explicit-token');
      });
    });
  });
});
