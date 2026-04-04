import { after, describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { loadCliConfig } from '../../src/cli/config.ts'

function createRepo (): string {
  const dir = mkdtempSync(join(tmpdir(), 'githuman-cli-config-'))
  execSync('git init', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' })
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' })
  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })
  return dir
}

describe('cli config loader', () => {
  it('loads repo-local .githuman/config.json', () => {
    const repoDir = createRepo()
    mkdirSync(join(repoDir, '.githuman'), { recursive: true })
    writeFileSync(join(repoDir, '.githuman', 'config.json'), JSON.stringify({
      host: '0.0.0.0',
      port: 4010,
      https: true,
      open: false,
    }, null, 2))

    const loaded = loadCliConfig(repoDir)

    assert.strictEqual(loaded.repositoryPath, repoDir)
    assert.strictEqual(loaded.values.host, '0.0.0.0')
    assert.strictEqual(loaded.values.port, 4010)
    assert.strictEqual(loaded.values.https, true)
    assert.strictEqual(loaded.values.open, false)
  })

  it('returns empty values when no config file exists', () => {
    const repoDir = createRepo()
    const loaded = loadCliConfig(repoDir)

    assert.deepStrictEqual(loaded.values, {})
    assert.strictEqual(loaded.repositoryPath, repoDir)
    assert.strictEqual(loaded.configPath, join(repoDir, '.githuman', 'config.json'))
  })

  it('rejects invalid config types', () => {
    const repoDir = createRepo()
    mkdirSync(join(repoDir, '.githuman'), { recursive: true })
    writeFileSync(join(repoDir, '.githuman', 'config.json'), JSON.stringify({ port: 'bad' }))

    assert.throws(
      () => loadCliConfig(repoDir),
      /"port" must be a positive integer/
    )
  })
})
