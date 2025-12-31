/**
 * Comment service - business logic for comment management
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { CommentRepository } from '../repositories/comment.repo.ts';
import { ReviewRepository } from '../repositories/review.repo.ts';
import type {
  Comment,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../../shared/types.ts';

export interface CommentStats {
  total: number;
  resolved: number;
  unresolved: number;
  withSuggestions: number;
}

export interface CommentsGroupedByFile {
  [filePath: string]: Comment[];
}

export class CommentService {
  private repo: CommentRepository;
  private reviewRepo: ReviewRepository;

  constructor(db: DatabaseSync) {
    this.repo = new CommentRepository(db);
    this.reviewRepo = new ReviewRepository(db);
  }

  /**
   * Create a new comment on a review
   */
  create(reviewId: string, request: CreateCommentRequest): Comment {
    // Verify review exists
    const review = this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new CommentError('Review not found', 'REVIEW_NOT_FOUND');
    }

    // Validate line type if line number is provided
    if (request.lineNumber !== undefined && !request.lineType) {
      throw new CommentError(
        'Line type is required when line number is specified',
        'MISSING_LINE_TYPE'
      );
    }

    return this.repo.create({
      id: randomUUID(),
      reviewId,
      filePath: request.filePath,
      lineNumber: request.lineNumber ?? null,
      lineType: request.lineType ?? null,
      content: request.content,
      suggestion: request.suggestion ?? null,
      resolved: false,
    });
  }

  /**
   * Get a comment by ID
   */
  getById(id: string): Comment | null {
    return this.repo.findById(id);
  }

  /**
   * Get all comments for a review
   */
  getByReview(reviewId: string): Comment[] {
    return this.repo.findByReview(reviewId);
  }

  /**
   * Get comments for a specific file in a review
   */
  getByFile(reviewId: string, filePath: string): Comment[] {
    return this.repo.findByFile(reviewId, filePath);
  }

  /**
   * Get comments grouped by file path
   */
  getGroupedByFile(reviewId: string): CommentsGroupedByFile {
    const comments = this.repo.findByReview(reviewId);
    const grouped: CommentsGroupedByFile = {};

    for (const comment of comments) {
      if (!grouped[comment.filePath]) {
        grouped[comment.filePath] = [];
      }
      grouped[comment.filePath].push(comment);
    }

    return grouped;
  }

  /**
   * Update a comment's content or suggestion
   */
  update(id: string, request: UpdateCommentRequest): Comment | null {
    const existing = this.repo.findById(id);
    if (!existing) {
      return null;
    }

    return this.repo.update(id, {
      content: request.content,
      suggestion: request.suggestion,
    });
  }

  /**
   * Mark a comment as resolved
   */
  resolve(id: string): Comment | null {
    return this.repo.setResolved(id, true);
  }

  /**
   * Mark a comment as unresolved
   */
  unresolve(id: string): Comment | null {
    return this.repo.setResolved(id, false);
  }

  /**
   * Delete a comment
   */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /**
   * Delete all comments for a review
   */
  deleteByReview(reviewId: string): number {
    return this.repo.deleteByReview(reviewId);
  }

  /**
   * Get comment statistics for a review
   */
  getStats(reviewId: string): CommentStats {
    const comments = this.repo.findByReview(reviewId);

    return {
      total: comments.length,
      resolved: comments.filter((c) => c.resolved).length,
      unresolved: comments.filter((c) => !c.resolved).length,
      withSuggestions: comments.filter((c) => c.suggestion !== null).length,
    };
  }

  /**
   * Check if a comment belongs to a specific review
   */
  belongsToReview(commentId: string, reviewId: string): boolean {
    const comment = this.repo.findById(commentId);
    return comment?.reviewId === reviewId;
  }
}

export class CommentError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CommentError';
    this.code = code;
  }
}
