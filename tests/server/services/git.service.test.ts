import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { GitService } from '../../../src/server/services/git.service.ts'

interface TestContext {
  after: (fn: () => void) => void;
}

function createTestRepo (t: TestContext): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'git-service-test-'))
  execSync('git init', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })

  t.after(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  return tempDir
}

function createTestRepoWithCommit (t: TestContext): string {
  const tempDir = createTestRepo(t)
  writeFileSync(join(tempDir, 'README.md'), '# Test\n')
  execSync('git add README.md', { cwd: tempDir, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })
  return tempDir
}

describe('git.service', () => {
  // Use current directory which is a git repo
  const git = new GitService(process.cwd())

  describe('getCommits', () => {
    it('should return an array of commits', async () => {
      const commits = await git.getCommits(5)

      assert.ok(Array.isArray(commits))
      assert.ok(commits.length > 0)
      assert.ok(commits.length <= 5)
    })

    it('should return commits with required properties', async () => {
      const commits = await git.getCommits(1)

      assert.strictEqual(commits.length, 1)
      const commit = commits[0]

      assert.ok(typeof commit.sha === 'string')
      assert.ok(commit.sha.length === 40, 'SHA should be 40 characters')
      assert.ok(typeof commit.message === 'string')
      assert.ok(typeof commit.author === 'string')
      assert.ok(typeof commit.date === 'string')
    })

    it('should respect the limit parameter', async () => {
      const commits3 = await git.getCommits(3)
      const commits10 = await git.getCommits(10)

      assert.ok(commits3.length <= 3)
      assert.ok(commits10.length <= 10)
      assert.ok(commits10.length >= commits3.length)
    })

    it('should return commits in order (newest first)', async () => {
      const commits = await git.getCommits(5)

      if (commits.length >= 2) {
        // Parse dates and compare - newer should come first
        const date1 = new Date(commits[0].date)
        const date2 = new Date(commits[1].date)
        assert.ok(date1 >= date2, 'Commits should be ordered newest first')
      }
    })
  })

  describe('getCommitsDiff', () => {
    it('should return empty string for empty commits array', async () => {
      const diff = await git.getCommitsDiff([])
      assert.strictEqual(diff, '')
    })

    it('should return diff for a single commit', async () => {
      const commits = await git.getCommits(1)
      assert.ok(commits.length > 0, 'Need at least one commit to test')

      const diff = await git.getCommitsDiff([commits[0].sha])

      // Diff should be a string (could be empty if commit has no changes)
      assert.ok(typeof diff === 'string')
    })

    it('should return combined diff for multiple commits', async () => {
      const commits = await git.getCommits(3)

      if (commits.length >= 2) {
        const diff = await git.getCommitsDiff([commits[0].sha, commits[1].sha])

        // Should return a string with diff content
        assert.ok(typeof diff === 'string')
      }
    })

    it('should handle commits in any order', async () => {
      const commits = await git.getCommits(3)

      if (commits.length >= 2) {
        // Order shouldn't matter - we combine individual diffs
        const diff1 = await git.getCommitsDiff([commits[0].sha, commits[1].sha])
        const diff2 = await git.getCommitsDiff([commits[1].sha, commits[0].sha])

        // Both should be valid strings
        assert.ok(typeof diff1 === 'string')
        assert.ok(typeof diff2 === 'string')
      }
    })
  })

  describe('getBranches', () => {
    it('should return an array of branches', async () => {
      const branches = await git.getBranches()

      assert.ok(Array.isArray(branches))
      assert.ok(branches.length > 0, 'Should have at least one branch')
    })

    it('should have one current branch', async () => {
      const branches = await git.getBranches()
      const currentBranches = branches.filter(b => b.isCurrent)

      assert.strictEqual(currentBranches.length, 1, 'Should have exactly one current branch')
    })

    it('should return branches with required properties', async () => {
      const branches = await git.getBranches()

      for (const branch of branches) {
        assert.ok(typeof branch.name === 'string')
        assert.ok(typeof branch.isRemote === 'boolean')
        assert.ok(typeof branch.isCurrent === 'boolean')
      }
    })
  })

  describe('isRepo', () => {
    it('should return true for a git repository', async () => {
      const result = await git.isRepo()
      assert.strictEqual(result, true)
    })

    it('should return false for a non-git directory', async () => {
      const nonGit = new GitService('/tmp')
      const result = await nonGit.isRepo()
      assert.strictEqual(result, false)
    })
  })

  describe('hasCommits', () => {
    it('should return true for a repository with commits', async () => {
      const result = await git.hasCommits()
      assert.strictEqual(result, true)
    })

    it('should return false for a non-git directory', async () => {
      const nonGit = new GitService('/tmp')
      const result = await nonGit.hasCommits()
      assert.strictEqual(result, false)
    })
  })

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await git.getCurrentBranch()

      assert.ok(typeof branch === 'string')
      assert.ok(branch.length > 0)
    })
  })

  describe('getUnstagedFiles', () => {
    it('should return empty array when no unstaged changes', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const files = await testGit.getUnstagedFiles()
      assert.deepStrictEqual(files, [])
    })

    it('should return modified files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Modify the file
      writeFileSync(join(tempDir, 'README.md'), '# Updated\n')

      const files = await testGit.getUnstagedFiles()
      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0].path, 'README.md')
      assert.strictEqual(files[0].status, 'modified')
    })

    it('should return untracked files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a new file
      writeFileSync(join(tempDir, 'new-file.txt'), 'new content\n')

      const files = await testGit.getUnstagedFiles()
      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0].path, 'new-file.txt')
      assert.strictEqual(files[0].status, 'untracked')
    })
  })

  describe('hasUnstagedChanges', () => {
    it('should return false when no unstaged changes', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const result = await testGit.hasUnstagedChanges()
      assert.strictEqual(result, false)
    })

    it('should return true when there are modified files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'README.md'), '# Updated\n')

      const result = await testGit.hasUnstagedChanges()
      assert.strictEqual(result, true)
    })

    it('should return true when there are untracked files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')

      const result = await testGit.hasUnstagedChanges()
      assert.strictEqual(result, true)
    })
  })

  describe('getUnstagedDiff', () => {
    it('should return empty string when no unstaged changes', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const diff = await testGit.getUnstagedDiff()
      assert.strictEqual(diff, '')
    })

    it('should return diff for modified files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'README.md'), '# Updated content\n')

      const diff = await testGit.getUnstagedDiff()
      assert.ok(diff.includes('README.md'))
      assert.ok(diff.includes('-# Test'))
      assert.ok(diff.includes('+# Updated content'))
    })

    it('should include untracked files in diff', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a new untracked file
      writeFileSync(join(tempDir, 'new-file.txt'), 'line 1\nline 2\n')

      const diff = await testGit.getUnstagedDiff()
      assert.ok(diff.includes('new-file.txt'), 'should include new file name')
      assert.ok(diff.includes('new file mode'), 'should indicate new file')
      assert.ok(diff.includes('+line 1'), 'should show new file content as added')
      assert.ok(diff.includes('+line 2'), 'should show all lines as added')
    })
  })

  describe('stageFile', () => {
    it('should stage a single file', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')

      // Should have unstaged changes
      assert.strictEqual(await testGit.hasUnstagedChanges(), true)
      assert.strictEqual(await testGit.hasStagedChanges(), false)

      await testGit.stageFile('new-file.txt')

      // Now should have staged changes
      assert.strictEqual(await testGit.hasStagedChanges(), true)
    })
  })

  describe('stageFiles', () => {
    it('should stage multiple files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'file1.txt'), 'content1\n')
      writeFileSync(join(tempDir, 'file2.txt'), 'content2\n')

      await testGit.stageFiles(['file1.txt', 'file2.txt'])

      const stagedFiles = await testGit.getStagedFiles()
      const stagedPaths = stagedFiles.map(f => f.path)
      assert.ok(stagedPaths.includes('file1.txt'), 'file1.txt should be staged')
      assert.ok(stagedPaths.includes('file2.txt'), 'file2.txt should be staged')
    })

    it('should do nothing when passed empty array', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      await testGit.stageFiles([])

      assert.strictEqual(await testGit.hasStagedChanges(), false)
    })
  })

  describe('stageAll', () => {
    it('should stage all changes including untracked files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'README.md'), '# Updated\n')
      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')

      // Verify we have unstaged changes before
      assert.strictEqual(await testGit.hasUnstagedChanges(), true)
      assert.strictEqual(await testGit.hasStagedChanges(), false)

      await testGit.stageAll()

      // Verify files are now staged
      assert.strictEqual(await testGit.hasStagedChanges(), true)
      const stagedFiles = await testGit.getStagedFiles()
      const stagedPaths = stagedFiles.map(f => f.path)
      assert.ok(stagedPaths.includes('README.md'), 'README.md should be staged')
      assert.ok(stagedPaths.includes('new-file.txt'), 'new-file.txt should be staged')
    })
  })

  describe('unstageFile', () => {
    it('should unstage a file', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')
      await testGit.stageFile('new-file.txt')

      assert.strictEqual(await testGit.hasStagedChanges(), true)

      await testGit.unstageFile('new-file.txt')

      assert.strictEqual(await testGit.hasStagedChanges(), false)
      assert.strictEqual(await testGit.hasUnstagedChanges(), true)
    })
  })
})
