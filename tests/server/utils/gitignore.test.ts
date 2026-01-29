import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findGitignoreFiles, loadGitignore } from '../../../src/server/utils/gitignore.ts'

interface TestContext {
  after: (fn: () => void) => void;
}

function createTempDir (t: TestContext): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'gitignore-test-'))
  t.after(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })
  return tempDir
}

describe('gitignore utils', () => {
  describe('findGitignoreFiles', () => {
    it('should find root .gitignore', async (t) => {
      const tempDir = createTempDir(t)
      writeFileSync(join(tempDir, '.gitignore'), '*.log\n')

      const files = await findGitignoreFiles(tempDir)

      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0], join(tempDir, '.gitignore'))
    })

    it('should find nested .gitignore files sorted by depth', async (t) => {
      const tempDir = createTempDir(t)
      mkdirSync(join(tempDir, 'src'))
      mkdirSync(join(tempDir, 'src', 'deep'))

      writeFileSync(join(tempDir, '.gitignore'), '*.log\n')
      writeFileSync(join(tempDir, 'src', '.gitignore'), 'build/\n')
      writeFileSync(join(tempDir, 'src', 'deep', '.gitignore'), 'temp/\n')

      const files = await findGitignoreFiles(tempDir)

      assert.strictEqual(files.length, 3)
      // Should be sorted by depth (root first)
      assert.ok(files[0].endsWith('.gitignore'))
      assert.ok(!files[0].includes('src'))
      assert.ok(files[1].includes('src'))
      assert.ok(!files[1].includes('deep'))
      assert.ok(files[2].includes('deep'))
    })

    it('should skip node_modules directory', async (t) => {
      const tempDir = createTempDir(t)
      mkdirSync(join(tempDir, 'node_modules'))

      writeFileSync(join(tempDir, '.gitignore'), '*.log\n')
      writeFileSync(join(tempDir, 'node_modules', '.gitignore'), 'should-be-skipped\n')

      const files = await findGitignoreFiles(tempDir)

      assert.strictEqual(files.length, 1)
      assert.ok(!files[0].includes('node_modules'))
    })
  })

  describe('loadGitignore', () => {
    it('should always ignore .git directory', async (t) => {
      const tempDir = createTempDir(t)

      const ig = await loadGitignore(tempDir)

      assert.strictEqual(ig.ignores('.git'), true)
      assert.strictEqual(ig.ignores('.git/config'), true)
    })

    it('should load patterns from root .gitignore', async (t) => {
      const tempDir = createTempDir(t)
      writeFileSync(join(tempDir, '.gitignore'), '*.log\ndist/\n')

      const ig = await loadGitignore(tempDir)

      assert.strictEqual(ig.ignores('app.log'), true)
      assert.strictEqual(ig.ignores('dist/bundle.js'), true)
      assert.strictEqual(ig.ignores('src/app.ts'), false)
    })

    it('should prefix patterns from nested .gitignore', async (t) => {
      const tempDir = createTempDir(t)
      mkdirSync(join(tempDir, 'src'))

      writeFileSync(join(tempDir, 'src', '.gitignore'), 'build/\n')

      const ig = await loadGitignore(tempDir)

      // Should ignore src/build/ but not root build/
      assert.strictEqual(ig.ignores('src/build/output.js'), true)
      assert.strictEqual(ig.ignores('build/output.js'), false)
    })

    it('should handle rooted patterns in nested .gitignore', async (t) => {
      const tempDir = createTempDir(t)
      mkdirSync(join(tempDir, 'src'))

      // Leading slash should be stripped for nested .gitignore
      writeFileSync(join(tempDir, 'src', '.gitignore'), '/build\n')

      const ig = await loadGitignore(tempDir)

      assert.strictEqual(ig.ignores('src/build'), true)
    })

    it('should handle negation patterns in nested .gitignore', async (t) => {
      const tempDir = createTempDir(t)
      mkdirSync(join(tempDir, 'src'))

      writeFileSync(join(tempDir, '.gitignore'), '*.log\n')
      writeFileSync(join(tempDir, 'src', '.gitignore'), '!important.log\n')

      const ig = await loadGitignore(tempDir)

      assert.strictEqual(ig.ignores('app.log'), true)
      assert.strictEqual(ig.ignores('src/important.log'), false)
    })

    it('should skip comments and empty lines', async (t) => {
      const tempDir = createTempDir(t)
      writeFileSync(join(tempDir, '.gitignore'), '# This is a comment\n\n*.log\n')

      const ig = await loadGitignore(tempDir)

      assert.strictEqual(ig.ignores('app.log'), true)
      assert.strictEqual(ig.ignores('# This is a comment'), false)
    })
  })
})
