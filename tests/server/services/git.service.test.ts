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
      const result = await git.getCommits({ limit: 5 })

      assert.ok(Array.isArray(result.commits))
      assert.ok(result.commits.length > 0)
      assert.ok(result.commits.length <= 5)
      assert.ok(typeof result.hasMore === 'boolean')
    })

    it('should return commits with required properties', async () => {
      const result = await git.getCommits({ limit: 1 })

      assert.strictEqual(result.commits.length, 1)
      const commit = result.commits[0]

      assert.ok(typeof commit.sha === 'string')
      assert.ok(commit.sha.length === 40, 'SHA should be 40 characters')
      assert.ok(typeof commit.message === 'string')
      assert.ok(typeof commit.author === 'string')
      assert.ok(typeof commit.date === 'string')
    })

    it('should respect the limit parameter', async () => {
      const result3 = await git.getCommits({ limit: 3 })
      const result10 = await git.getCommits({ limit: 10 })

      assert.ok(result3.commits.length <= 3)
      assert.ok(result10.commits.length <= 10)
      assert.ok(result10.commits.length >= result3.commits.length)
    })

    it('should return commits in order (newest first)', async () => {
      const result = await git.getCommits({ limit: 5 })

      if (result.commits.length >= 2) {
        // Parse dates and compare - newer should come first
        const date1 = new Date(result.commits[0].date)
        const date2 = new Date(result.commits[1].date)
        assert.ok(date1 >= date2, 'Commits should be ordered newest first')
      }
    })

    it('should support offset for pagination', async () => {
      const firstPage = await git.getCommits({ limit: 2, offset: 0 })
      const secondPage = await git.getCommits({ limit: 2, offset: 2 })

      // If there are enough commits, the pages should be different
      if (firstPage.commits.length >= 2 && secondPage.commits.length >= 1) {
        assert.notStrictEqual(firstPage.commits[0].sha, secondPage.commits[0].sha)
      }
    })

    it('should indicate hasMore when there are more commits', async () => {
      const result = await git.getCommits({ limit: 1 })

      // This repo should have more than 1 commit, so hasMore should be true
      assert.strictEqual(result.hasMore, true)
    })
  })

  describe('getCommitsDiff', () => {
    it('should return empty string for empty commits array', async () => {
      const diff = await git.getCommitsDiff([])
      assert.strictEqual(diff, '')
    })

    it('should return diff for a single commit', async () => {
      const result = await git.getCommits({ limit: 1 })
      assert.ok(result.commits.length > 0, 'Need at least one commit to test')

      const diff = await git.getCommitsDiff([result.commits[0].sha])

      // Diff should be a string (could be empty if commit has no changes)
      assert.ok(typeof diff === 'string')
    })

    it('should return combined diff for multiple commits', async () => {
      const result = await git.getCommits({ limit: 3 })

      if (result.commits.length >= 2) {
        const diff = await git.getCommitsDiff([result.commits[0].sha, result.commits[1].sha])

        // Should return a string with diff content
        assert.ok(typeof diff === 'string')
      }
    })

    it('should handle commits in any order', async () => {
      const result = await git.getCommits({ limit: 3 })

      if (result.commits.length >= 2) {
        // Order shouldn't matter - we combine individual diffs
        const diff1 = await git.getCommitsDiff([result.commits[0].sha, result.commits[1].sha])
        const diff2 = await git.getCommitsDiff([result.commits[1].sha, result.commits[0].sha])

        // Both should be valid strings
        assert.ok(typeof diff1 === 'string')
        assert.ok(typeof diff2 === 'string')
      }
    })
  })

  describe('getCommitsFileDiff', () => {
    it('should return empty string for empty commits array', async () => {
      const diff = await git.getCommitsFileDiff([], 'some-file.ts')
      assert.strictEqual(diff, '')
    })

    it('should return diff for a specific file in a commit', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Add a new file and commit
      writeFileSync(join(tempDir, 'src.ts'), 'const x = 1;\n')
      execSync('git add src.ts && git commit -m "Add src.ts"', { cwd: tempDir, stdio: 'ignore' })

      // Get the commit SHA
      const result = await testGit.getCommits({ limit: 1 })
      const sha = result.commits[0].sha

      const diff = await testGit.getCommitsFileDiff([sha], 'src.ts')
      assert.ok(diff.includes('src.ts'))
      assert.ok(diff.includes('+const x = 1;'))
    })

    it('should return empty string for non-existent file', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const result = await testGit.getCommits({ limit: 1 })
      const sha = result.commits[0].sha

      const diff = await testGit.getCommitsFileDiff([sha], 'non-existent.ts')
      assert.strictEqual(diff, '')
    })

    it('should combine diffs from multiple commits for same file', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // First commit: add file
      writeFileSync(join(tempDir, 'src.ts'), 'const x = 1;\n')
      execSync('git add src.ts && git commit -m "Add src.ts"', { cwd: tempDir, stdio: 'ignore' })

      // Second commit: modify file
      writeFileSync(join(tempDir, 'src.ts'), 'const x = 2;\n')
      execSync('git add src.ts && git commit -m "Modify src.ts"', { cwd: tempDir, stdio: 'ignore' })

      // Get both commits
      const result = await testGit.getCommits({ limit: 2 })
      const shas = result.commits.map(c => c.sha)

      const diff = await testGit.getCommitsFileDiff(shas, 'src.ts')
      // Should have diffs from both commits
      assert.ok(typeof diff === 'string')
      assert.ok(diff.includes('src.ts'))
    })
  })

  describe('getBranchFileDiff', () => {
    it('should return diff for a specific file between branches', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a feature branch with changes
      execSync('git checkout -b feature', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'feature.ts'), 'const y = 1;\n')
      execSync('git add feature.ts && git commit -m "Add feature.ts"', { cwd: tempDir, stdio: 'ignore' })

      // Go back to main
      execSync('git checkout master || git checkout main', { cwd: tempDir, stdio: 'ignore' })

      const diff = await testGit.getBranchFileDiff('feature', 'feature.ts')
      assert.ok(diff.includes('feature.ts'))
      assert.ok(diff.includes('+const y = 1;'))
    })

    it('should return empty string for file not changed in branch', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a feature branch with changes to a different file
      execSync('git checkout -b feature', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'other.ts'), 'const z = 1;\n')
      execSync('git add other.ts && git commit -m "Add other.ts"', { cwd: tempDir, stdio: 'ignore' })

      // Go back to main
      execSync('git checkout master || git checkout main', { cwd: tempDir, stdio: 'ignore' })

      // Request diff for a file that wasn't changed
      const diff = await testGit.getBranchFileDiff('feature', 'README.md')
      assert.strictEqual(diff.trim(), '')
    })

    it('should return empty string for non-existent branch', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const diff = await testGit.getBranchFileDiff('non-existent-branch', 'README.md')
      assert.strictEqual(diff, '')
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

  describe('getFilesAtRef', () => {
    it('should return all files at HEAD', async () => {
      const files = await git.getFilesAtRef('HEAD')

      assert.ok(Array.isArray(files))
      assert.ok(files.length > 0, 'Should have at least one file')
      assert.ok(files.includes('package.json'), 'Should include package.json')
    })

    it('should return files at a specific commit SHA', async () => {
      const result = await git.getCommits({ limit: 1 })
      assert.ok(result.commits.length > 0, 'Need at least one commit to test')

      const files = await git.getFilesAtRef(result.commits[0].sha)

      assert.ok(Array.isArray(files))
      assert.ok(files.length > 0)
    })

    it('should throw for invalid ref', async () => {
      await assert.rejects(
        async () => git.getFilesAtRef('invalid-ref-that-does-not-exist-xyz'),
        { message: /fatal|not a valid/ }
      )
    })

    it('should return files from test repo', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Add another file and commit - create dir first
      execSync('mkdir -p src', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'src/index.ts'), 'export const x = 1;\n')
      execSync('git add src/index.ts && git commit -m "Add src"', {
        cwd: tempDir,
        stdio: 'ignore',
      })

      const files = await testGit.getFilesAtRef('HEAD')

      assert.ok(files.includes('README.md'), 'Should include README.md')
      assert.ok(files.includes('src/index.ts'), 'Should include src/index.ts')
      assert.strictEqual(files.length, 2)
    })
  })

  describe('getWorkingDirectoryNewFiles', () => {
    it('should return empty array when no new files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.deepStrictEqual(files, [])
    })

    it('should return untracked files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a new untracked file
      writeFileSync(join(tempDir, 'new-file.txt'), 'content\n')

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.ok(files.includes('new-file.txt'), 'Should include untracked file')
    })

    it('should return staged new files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create and stage a new file
      writeFileSync(join(tempDir, 'staged-new.txt'), 'content\n')
      execSync('git add staged-new.txt', { cwd: tempDir, stdio: 'ignore' })

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.ok(files.includes('staged-new.txt'), 'Should include staged new file')
    })

    it('should return both untracked and staged new files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create an untracked file
      writeFileSync(join(tempDir, 'untracked.txt'), 'content\n')

      // Create and stage a new file
      writeFileSync(join(tempDir, 'staged.txt'), 'content\n')
      execSync('git add staged.txt', { cwd: tempDir, stdio: 'ignore' })

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.ok(files.includes('untracked.txt'), 'Should include untracked file')
      assert.ok(files.includes('staged.txt'), 'Should include staged new file')
      assert.strictEqual(files.length, 2)
    })

    it('should not include modified files', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Modify an existing tracked file
      writeFileSync(join(tempDir, 'README.md'), '# Updated\n')

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.ok(!files.includes('README.md'), 'Should not include modified file')
      assert.strictEqual(files.length, 0)
    })

    it('should handle files in subdirectories', async (t) => {
      const tempDir = createTestRepoWithCommit(t)
      const testGit = new GitService(tempDir)

      // Create a new file in a subdirectory
      execSync('mkdir -p src/utils', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'src/utils/helper.ts'), 'export const x = 1;\n')

      const files = await testGit.getWorkingDirectoryNewFiles()
      assert.ok(files.includes('src/utils/helper.ts'), 'Should include file with full path')
    })
  })
})
