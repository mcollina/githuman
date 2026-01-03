/**
 * Review API routes
 */
import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@fastify/type-provider-typebox';
import { getDatabase } from '../db/index.ts';
import { ReviewService, ReviewError, type ReviewWithDetails, type ReviewListItem } from '../services/review.service.ts';
import { ExportService } from '../services/export.service.ts';
import type {
  CreateReviewRequest,
  UpdateReviewRequest,
  ReviewStatus,
  PaginatedResponse,
} from '../../shared/types.ts';
import { ErrorSchema, SuccessSchema } from '../schemas/common.ts';

const ReviewStatusSchema = Type.Union(
  [Type.Literal('in_progress'), Type.Literal('approved'), Type.Literal('changes_requested')],
  { description: 'Review status' }
);

const ReviewSourceTypeSchema = Type.Union(
  [Type.Literal('staged'), Type.Literal('branch'), Type.Literal('commits')],
  { description: 'Review source type' }
);

const DiffLineSchema = Type.Object({
  type: Type.Union([Type.Literal('added'), Type.Literal('removed'), Type.Literal('context')]),
  content: Type.String(),
  oldLineNumber: Type.Union([Type.Integer(), Type.Null()]),
  newLineNumber: Type.Union([Type.Integer(), Type.Null()]),
});

const DiffHunkSchema = Type.Object({
  oldStart: Type.Integer(),
  oldLines: Type.Integer(),
  newStart: Type.Integer(),
  newLines: Type.Integer(),
  lines: Type.Array(DiffLineSchema),
});

const DiffFileSchema = Type.Object(
  {
    oldPath: Type.String({ description: 'Original file path' }),
    newPath: Type.String({ description: 'New file path' }),
    status: Type.Union([
      Type.Literal('added'),
      Type.Literal('modified'),
      Type.Literal('deleted'),
      Type.Literal('renamed'),
    ]),
    additions: Type.Integer({ description: 'Number of lines added' }),
    deletions: Type.Integer({ description: 'Number of lines deleted' }),
    hunks: Type.Array(DiffHunkSchema),
  },
  { description: 'Diff file' }
);

const DiffSummarySchema = Type.Object(
  {
    totalFiles: Type.Integer({ description: 'Total number of files' }),
    totalAdditions: Type.Integer({ description: 'Total lines added' }),
    totalDeletions: Type.Integer({ description: 'Total lines deleted' }),
    filesAdded: Type.Integer({ description: 'Number of files added' }),
    filesModified: Type.Integer({ description: 'Number of files modified' }),
    filesDeleted: Type.Integer({ description: 'Number of files deleted' }),
    filesRenamed: Type.Integer({ description: 'Number of files renamed' }),
  },
  { description: 'Diff summary statistics' }
);

const ReviewListItemSchema = Type.Object(
  {
    id: Type.String(),
    repositoryPath: Type.String(),
    baseRef: Type.Union([Type.String(), Type.Null()]),
    sourceType: ReviewSourceTypeSchema,
    sourceRef: Type.Union([Type.String(), Type.Null()]),
    status: ReviewStatusSchema,
    summary: DiffSummarySchema,
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { description: 'Review list item' }
);

const ReviewWithDetailsSchema = Type.Object(
  {
    id: Type.String(),
    repositoryPath: Type.String(),
    baseRef: Type.Union([Type.String(), Type.Null()]),
    sourceType: ReviewSourceTypeSchema,
    sourceRef: Type.Union([Type.String(), Type.Null()]),
    status: ReviewStatusSchema,
    files: Type.Array(DiffFileSchema),
    summary: DiffSummarySchema,
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { description: 'Review with full diff details' }
);

const CreateReviewSchema = Type.Object(
  {
    sourceType: Type.Optional(ReviewSourceTypeSchema),
    sourceRef: Type.Optional(Type.String({ description: 'Branch name or commit SHAs' })),
  },
  { description: 'Create review request' }
);

const UpdateReviewSchema = Type.Object(
  {
    status: Type.Optional(ReviewStatusSchema),
  },
  { description: 'Update review request' }
);

const ReviewListQuerystringSchema = Type.Object(
  {
    page: Type.Optional(Type.String({ description: 'Page number' })),
    pageSize: Type.Optional(Type.String({ description: 'Items per page' })),
    status: Type.Optional(ReviewStatusSchema),
  },
  { description: 'Review list filters' }
);

const PaginatedReviewsSchema = Type.Object(
  {
    data: Type.Array(ReviewListItemSchema),
    total: Type.Integer({ description: 'Total number of reviews' }),
    page: Type.Integer({ description: 'Current page number' }),
    pageSize: Type.Integer({ description: 'Items per page' }),
  },
  { description: 'Paginated reviews response' }
);

const ReviewStatsSchema = Type.Object(
  {
    total: Type.Integer({ description: 'Total number of reviews' }),
    inProgress: Type.Integer({ description: 'Reviews in progress' }),
    approved: Type.Integer({ description: 'Approved reviews' }),
    changesRequested: Type.Integer({ description: 'Reviews with changes requested' }),
  },
  { description: 'Review statistics' }
);

const ReviewParamsSchema = Type.Object({
  id: Type.String({ description: 'Review ID' }),
});

const ExportQuerystringSchema = Type.Object({
  includeResolved: Type.Optional(Type.String({ description: 'Include resolved comments' })),
  includeDiffSnippets: Type.Optional(Type.String({ description: 'Include diff snippets' })),
});

interface ReviewParams {
  id: string;
}

interface ListQuerystring {
  page?: string;
  pageSize?: string;
  status?: ReviewStatus;
}

const reviewRoutes: FastifyPluginAsync = async (fastify) => {
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
  }>('/api/reviews', {
    schema: {
      tags: ['reviews'],
      summary: 'List all reviews',
      description: 'Retrieve all reviews with pagination and optional status filtering',
      querystring: ReviewListQuerystringSchema,
      response: {
        200: PaginatedReviewsSchema,
      },
    },
  }, async (request) => {
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
  }>('/api/reviews', {
    schema: {
      tags: ['reviews'],
      summary: 'Create a new review',
      description: 'Create a new code review from staged changes, a branch comparison, or commit range',
      body: CreateReviewSchema,
      response: {
        201: ReviewWithDetailsSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
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
  }>('/api/reviews/:id', {
    schema: {
      tags: ['reviews'],
      summary: 'Get a review by ID',
      description: 'Retrieve a specific review with full diff data',
      params: ReviewParamsSchema,
      response: {
        200: ReviewWithDetailsSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
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
   * Update review status
   */
  fastify.patch<{
    Params: ReviewParams;
    Body: UpdateReviewRequest;
    Reply: ReviewWithDetails | { error: string };
  }>('/api/reviews/:id', {
    schema: {
      tags: ['reviews'],
      summary: 'Update a review',
      description: 'Update the status of a review (in_progress, approved, changes_requested)',
      params: ReviewParamsSchema,
      body: UpdateReviewSchema,
      response: {
        200: ReviewWithDetailsSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
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
  }>('/api/reviews/:id', {
    schema: {
      tags: ['reviews'],
      summary: 'Delete a review',
      description: 'Permanently delete a review and all associated comments',
      params: ReviewParamsSchema,
      response: {
        200: SuccessSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
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
  }>('/api/reviews/stats', {
    schema: {
      tags: ['reviews'],
      summary: 'Get review statistics',
      description: 'Get counts of reviews by status',
      response: {
        200: ReviewStatsSchema,
      },
    },
  }, async () => {
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
  }>('/api/reviews/:id/export', {
    schema: {
      tags: ['reviews'],
      summary: 'Export review as markdown',
      description: 'Export a review with comments as a markdown document',
      params: ReviewParamsSchema,
      querystring: ExportQuerystringSchema,
      response: {
        200: Type.String({ description: 'Markdown content' }),
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
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
