/**
 * Comment API routes
 */
import type { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../db/index.ts';
import {
  CommentService,
  CommentError,
  type CommentStats,
} from '../services/comment.service.ts';
import type {
  Comment,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '../../shared/types.ts';

interface ReviewParams {
  reviewId: string;
}

interface CommentParams {
  id: string;
}

interface FileQuerystring {
  filePath?: string;
}

const commentRoutes: FastifyPluginAsync = async (fastify) => {
  const getService = () => {
    const db = getDatabase();
    return new CommentService(db);
  };

  /**
   * GET /api/reviews/:reviewId/comments
   * List all comments for a review, optionally filtered by file
   */
  fastify.get<{
    Params: ReviewParams;
    Querystring: FileQuerystring;
    Reply: Comment[] | { error: string };
  }>('/api/reviews/:reviewId/comments', async (request, reply) => {
    const service = getService();
    const { reviewId } = request.params;
    const { filePath } = request.query;

    if (filePath) {
      return service.getByFile(reviewId, filePath);
    }

    return service.getByReview(reviewId);
  });

  /**
   * GET /api/reviews/:reviewId/comments/stats
   * Get comment statistics for a review
   */
  fastify.get<{
    Params: ReviewParams;
    Reply: CommentStats;
  }>('/api/reviews/:reviewId/comments/stats', async (request) => {
    const service = getService();
    return service.getStats(request.params.reviewId);
  });

  /**
   * POST /api/reviews/:reviewId/comments
   * Add a comment to a review
   */
  fastify.post<{
    Params: ReviewParams;
    Body: CreateCommentRequest;
    Reply: Comment | { error: string; code: string };
  }>('/api/reviews/:reviewId/comments', async (request, reply) => {
    const service = getService();

    try {
      const comment = service.create(request.params.reviewId, request.body);
      reply.code(201);
      return comment;
    } catch (err) {
      if (err instanceof CommentError) {
        const statusCode = err.code === 'REVIEW_NOT_FOUND' ? 404 : 400;
        return reply.code(statusCode).send({
          error: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  /**
   * GET /api/comments/:id
   * Get a specific comment
   */
  fastify.get<{
    Params: CommentParams;
    Reply: Comment | { error: string };
  }>('/api/comments/:id', async (request, reply) => {
    const service = getService();
    const comment = service.getById(request.params.id);

    if (!comment) {
      return reply.code(404).send({
        error: 'Comment not found',
      });
    }

    return comment;
  });

  /**
   * PATCH /api/comments/:id
   * Update a comment's content or suggestion
   */
  fastify.patch<{
    Params: CommentParams;
    Body: UpdateCommentRequest;
    Reply: Comment | { error: string };
  }>('/api/comments/:id', async (request, reply) => {
    const service = getService();
    const comment = service.update(request.params.id, request.body);

    if (!comment) {
      return reply.code(404).send({
        error: 'Comment not found',
      });
    }

    return comment;
  });

  /**
   * DELETE /api/comments/:id
   * Delete a comment
   */
  fastify.delete<{
    Params: CommentParams;
    Reply: { success: boolean } | { error: string };
  }>('/api/comments/:id', async (request, reply) => {
    const service = getService();
    const deleted = service.delete(request.params.id);

    if (!deleted) {
      return reply.code(404).send({
        error: 'Comment not found',
      });
    }

    return { success: true };
  });

  /**
   * POST /api/comments/:id/resolve
   * Mark a comment as resolved
   */
  fastify.post<{
    Params: CommentParams;
    Reply: Comment | { error: string };
  }>('/api/comments/:id/resolve', async (request, reply) => {
    const service = getService();
    const comment = service.resolve(request.params.id);

    if (!comment) {
      return reply.code(404).send({
        error: 'Comment not found',
      });
    }

    return comment;
  });

  /**
   * POST /api/comments/:id/unresolve
   * Mark a comment as unresolved
   */
  fastify.post<{
    Params: CommentParams;
    Reply: Comment | { error: string };
  }>('/api/comments/:id/unresolve', async (request, reply) => {
    const service = getService();
    const comment = service.unresolve(request.params.id);

    if (!comment) {
      return reply.code(404).send({
        error: 'Comment not found',
      });
    }

    return comment;
  });
};

export default commentRoutes;
