import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { TodoRepository } from '../../../src/server/repositories/todo.repo.ts';
import { ReviewRepository } from '../../../src/server/repositories/review.repo.ts';
import { migrate, migrations } from '../../../src/server/db/migrations.ts';

describe('TodoRepository', () => {
  let db: DatabaseSync;
  let repo: TodoRepository;
  let reviewRepo: ReviewRepository;
  let testReviewId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, migrations);
    repo = new TodoRepository(db);
    reviewRepo = new ReviewRepository(db);

    // Create a test review to link todos to
    const review = reviewRepo.create({
      id: 'test-review-1',
      repositoryPath: '/test/path',
      baseRef: 'abc123',
      sourceType: 'staged',
      sourceRef: null,
      snapshotData: '{}',
      status: 'in_progress',
    });
    testReviewId = review.id;
  });

  after(() => {
    db?.close();
  });

  describe('create', () => {
    it('should create a todo and return it', () => {
      const todo = repo.create({
        id: 'todo-1',
        content: 'Fix the bug',
        completed: false,
        reviewId: null,
      });

      assert.strictEqual(todo.id, 'todo-1');
      assert.strictEqual(todo.content, 'Fix the bug');
      assert.strictEqual(todo.completed, false);
      assert.strictEqual(todo.reviewId, null);
      assert.ok(todo.createdAt);
      assert.ok(todo.updatedAt);
    });

    it('should create a todo linked to a review', () => {
      const todo = repo.create({
        id: 'todo-2',
        content: 'Address comment on line 42',
        completed: false,
        reviewId: testReviewId,
      });

      assert.strictEqual(todo.reviewId, testReviewId);
    });

    it('should create a completed todo', () => {
      const todo = repo.create({
        id: 'todo-3',
        content: 'Already done',
        completed: true,
        reviewId: null,
      });

      assert.strictEqual(todo.completed, true);
    });
  });

  describe('findById', () => {
    it('should return a todo by id', () => {
      repo.create({
        id: 'todo-1',
        content: 'Test todo',
        completed: false,
        reviewId: null,
      });

      const found = repo.findById('todo-1');
      assert.ok(found);
      assert.strictEqual(found.id, 'todo-1');
    });

    it('should return null for non-existent id', () => {
      const found = repo.findById('non-existent');
      assert.strictEqual(found, null);
    });
  });

  describe('findAll', () => {
    it('should return all todos', () => {
      repo.create({
        id: 'todo-1',
        content: 'Todo 1',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Todo 2',
        completed: true,
        reviewId: null,
      });

      const todos = repo.findAll();
      assert.strictEqual(todos.length, 2);
    });

    it('should return empty array when no todos exist', () => {
      const todos = repo.findAll();
      assert.strictEqual(todos.length, 0);
    });

    it('should return pending todos first', () => {
      repo.create({
        id: 'todo-1',
        content: 'Completed',
        completed: true,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Pending',
        completed: false,
        reviewId: null,
      });

      const todos = repo.findAll();
      assert.strictEqual(todos[0].completed, false);
      assert.strictEqual(todos[1].completed, true);
    });
  });

  describe('findByReview', () => {
    it('should return todos for a specific review', () => {
      repo.create({
        id: 'todo-1',
        content: 'Review todo',
        completed: false,
        reviewId: testReviewId,
      });
      repo.create({
        id: 'todo-2',
        content: 'Global todo',
        completed: false,
        reviewId: null,
      });

      const todos = repo.findByReview(testReviewId);
      assert.strictEqual(todos.length, 1);
      assert.strictEqual(todos[0].reviewId, testReviewId);
    });
  });

  describe('findByCompleted', () => {
    it('should return only completed todos', () => {
      repo.create({
        id: 'todo-1',
        content: 'Pending',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Done',
        completed: true,
        reviewId: null,
      });

      const completed = repo.findByCompleted(true);
      assert.strictEqual(completed.length, 1);
      assert.strictEqual(completed[0].completed, true);
    });

    it('should return only pending todos', () => {
      repo.create({
        id: 'todo-1',
        content: 'Pending',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Done',
        completed: true,
        reviewId: null,
      });

      const pending = repo.findByCompleted(false);
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].completed, false);
    });
  });

  describe('update', () => {
    it('should update todo content', () => {
      repo.create({
        id: 'todo-1',
        content: 'Original',
        completed: false,
        reviewId: null,
      });

      const updated = repo.update('todo-1', { content: 'Updated' });
      assert.ok(updated);
      assert.strictEqual(updated.content, 'Updated');
    });

    it('should update completed status', () => {
      repo.create({
        id: 'todo-1',
        content: 'Test',
        completed: false,
        reviewId: null,
      });

      const updated = repo.update('todo-1', { completed: true });
      assert.ok(updated);
      assert.strictEqual(updated.completed, true);
    });

    it('should return null for non-existent id', () => {
      const updated = repo.update('non-existent', { content: 'test' });
      assert.strictEqual(updated, null);
    });
  });

  describe('toggle', () => {
    it('should toggle pending to completed', () => {
      repo.create({
        id: 'todo-1',
        content: 'Test',
        completed: false,
        reviewId: null,
      });

      const toggled = repo.toggle('todo-1');
      assert.ok(toggled);
      assert.strictEqual(toggled.completed, true);
    });

    it('should toggle completed to pending', () => {
      repo.create({
        id: 'todo-1',
        content: 'Test',
        completed: true,
        reviewId: null,
      });

      const toggled = repo.toggle('todo-1');
      assert.ok(toggled);
      assert.strictEqual(toggled.completed, false);
    });

    it('should return null for non-existent id', () => {
      const toggled = repo.toggle('non-existent');
      assert.strictEqual(toggled, null);
    });
  });

  describe('delete', () => {
    it('should delete a todo', () => {
      repo.create({
        id: 'todo-1',
        content: 'Test',
        completed: false,
        reviewId: null,
      });

      const deleted = repo.delete('todo-1');
      assert.strictEqual(deleted, true);
      assert.strictEqual(repo.findById('todo-1'), null);
    });

    it('should return false for non-existent id', () => {
      const deleted = repo.delete('non-existent');
      assert.strictEqual(deleted, false);
    });
  });

  describe('deleteCompleted', () => {
    it('should delete all completed todos', () => {
      repo.create({
        id: 'todo-1',
        content: 'Pending',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Done 1',
        completed: true,
        reviewId: null,
      });
      repo.create({
        id: 'todo-3',
        content: 'Done 2',
        completed: true,
        reviewId: null,
      });

      const count = repo.deleteCompleted();
      assert.strictEqual(count, 2);
      assert.strictEqual(repo.findAll().length, 1);
      assert.strictEqual(repo.findById('todo-1')?.content, 'Pending');
    });
  });

  describe('deleteByReview', () => {
    it('should delete all todos for a review', () => {
      repo.create({
        id: 'todo-1',
        content: 'Review todo 1',
        completed: false,
        reviewId: testReviewId,
      });
      repo.create({
        id: 'todo-2',
        content: 'Review todo 2',
        completed: false,
        reviewId: testReviewId,
      });
      repo.create({
        id: 'todo-3',
        content: 'Global todo',
        completed: false,
        reviewId: null,
      });

      const count = repo.deleteByReview(testReviewId);
      assert.strictEqual(count, 2);
      assert.strictEqual(repo.findAll().length, 1);
    });
  });

  describe('count methods', () => {
    beforeEach(() => {
      repo.create({
        id: 'todo-1',
        content: 'Pending 1',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Pending 2',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-3',
        content: 'Done',
        completed: true,
        reviewId: null,
      });
    });

    it('should count all todos', () => {
      assert.strictEqual(repo.countAll(), 3);
    });

    it('should count completed todos', () => {
      assert.strictEqual(repo.countCompleted(), 1);
    });

    it('should count pending todos', () => {
      assert.strictEqual(repo.countPending(), 2);
    });
  });

  describe('cascade delete on review deletion', () => {
    it('should delete todos when review is deleted', () => {
      repo.create({
        id: 'todo-1',
        content: 'Review todo',
        completed: false,
        reviewId: testReviewId,
      });

      assert.strictEqual(repo.findAll().length, 1);

      reviewRepo.delete(testReviewId);

      assert.strictEqual(repo.findAll().length, 0);
    });
  });

  describe('position', () => {
    it('should assign incremental positions to new todos', () => {
      repo.create({
        id: 'todo-1',
        content: 'First',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-2',
        content: 'Second',
        completed: false,
        reviewId: null,
      });
      repo.create({
        id: 'todo-3',
        content: 'Third',
        completed: false,
        reviewId: null,
      });

      const todo1 = repo.findById('todo-1');
      const todo2 = repo.findById('todo-2');
      const todo3 = repo.findById('todo-3');

      assert.strictEqual(todo1?.position, 0);
      assert.strictEqual(todo2?.position, 1);
      assert.strictEqual(todo3?.position, 2);
    });

    it('should return todos ordered by position', () => {
      repo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null });
      repo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null });
      repo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null });

      const todos = repo.findAll();
      assert.strictEqual(todos[0].content, 'First');
      assert.strictEqual(todos[1].content, 'Second');
      assert.strictEqual(todos[2].content, 'Third');
    });
  });

  describe('reorder', () => {
    it('should reorder todos by updating positions', () => {
      repo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null });
      repo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null });
      repo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null });

      // Reorder: Third, First, Second
      const updated = repo.reorder(['todo-3', 'todo-1', 'todo-2']);
      assert.strictEqual(updated, 3);

      const todos = repo.findAll();
      assert.strictEqual(todos[0].id, 'todo-3');
      assert.strictEqual(todos[1].id, 'todo-1');
      assert.strictEqual(todos[2].id, 'todo-2');
    });

    it('should return 0 when no IDs match', () => {
      const updated = repo.reorder(['non-existent']);
      assert.strictEqual(updated, 0);
    });
  });

  describe('move', () => {
    it('should move a todo to a new position', () => {
      repo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null });
      repo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null });
      repo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null });

      // Move Third to position 0 (top)
      const moved = repo.move('todo-3', 0);
      assert.ok(moved);
      assert.strictEqual(moved.id, 'todo-3');

      const todos = repo.findAll();
      assert.strictEqual(todos[0].id, 'todo-3');
      assert.strictEqual(todos[1].id, 'todo-1');
      assert.strictEqual(todos[2].id, 'todo-2');
    });

    it('should move a todo to the end', () => {
      repo.create({ id: 'todo-1', content: 'First', completed: false, reviewId: null });
      repo.create({ id: 'todo-2', content: 'Second', completed: false, reviewId: null });
      repo.create({ id: 'todo-3', content: 'Third', completed: false, reviewId: null });

      // Move First to position 2 (end)
      const moved = repo.move('todo-1', 2);
      assert.ok(moved);

      const todos = repo.findAll();
      assert.strictEqual(todos[0].id, 'todo-2');
      assert.strictEqual(todos[1].id, 'todo-3');
      assert.strictEqual(todos[2].id, 'todo-1');
    });

    it('should return null for non-existent todo', () => {
      const moved = repo.move('non-existent', 0);
      assert.strictEqual(moved, null);
    });
  });
});
