import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { CommentRepository } from '../../../src/server/repositories/comment.repo.ts';
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts';
import { migrate, migrations } from '../../../src/server/db/migrations.ts';

describe('CommentRepository', () => {
  let db: DatabaseSync;
  let repo: CommentRepository;
  let reviewRepo: ReviewRepository;
  let testReviewId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, migrations);
    repo = new CommentRepository(db);
    reviewRepo = new ReviewRepository(db);

    // Create a test review to attach comments to
    const review = reviewRepo.create({
      id: 'test-review-1',
      title: 'Test Review',
      description: null,
      repositoryPath: '/test/path',
      baseRef: 'abc123',
      snapshotData: '{}',
      status: 'in_progress',
    });
    testReviewId = review.id;
  });

  after(() => {
    db?.close();
  });

  describe('create', () => {
    it('should create a comment and return it', () => {
      const comment = repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Great change!',
        suggestion: null,
        resolved: false,
      });

      assert.strictEqual(comment.id, 'comment-1');
      assert.strictEqual(comment.reviewId, testReviewId);
      assert.strictEqual(comment.filePath, 'src/index.ts');
      assert.strictEqual(comment.lineNumber, 10);
      assert.strictEqual(comment.lineType, 'added');
      assert.strictEqual(comment.content, 'Great change!');
      assert.strictEqual(comment.suggestion, null);
      assert.strictEqual(comment.resolved, false);
      assert.ok(comment.createdAt);
      assert.ok(comment.updatedAt);
    });

    it('should create a file-level comment with null line number', () => {
      const comment = repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: null,
        lineType: null,
        content: 'File-level comment',
        suggestion: null,
        resolved: false,
      });

      assert.strictEqual(comment.lineNumber, null);
      assert.strictEqual(comment.lineType, null);
    });

    it('should create a comment with a suggestion', () => {
      const comment = repo.create({
        id: 'comment-3',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 5,
        lineType: 'context',
        content: 'Consider this change',
        suggestion: 'const x = 1;',
        resolved: false,
      });

      assert.strictEqual(comment.suggestion, 'const x = 1;');
    });
  });

  describe('findById', () => {
    it('should return a comment by id', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Test comment',
        suggestion: null,
        resolved: false,
      });

      const found = repo.findById('comment-1');
      assert.ok(found);
      assert.strictEqual(found.id, 'comment-1');
    });

    it('should return null for non-existent id', () => {
      const found = repo.findById('non-existent');
      assert.strictEqual(found, null);
    });
  });

  describe('findByReview', () => {
    it('should return all comments for a review', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        lineNumber: 1,
        lineType: 'added',
        content: 'Comment 1',
        suggestion: null,
        resolved: false,
      });
      repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        lineNumber: 2,
        lineType: 'removed',
        content: 'Comment 2',
        suggestion: null,
        resolved: false,
      });

      const comments = repo.findByReview(testReviewId);
      assert.strictEqual(comments.length, 2);
    });

    it('should return empty array for review with no comments', () => {
      const comments = repo.findByReview(testReviewId);
      assert.strictEqual(comments.length, 0);
    });
  });

  describe('findByFile', () => {
    it('should return comments for a specific file', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        lineNumber: 1,
        lineType: 'added',
        content: 'Comment 1',
        suggestion: null,
        resolved: false,
      });
      repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        lineNumber: 2,
        lineType: 'removed',
        content: 'Comment 2',
        suggestion: null,
        resolved: false,
      });

      const comments = repo.findByFile(testReviewId, 'src/a.ts');
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].filePath, 'src/a.ts');
    });
  });

  describe('update', () => {
    it('should update comment content', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Original content',
        suggestion: null,
        resolved: false,
      });

      const updated = repo.update('comment-1', { content: 'Updated content' });
      assert.ok(updated);
      assert.strictEqual(updated.content, 'Updated content');
    });

    it('should update suggestion', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Comment',
        suggestion: null,
        resolved: false,
      });

      const updated = repo.update('comment-1', { suggestion: 'new code' });
      assert.ok(updated);
      assert.strictEqual(updated.suggestion, 'new code');
    });

    it('should return null for non-existent id', () => {
      const updated = repo.update('non-existent', { content: 'test' });
      assert.strictEqual(updated, null);
    });
  });

  describe('setResolved', () => {
    it('should mark comment as resolved', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Comment',
        suggestion: null,
        resolved: false,
      });

      const resolved = repo.setResolved('comment-1', true);
      assert.ok(resolved);
      assert.strictEqual(resolved.resolved, true);
    });

    it('should mark comment as unresolved', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Comment',
        suggestion: null,
        resolved: true,
      });

      const unresolved = repo.setResolved('comment-1', false);
      assert.ok(unresolved);
      assert.strictEqual(unresolved.resolved, false);
    });
  });

  describe('delete', () => {
    it('should delete a comment', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/index.ts',
        lineNumber: 10,
        lineType: 'added',
        content: 'Comment',
        suggestion: null,
        resolved: false,
      });

      const deleted = repo.delete('comment-1');
      assert.strictEqual(deleted, true);
      assert.strictEqual(repo.findById('comment-1'), null);
    });

    it('should return false for non-existent id', () => {
      const deleted = repo.delete('non-existent');
      assert.strictEqual(deleted, false);
    });
  });

  describe('deleteByReview', () => {
    it('should delete all comments for a review', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        lineNumber: 1,
        lineType: 'added',
        content: 'Comment 1',
        suggestion: null,
        resolved: false,
      });
      repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        lineNumber: 2,
        lineType: 'removed',
        content: 'Comment 2',
        suggestion: null,
        resolved: false,
      });

      const count = repo.deleteByReview(testReviewId);
      assert.strictEqual(count, 2);
      assert.strictEqual(repo.findByReview(testReviewId).length, 0);
    });
  });

  describe('countByReview', () => {
    it('should count comments for a review', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        lineNumber: 1,
        lineType: 'added',
        content: 'Comment 1',
        suggestion: null,
        resolved: false,
      });
      repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        lineNumber: 2,
        lineType: 'removed',
        content: 'Comment 2',
        suggestion: null,
        resolved: false,
      });

      const count = repo.countByReview(testReviewId);
      assert.strictEqual(count, 2);
    });
  });

  describe('countUnresolvedByReview', () => {
    it('should count only unresolved comments', () => {
      repo.create({
        id: 'comment-1',
        reviewId: testReviewId,
        filePath: 'src/a.ts',
        lineNumber: 1,
        lineType: 'added',
        content: 'Comment 1',
        suggestion: null,
        resolved: false,
      });
      repo.create({
        id: 'comment-2',
        reviewId: testReviewId,
        filePath: 'src/b.ts',
        lineNumber: 2,
        lineType: 'removed',
        content: 'Comment 2',
        suggestion: null,
        resolved: true,
      });

      const count = repo.countUnresolvedByReview(testReviewId);
      assert.strictEqual(count, 1);
    });
  });
});
