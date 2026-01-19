import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert'
import { DatabaseSync } from 'node:sqlite'
import { ReviewFileRepository } from '../../../src/server/repositories/review-file.repo.ts'
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts'
import { migrate, migrations } from '../../../src/server/db/migrations.ts'

describe('ReviewFileRepository', () => {
  let db: DatabaseSync
  let repo: ReviewFileRepository
  let reviewRepo: ReviewRepository
  let testReviewId: string

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    migrate(db, migrations)
    repo = new ReviewFileRepository(db)
    reviewRepo = new ReviewRepository(db)

    // Create a test review to attach files to
    const review = reviewRepo.create({
      id: 'test-review-1',
      repositoryPath: '/test/path',
      baseRef: 'abc123',
      sourceType: 'staged',
      sourceRef: null,
      snapshotData: '{}',
      status: 'in_progress',
    })
    testReviewId = review.id
  })

  after(() => {
    db?.close()
  })

  describe('create', () => {
    it('should create a file and return it', () => {
      const file = repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        oldPath: null,
        status: 'modified',
        additions: 10,
        deletions: 5,
        hunksData: JSON.stringify([{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 10, lines: [] }]),
      })

      assert.strictEqual(file.id, 'file-1')
      assert.strictEqual(file.reviewId, testReviewId)
      assert.strictEqual(file.filePath, 'src/index.ts')
      assert.strictEqual(file.oldPath, null)
      assert.strictEqual(file.status, 'modified')
      assert.strictEqual(file.additions, 10)
      assert.strictEqual(file.deletions, 5)
      assert.ok(file.hunksData)
      assert.ok(file.createdAt)
    })

    it('should create a renamed file with oldPath', () => {
      const file = repo.create({
        id: 'file-2',
        reviewId: testReviewId,
        filePath: 'src/newname.ts',
        oldPath: 'src/oldname.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      })

      assert.strictEqual(file.oldPath, 'src/oldname.ts')
      assert.strictEqual(file.status, 'renamed')
    })

    it('should create a file without hunks data', () => {
      const file = repo.create({
        id: 'file-3',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'added',
        additions: 100,
        deletions: 0,
      })

      assert.strictEqual(file.hunksData, null)
    })
  })

  describe('createBulk', () => {
    it('should create multiple files in a transaction', () => {
      repo.createBulk([
        {
          id: 'file-1',
          reviewId: testReviewId,
          filePath: 'src/a.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          hunksData: '[]',
        },
        {
          id: 'file-2',
          reviewId: testReviewId,
          filePath: 'src/b.ts',
          status: 'modified',
          additions: 5,
          deletions: 3,
          hunksData: '[]',
        },
        {
          id: 'file-3',
          reviewId: testReviewId,
          filePath: 'src/c.ts',
          status: 'deleted',
          additions: 0,
          deletions: 20,
          hunksData: '[]',
        },
      ])

      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 3)
    })

    it('should handle empty array', () => {
      repo.createBulk([])
      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 0)
    })

    it('should rollback on error', () => {
      // Create first file
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
      })

      // Try to create bulk with duplicate id - should fail due to PRIMARY KEY constraint
      assert.throws(() => {
        repo.createBulk([
          {
            id: 'file-2',
            reviewId: testReviewId,
            filePath: 'src/b.ts',
            status: 'added',
            additions: 5,
            deletions: 0,
          },
          {
            id: 'file-1', // Duplicate id
            reviewId: testReviewId,
            filePath: 'src/c.ts',
            status: 'added',
            additions: 3,
            deletions: 0,
          },
        ])
      })

      // Only the original file should exist (file-2 should be rolled back)
      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 1)
      assert.strictEqual(files[0].filePath, 'src/a.ts')
    })
  })

  describe('findByReview', () => {
    it('should return all files for a review', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
        hunksData: '[{"oldStart":1,"oldLines":0,"newStart":1,"newLines":10,"lines":[]}]',
      })
      repo.create({
        id: 'file-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        status: 'modified',
        additions: 5,
        deletions: 3,
        hunksData: '[{"oldStart":1,"oldLines":3,"newStart":1,"newLines":5,"lines":[]}]',
      })

      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 2)
    })

    it('should return metadata without hunks', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        hunksData: '[{"oldStart":1,"oldLines":5,"newStart":1,"newLines":10,"lines":[]}]',
      })

      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 1)
      // Metadata should not include hunksData
      assert.strictEqual('hunksData' in files[0], false)
    })

    it('should return files ordered by path', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/z.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
      })
      repo.create({
        id: 'file-2',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
      })
      repo.create({
        id: 'file-3',
        reviewId: testReviewId,
        filePath: 'src/m.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
      })

      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files[0].filePath, 'src/a.ts')
      assert.strictEqual(files[1].filePath, 'src/m.ts')
      assert.strictEqual(files[2].filePath, 'src/z.ts')
    })

    it('should return empty array for review with no files', () => {
      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 0)
    })
  })

  describe('findByReviewAndPath', () => {
    it('should return correct file with hunks', () => {
      const hunksData = '[{"oldStart":1,"oldLines":5,"newStart":1,"newLines":10,"lines":[]}]'
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        hunksData,
      })

      const file = repo.findByReviewAndPath(testReviewId, 'src/index.ts')
      assert.ok(file)
      assert.strictEqual(file.filePath, 'src/index.ts')
      assert.strictEqual(file.hunksData, hunksData)
    })

    it('should return null for non-existent path', () => {
      const file = repo.findByReviewAndPath(testReviewId, 'non-existent.ts')
      assert.strictEqual(file, null)
    })

    it('should return null for wrong review id', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      })

      const file = repo.findByReviewAndPath('wrong-review-id', 'src/index.ts')
      assert.strictEqual(file, null)
    })
  })

  describe('deleteByReview', () => {
    it('should delete all files for a review', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
      })
      repo.create({
        id: 'file-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        status: 'modified',
        additions: 5,
        deletions: 3,
      })

      const count = repo.deleteByReview(testReviewId)
      assert.strictEqual(count, 2)
      assert.strictEqual(repo.findByReview(testReviewId).length, 0)
    })

    it('should return 0 when no files to delete', () => {
      const count = repo.deleteByReview(testReviewId)
      assert.strictEqual(count, 0)
    })
  })

  describe('cascade delete', () => {
    it('should delete files when review is deleted', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      })

      // Delete the review
      reviewRepo.delete(testReviewId)

      // Files should be gone too
      const files = repo.findByReview(testReviewId)
      assert.strictEqual(files.length, 0)
    })
  })

  describe('unique constraint', () => {
    it('should enforce unique constraint on review_id and file_path', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
      })

      // Try to create another file with same review_id and file_path
      assert.throws(() => {
        repo.create({
          id: 'file-2',
          reviewId: testReviewId,
          filePath: 'src/index.ts', // Same path
          status: 'added',
          additions: 5,
          deletions: 0,
        })
      })
    })
  })

  describe('countByReview', () => {
    it('should return correct count', () => {
      repo.create({
        id: 'file-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
      })
      repo.create({
        id: 'file-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        status: 'modified',
        additions: 5,
        deletions: 3,
      })

      const count = repo.countByReview(testReviewId)
      assert.strictEqual(count, 2)
    })

    it('should return 0 for review with no files', () => {
      const count = repo.countByReview(testReviewId)
      assert.strictEqual(count, 0)
    })
  })

  describe('static parseHunks', () => {
    it('should parse valid JSON hunks', () => {
      const hunksData = JSON.stringify([
        { oldStart: 1, oldLines: 5, newStart: 1, newLines: 10, lines: [] },
      ])
      const hunks = ReviewFileRepository.parseHunks(hunksData)
      assert.strictEqual(hunks.length, 1)
      assert.strictEqual(hunks[0].oldStart, 1)
    })

    it('should return empty array for null', () => {
      const hunks = ReviewFileRepository.parseHunks(null)
      assert.deepStrictEqual(hunks, [])
    })

    it('should return empty array for invalid JSON', () => {
      const hunks = ReviewFileRepository.parseHunks('invalid json')
      assert.deepStrictEqual(hunks, [])
    })
  })

  describe('static serializeHunks', () => {
    it('should serialize hunks to JSON', () => {
      const hunks = [{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 10, lines: [] }]
      const json = ReviewFileRepository.serializeHunks(hunks)
      assert.strictEqual(typeof json, 'string')
      assert.deepStrictEqual(JSON.parse(json), hunks)
    })
  })
})
