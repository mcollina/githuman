/**
 * Review API routes
 */
import type { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../db/index.ts';
import { ReviewService, ReviewError, type ReviewWithDetails, type ReviewListItem } from '../services/review.service.ts';
import { ExportService } from '../services/export.service.ts';
import type {
  CreateReviewRequest,
  UpdateReviewRequest,
  ReviewStatus,
  PaginatedResponse,
} from '../../shared/types.ts';

interface ReviewParams {
  id: string;
}

interface ListQuerystring {
  page?: string;
  pageSize?: string;
  status?: ReviewStatus;
}

const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to get review service
  const getService = () => {
    const db = getDatabase();
    return new ReviewService(db, fastify.config.repositoryPath);
  };

  /**
   * GET /api/reviews
   * List all reviews with pagination and filtering
   */
  fastify.get<{
    Querystring: ListQuerystring;
    Reply: PaginatedResponse<ReviewListItem>;
  }>('/api/reviews', async (request) => {
    const { page, pageSize, status } = request.query;
    const service = getService();

    return service.list({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
      repositoryPath: fastify.config.repositoryPath,
    });
  });

  /**
   * POST /api/reviews
   * Create a new review from staged changes
   */
  fastify.post<{
    Body: CreateReviewRequest;
    Reply: ReviewWithDetails | { error: string; code: string };
  }>('/api/reviews', async (request, reply) => {
    const service = getService();

    try {
      const review = await service.create(request.body);
      reply.code(201);
      return review;
    } catch (err) {
      if (err instanceof ReviewError) {
        return reply.code(400).send({
          error: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  /**
   * GET /api/reviews/:id
   * Get a review with full diff data
   */
  fastify.get<{
    Params: ReviewParams;
    Reply: ReviewWithDetails | { error: string };
  }>('/api/reviews/:id', async (request, reply) => {
    const service = getService();
    const review = service.getById(request.params.id);

    if (!review) {
      return reply.code(404).send({
        error: 'Review not found',
      });
    }

    return review;
  });

  /**
   * PATCH /api/reviews/:id
   * Update review metadata (title, description, status)
   */
  fastify.patch<{
    Params: ReviewParams;
    Body: UpdateReviewRequest;
    Reply: ReviewWithDetails | { error: string };
  }>('/api/reviews/:id', async (request, reply) => {
    const service = getService();
    const review = service.update(request.params.id, request.body);

    if (!review) {
      return reply.code(404).send({
        error: 'Review not found',
      });
    }

    return review;
  });

  /**
   * DELETE /api/reviews/:id
   * Delete a review and all associated comments
   */
  fastify.delete<{
    Params: ReviewParams;
    Reply: { success: boolean } | { error: string };
  }>('/api/reviews/:id', async (request, reply) => {
    const service = getService();
    const deleted = service.delete(request.params.id);

    if (!deleted) {
      return reply.code(404).send({
        error: 'Review not found',
      });
    }

    return { success: true };
  });

  /**
   * GET /api/reviews/stats
   * Get review statistics
   */
  fastify.get<{
    Reply: {
      total: number;
      inProgress: number;
      approved: number;
      changesRequested: number;
    };
  }>('/api/reviews/stats', async () => {
    const service = getService();
    return service.getStats(fastify.config.repositoryPath);
  });

  /**
   * GET /api/reviews/:id/export
   * Export review as markdown
   */
  fastify.get<{
    Params: ReviewParams;
    Querystring: {
      includeResolved?: string;
      includeDiffSnippets?: string;
    };
    Reply: string | { error: string };
  }>('/api/reviews/:id/export', async (request, reply) => {
    const db = getDatabase();
    const exportService = new ExportService(db);

    const { includeResolved, includeDiffSnippets } = request.query;

    const markdown = exportService.exportToMarkdown(request.params.id, {
      includeResolved: includeResolved !== 'false',
      includeDiffSnippets: includeDiffSnippets !== 'false',
    });

    if (!markdown) {
      return reply.code(404).send({
        error: 'Review not found',
      });
    }

    reply.header('Content-Type', 'text/markdown');
    return markdown;
  });
};

export default reviewRoutes;
