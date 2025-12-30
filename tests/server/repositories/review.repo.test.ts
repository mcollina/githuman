import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTestDatabase } from '../../../src/server/db/index.ts';
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts';
import type { DatabaseSync } from 'node:sqlite';

describe('ReviewRepository', () => {
  let db: DatabaseSync;
  let repo: ReviewRepository;

  beforeEach(() => {
    db = createTestDatabase();
    repo = new ReviewRepository(db);
  });

  describe('create', () => {
    it('should create a review and return it', () => {
      const review = repo.create({
        id: 'test-id-1',
        title: 'Test Review',
        description: 'A test review',
        repositoryPath: '/test/repo',
        baseRef: 'abc123',
        snapshotData: '{"files":[]}',
        status: 'in_progress',
      });

      assert.strictEqual(review.id, 'test-id-1');
      assert.strictEqual(review.title, 'Test Review');
      assert.strictEqual(review.description, 'A test review');
      assert.strictEqual(review.repositoryPath, '/test/repo');
      assert.strictEqual(review.baseRef, 'abc123');
      assert.strictEqual(review.snapshotData, '{"files":[]}');
      assert.strictEqual(review.status, 'in_progress');
      assert.ok(review.createdAt);
      assert.ok(review.updatedAt);
    });

    it('should create a review with null description', () => {
      const review = repo.create({
        id: 'test-id-2',
        title: 'No Description',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      assert.strictEqual(review.description, null);
      assert.strictEqual(review.baseRef, null);
    });
  });

  describe('findById', () => {
    it('should return a review by id', () => {
      repo.create({
        id: 'test-id',
        title: 'Test',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const review = repo.findById('test-id');
      assert.ok(review);
      assert.strictEqual(review.id, 'test-id');
      assert.strictEqual(review.title, 'Test');
    });

    it('should return null for non-existent id', () => {
      const review = repo.findById('non-existent');
      assert.strictEqual(review, null);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no reviews exist', () => {
      const result = repo.findAll();
      assert.strictEqual(result.data.length, 0);
      assert.strictEqual(result.total, 0);
    });

    it('should return all reviews', () => {
      repo.create({
        id: 'id-1',
        title: 'Review 1',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });
      repo.create({
        id: 'id-2',
        title: 'Review 2',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'approved',
      });

      const result = repo.findAll();
      assert.strictEqual(result.data.length, 2);
      assert.strictEqual(result.total, 2);
    });

    it('should filter by status', () => {
      repo.create({
        id: 'id-1',
        title: 'Review 1',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });
      repo.create({
        id: 'id-2',
        title: 'Review 2',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'approved',
      });

      const result = repo.findAll({ status: 'approved' });
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.data[0].status, 'approved');
    });

    it('should filter by repository path', () => {
      repo.create({
        id: 'id-1',
        title: 'Review 1',
        description: null,
        repositoryPath: '/repo/one',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });
      repo.create({
        id: 'id-2',
        title: 'Review 2',
        description: null,
        repositoryPath: '/repo/two',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const result = repo.findAll({ repositoryPath: '/repo/one' });
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0].repositoryPath, '/repo/one');
    });

    it('should paginate results', () => {
      for (let i = 1; i <= 5; i++) {
        repo.create({
          id: `id-${i}`,
          title: `Review ${i}`,
          description: null,
          repositoryPath: '/test/repo',
          baseRef: null,
          snapshotData: '{}',
          status: 'in_progress',
        });
      }

      const page1 = repo.findAll({ page: 1, pageSize: 2 });
      assert.strictEqual(page1.data.length, 2);
      assert.strictEqual(page1.total, 5);

      const page2 = repo.findAll({ page: 2, pageSize: 2 });
      assert.strictEqual(page2.data.length, 2);
      assert.strictEqual(page2.total, 5);

      const page3 = repo.findAll({ page: 3, pageSize: 2 });
      assert.strictEqual(page3.data.length, 1);
      assert.strictEqual(page3.total, 5);
    });
  });

  describe('update', () => {
    it('should update review title', () => {
      repo.create({
        id: 'test-id',
        title: 'Original Title',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const updated = repo.update('test-id', { title: 'New Title' });
      assert.ok(updated);
      assert.strictEqual(updated.title, 'New Title');
    });

    it('should update review status', () => {
      repo.create({
        id: 'test-id',
        title: 'Test',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const updated = repo.update('test-id', { status: 'approved' });
      assert.ok(updated);
      assert.strictEqual(updated.status, 'approved');
    });

    it('should update multiple fields', () => {
      repo.create({
        id: 'test-id',
        title: 'Test',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const updated = repo.update('test-id', {
        title: 'Updated',
        description: 'New description',
        status: 'changes_requested',
      });

      assert.ok(updated);
      assert.strictEqual(updated.title, 'Updated');
      assert.strictEqual(updated.description, 'New description');
      assert.strictEqual(updated.status, 'changes_requested');
    });

    it('should return null for non-existent id', () => {
      const updated = repo.update('non-existent', { title: 'Test' });
      assert.strictEqual(updated, null);
    });
  });

  describe('delete', () => {
    it('should delete a review', () => {
      repo.create({
        id: 'test-id',
        title: 'Test',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      const deleted = repo.delete('test-id');
      assert.strictEqual(deleted, true);

      const review = repo.findById('test-id');
      assert.strictEqual(review, null);
    });

    it('should return false for non-existent id', () => {
      const deleted = repo.delete('non-existent');
      assert.strictEqual(deleted, false);
    });
  });

  describe('countByStatus', () => {
    it('should count reviews by status', () => {
      repo.create({
        id: 'id-1',
        title: 'Review 1',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });
      repo.create({
        id: 'id-2',
        title: 'Review 2',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });
      repo.create({
        id: 'id-3',
        title: 'Review 3',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'approved',
      });

      assert.strictEqual(repo.countByStatus('in_progress'), 2);
      assert.strictEqual(repo.countByStatus('approved'), 1);
      assert.strictEqual(repo.countByStatus('changes_requested'), 0);
    });
  });

  describe('countAll', () => {
    it('should count all reviews', () => {
      assert.strictEqual(repo.countAll(), 0);

      repo.create({
        id: 'id-1',
        title: 'Test',
        description: null,
        repositoryPath: '/test/repo',
        baseRef: null,
        snapshotData: '{}',
        status: 'in_progress',
      });

      assert.strictEqual(repo.countAll(), 1);
    });
  });
});
