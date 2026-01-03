/**
 * Git API routes - repository info, branches, commits
 */
import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@fastify/type-provider-typebox';
import { GitService, type BranchInfo, type CommitInfo } from '../services/git.service.ts';
import type { RepositoryInfo } from '../../shared/types.ts';
import { ErrorSchema } from '../schemas/common.ts';

const RepositoryInfoSchema = Type.Object(
  {
    name: Type.String({ description: 'Repository name' }),
    branch: Type.String({ description: 'Current branch' }),
    remote: Type.Union([Type.String(), Type.Null()], { description: 'Remote URL' }),
    path: Type.String({ description: 'Repository path' }),
  },
  { description: 'Repository information' }
);

const BranchInfoSchema = Type.Object(
  {
    name: Type.String({ description: 'Branch name' }),
    isRemote: Type.Boolean({ description: 'Whether this is a remote branch' }),
    isCurrent: Type.Boolean({ description: 'Whether this is the current branch' }),
  },
  { description: 'Branch information' }
);

const CommitInfoSchema = Type.Object(
  {
    sha: Type.String({ description: 'Commit hash' }),
    message: Type.String({ description: 'Commit message' }),
    author: Type.String({ description: 'Author name' }),
    date: Type.String({ description: 'Commit date' }),
  },
  { description: 'Commit information' }
);

const CommitsQuerystringSchema = Type.Object({
  limit: Type.Optional(Type.String({ description: 'Maximum number of commits to return' })),
});

const StagedStatusSchema = Type.Object(
  {
    hasStagedChanges: Type.Boolean({ description: 'Whether there are staged changes' }),
  },
  { description: 'Staged changes status' }
);

const gitRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to get git service
  const getService = () => {
    return new GitService(fastify.config.repositoryPath);
  };

  /**
   * GET /api/git/info
   * Get repository information
   */
  fastify.get<{
    Reply: RepositoryInfo | { error: string };
  }>('/api/git/info', {
    schema: {
      tags: ['git'],
      summary: 'Get repository info',
      description: 'Get basic information about the current repository',
      response: {
        200: RepositoryInfoSchema,
        500: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService();

    try {
      const info = await service.getRepositoryInfo();
      return info;
    } catch (err) {
      return reply.code(500).send({
        error: 'Failed to get repository info',
      });
    }
  });

  /**
   * GET /api/git/branches
   * List all branches
   */
  fastify.get<{
    Reply: BranchInfo[];
  }>('/api/git/branches', {
    schema: {
      tags: ['git'],
      summary: 'List all branches',
      description: 'Get a list of all branches in the repository',
      response: {
        200: Type.Array(BranchInfoSchema),
      },
    },
  }, async () => {
    const service = getService();
    return service.getBranches();
  });

  /**
   * GET /api/git/commits
   * List recent commits
   */
  fastify.get<{
    Querystring: { limit?: string };
    Reply: CommitInfo[];
  }>('/api/git/commits', {
    schema: {
      tags: ['git'],
      summary: 'List recent commits',
      description: 'Get a list of recent commits in the repository',
      querystring: CommitsQuerystringSchema,
      response: {
        200: Type.Array(CommitInfoSchema),
      },
    },
  }, async (request) => {
    const service = getService();
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    return service.getCommits(limit);
  });

  /**
   * GET /api/git/staged
   * Check if there are staged changes
   */
  fastify.get<{
    Reply: { hasStagedChanges: boolean };
  }>('/api/git/staged', {
    schema: {
      tags: ['git'],
      summary: 'Check staged changes',
      description: 'Check if there are any staged changes in the repository',
      response: {
        200: StagedStatusSchema,
      },
    },
  }, async () => {
    const service = getService();
    const hasStagedChanges = await service.hasStagedChanges();
    return { hasStagedChanges };
  });
};

export default gitRoutes;
