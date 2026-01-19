import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { ReviewService, ReviewError } from '../../../src/server/services/review.service.ts'
import { ReviewFileRepository } from '../../../src/server/repositories/review-file.repo.ts'
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts'
import { migrate, migrations } from '../../../src/server/db/migrations.ts'

interface TestContext {
  after: (fn: () => void) => void;
}

function createTestRepo (t: TestContext): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'review-service-test-'))
  execSync('git init', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' })
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' })

  // Create initial commit
  writeFileSync(join(tempDir, 'README.md'), '# Test\n')
  execSync('git add README.md', { cwd: tempDir, stdio: 'ignore' })
  execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'ignore' })

  t.after(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  return tempDir
}

describe('ReviewService', () => {
  let db: DatabaseSync
  let fileRepo: ReviewFileRepository

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, migrations)
    fileRepo = new ReviewFileRepository(db)
  })

  after(() => {
    db?.close()
  })

  describe('create', () => {
    it('should create a staged review with files in review_files table', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'staged' })

      // Verify review was created
      assert.ok(review.id)
      assert.strictEqual(review.sourceType, 'staged')
      assert.strictEqual(review.files.length, 1)
      assert.strictEqual(review.files[0].newPath, 'test.ts')
      assert.strictEqual(review.files[0].status, 'added')

      // Verify files are stored in review_files table
      const files = fileRepo.findByReview(review.id)
      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0].filePath, 'test.ts')

      // Verify hunks are stored for staged review
      const file = fileRepo.findByReviewAndPath(review.id, 'test.ts')
      assert.ok(file)
      assert.ok(file.hunksData, 'Hunks should be stored for staged review')
    })

    it('should create a commits review WITHOUT hunks stored', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Add a file and commit
      writeFileSync(join(tempDir, 'feature.ts'), 'const y = 2;\n')
      execSync('git add feature.ts && git commit -m "Add feature"', { cwd: tempDir, stdio: 'ignore' })

      // Get the commit SHA
      const sha = execSync('git rev-parse HEAD', { cwd: tempDir }).toString().trim()

      const review = await service.create({ sourceType: 'commits', sourceRef: sha })

      // Verify review was created
      assert.ok(review.id)
      assert.strictEqual(review.sourceType, 'commits')
      assert.strictEqual(review.files.length, 1)

      // Verify files are stored in review_files table
      const files = fileRepo.findByReview(review.id)
      assert.strictEqual(files.length, 1)

      // Verify hunks are NOT stored for committed review (regenerated from git)
      const file = fileRepo.findByReviewAndPath(review.id, 'feature.ts')
      assert.ok(file)
      assert.strictEqual(file.hunksData, null, 'Hunks should NOT be stored for committed review')
    })

    it('should create a branch review WITHOUT hunks stored', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Create a feature branch with changes
      execSync('git checkout -b feature', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'branch-file.ts'), 'const z = 3;\n')
      execSync('git add branch-file.ts && git commit -m "Add branch file"', { cwd: tempDir, stdio: 'ignore' })

      // Go back to main
      execSync('git checkout master || git checkout main', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'branch', sourceRef: 'feature' })

      // Verify review was created
      assert.ok(review.id)
      assert.strictEqual(review.sourceType, 'branch')
      assert.strictEqual(review.files.length, 1)

      // Verify hunks are NOT stored for branch review
      const file = fileRepo.findByReviewAndPath(review.id, 'branch-file.ts')
      assert.ok(file)
      assert.strictEqual(file.hunksData, null, 'Hunks should NOT be stored for branch review')
    })

    it('should throw error when no staged changes', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      await assert.rejects(
        () => service.create({ sourceType: 'staged' }),
        (err: Error) => {
          assert.ok(err instanceof ReviewError)
          assert.strictEqual((err as ReviewError).code, 'NO_STAGED_CHANGES')
          return true
        }
      )
    })
  })

  describe('getById', () => {
    it('should return files without hunks property', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      const created = await service.create({ sourceType: 'staged' })
      const review = service.getById(created.id)

      assert.ok(review)
      assert.strictEqual(review.files.length, 1)

      // Files should have metadata only, not hunks
      const file = review.files[0]
      assert.ok('newPath' in file)
      assert.ok('status' in file)
      assert.ok('additions' in file)
      assert.ok('deletions' in file)
      // hunks should NOT be in the file metadata
      assert.strictEqual('hunks' in file, false)
    })

    it('should return null for non-existent review', (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      const review = service.getById('non-existent-id')
      assert.strictEqual(review, null)
    })
  })

  describe('getFileHunks', () => {
    it('should return hunks for staged review from database', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\nconst y = 2;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'staged' })

      const hunks = await service.getFileHunks(review.id, 'test.ts')

      assert.ok(Array.isArray(hunks))
      assert.ok(hunks.length > 0)
      assert.ok('oldStart' in hunks[0])
      assert.ok('newStart' in hunks[0])
      assert.ok('lines' in hunks[0])
    })

    it('should regenerate hunks for committed review from git', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Add a file and commit
      writeFileSync(join(tempDir, 'feature.ts'), 'const y = 2;\n')
      execSync('git add feature.ts && git commit -m "Add feature"', { cwd: tempDir, stdio: 'ignore' })

      const sha = execSync('git rev-parse HEAD', { cwd: tempDir }).toString().trim()
      const review = await service.create({ sourceType: 'commits', sourceRef: sha })

      // Hunks should be regenerated from git (not stored)
      const hunks = await service.getFileHunks(review.id, 'feature.ts')

      assert.ok(Array.isArray(hunks))
      assert.ok(hunks.length > 0)
    })

    it('should regenerate hunks for branch review from git', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Create a feature branch with changes
      execSync('git checkout -b feature', { cwd: tempDir, stdio: 'ignore' })
      writeFileSync(join(tempDir, 'branch-file.ts'), 'const z = 3;\n')
      execSync('git add branch-file.ts && git commit -m "Add branch file"', { cwd: tempDir, stdio: 'ignore' })

      // Go back to main
      execSync('git checkout master || git checkout main', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'branch', sourceRef: 'feature' })

      // Hunks should be regenerated from git
      const hunks = await service.getFileHunks(review.id, 'branch-file.ts')

      assert.ok(Array.isArray(hunks))
      assert.ok(hunks.length > 0)
    })

    it('should return empty array for non-existent file', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'staged' })

      const hunks = await service.getFileHunks(review.id, 'non-existent.ts')
      assert.deepStrictEqual(hunks, [])
    })

    it('should throw error for non-existent review', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      await assert.rejects(
        () => service.getFileHunks('non-existent-id', 'test.ts'),
        (err: Error) => {
          assert.ok(err instanceof ReviewError)
          assert.strictEqual((err as ReviewError).code, 'NOT_FOUND')
          return true
        }
      )
    })
  })

  describe('backward compatibility', () => {
    it('should handle legacy snapshot format with embedded files', (t) => {
      const tempDir = createTestRepo(t)
      const reviewRepo = new ReviewRepository(db)

      // Create a legacy review directly in the database
      const legacySnapshotData = JSON.stringify({
        files: [
          {
            oldPath: 'legacy.ts',
            newPath: 'legacy.ts',
            status: 'modified',
            additions: 5,
            deletions: 2,
            hunks: [
              {
                oldStart: 1,
                oldLines: 2,
                newStart: 1,
                newLines: 5,
                lines: [
                  { type: 'context', content: 'const x = 1;', oldLineNumber: 1, newLineNumber: 1 },
                  { type: 'removed', content: 'const y = 2;', oldLineNumber: 2, newLineNumber: null },
                  { type: 'added', content: 'const y = 3;', oldLineNumber: null, newLineNumber: 2 },
                ],
              },
            ],
          },
        ],
        repository: {
          name: 'test-repo',
          branch: 'main',
          remote: null,
          path: tempDir,
        },
      })

      reviewRepo.create({
        id: 'legacy-review-1',
        repositoryPath: tempDir,
        baseRef: 'abc123',
        sourceType: 'staged',
        sourceRef: null,
        snapshotData: legacySnapshotData,
        status: 'in_progress',
      })

      const service = new ReviewService(db, tempDir)

      // getById should work with legacy format
      const review = service.getById('legacy-review-1')
      assert.ok(review)
      assert.strictEqual(review.files.length, 1)
      assert.strictEqual(review.files[0].newPath, 'legacy.ts')
      assert.strictEqual(review.summary.totalAdditions, 5)
      assert.strictEqual(review.summary.totalDeletions, 2)
    })

    it('should return hunks from legacy snapshot for staged reviews', async (t) => {
      const tempDir = createTestRepo(t)
      const reviewRepo = new ReviewRepository(db)

      // Create a legacy review directly in the database
      const legacySnapshotData = JSON.stringify({
        files: [
          {
            oldPath: 'legacy.ts',
            newPath: 'legacy.ts',
            status: 'modified',
            additions: 1,
            deletions: 0,
            hunks: [
              {
                oldStart: 1,
                oldLines: 1,
                newStart: 1,
                newLines: 2,
                lines: [
                  { type: 'context', content: 'const x = 1;', oldLineNumber: 1, newLineNumber: 1 },
                  { type: 'added', content: 'const y = 2;', oldLineNumber: null, newLineNumber: 2 },
                ],
              },
            ],
          },
        ],
        repository: {
          name: 'test-repo',
          branch: 'main',
          remote: null,
          path: tempDir,
        },
      })

      reviewRepo.create({
        id: 'legacy-review-2',
        repositoryPath: tempDir,
        baseRef: 'abc123',
        sourceType: 'staged',
        sourceRef: null,
        snapshotData: legacySnapshotData,
        status: 'in_progress',
      })

      const service = new ReviewService(db, tempDir)

      // getFileHunks should return hunks from legacy snapshot
      const hunks = await service.getFileHunks('legacy-review-2', 'legacy.ts')
      assert.strictEqual(hunks.length, 1)
      assert.strictEqual(hunks[0].lines.length, 2)
    })
  })

  describe('delete', () => {
    it('should delete review and its files', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      const review = await service.create({ sourceType: 'staged' })

      // Verify files exist
      assert.strictEqual(fileRepo.findByReview(review.id).length, 1)

      // Delete the review
      const deleted = service.delete(review.id)
      assert.strictEqual(deleted, true)

      // Verify review is gone
      assert.strictEqual(service.getById(review.id), null)

      // Verify files are gone
      assert.strictEqual(fileRepo.findByReview(review.id).length, 0)
    })
  })

  describe('list', () => {
    it('should return reviews with summary', async (t) => {
      const tempDir = createTestRepo(t)
      const service = new ReviewService(db, tempDir)

      // Stage a change
      writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;\n')
      execSync('git add test.ts', { cwd: tempDir, stdio: 'ignore' })

      await service.create({ sourceType: 'staged' })

      const result = service.list()

      assert.strictEqual(result.reviews.length, 1)
      assert.ok(result.reviews[0].summary)
      assert.strictEqual(result.reviews[0].summary.totalFiles, 1)
    })
  })
})
