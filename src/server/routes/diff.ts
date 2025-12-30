/**
 * Diff API routes
 */
import type { FastifyPluginAsync } from 'fastify';
import { GitService } from '../services/git.service.ts';
import { parseDiff, getDiffSummary } from '../services/diff.service.ts';
import type { DiffFile, RepositoryInfo } from '../../shared/types.ts';

interface StagedDiffResponse {
  files: DiffFile[];
  summary: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    filesRenamed: number;
  };
  repository: RepositoryInfo;
}

interface StagedFilesResponse {
  files: Array<{
    path: string;
    oldPath?: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
  }>;
  hasStagedChanges: boolean;
}

const diffRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/diff/staged
   * Returns parsed diff data for all staged changes
   */
  fastify.get<{ Reply: StagedDiffResponse | { error: string } }>(
    '/api/diff/staged',
    async (request, reply) => {
      const gitService = new GitService(fastify.config.repositoryPath);

      // Check if it's a git repository
      if (!(await gitService.isRepo())) {
        return reply.code(400).send({
          error: 'Not a git repository',
        });
      }

      // Check if there are staged changes
      if (!(await gitService.hasStagedChanges())) {
        const repoInfo = await gitService.getRepositoryInfo();
        return {
          files: [],
          summary: {
            totalFiles: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            filesAdded: 0,
            filesModified: 0,
            filesDeleted: 0,
            filesRenamed: 0,
          },
          repository: repoInfo,
        };
      }

      // Get and parse the diff
      const diffText = await gitService.getStagedDiff();
      const files = parseDiff(diffText);
      const summary = getDiffSummary(files);
      const repository = await gitService.getRepositoryInfo();

      return {
        files,
        summary,
        repository,
      };
    }
  );

  /**
   * GET /api/diff/files
   * Returns list of staged files with stats
   */
  fastify.get<{ Reply: StagedFilesResponse | { error: string } }>(
    '/api/diff/files',
    async (request, reply) => {
      const gitService = new GitService(fastify.config.repositoryPath);

      // Check if it's a git repository
      if (!(await gitService.isRepo())) {
        return reply.code(400).send({
          error: 'Not a git repository',
        });
      }

      const hasStagedChanges = await gitService.hasStagedChanges();

      if (!hasStagedChanges) {
        return {
          files: [],
          hasStagedChanges: false,
        };
      }

      // Get staged files and stats
      const stagedFiles = await gitService.getStagedFiles();
      const stats = await gitService.getStagedDiffStats();

      // Merge file info with stats
      const files = stagedFiles.map((file) => {
        const fileStat = stats.files.find((s) => s.path === file.path);
        return {
          path: file.path,
          oldPath: file.oldPath,
          status: file.status,
          additions: fileStat?.additions ?? 0,
          deletions: fileStat?.deletions ?? 0,
        };
      });

      return {
        files,
        hasStagedChanges: true,
      };
    }
  );

  /**
   * GET /api/info
   * Returns repository information
   */
  fastify.get<{ Reply: RepositoryInfo | { error: string } }>(
    '/api/info',
    async (request, reply) => {
      const gitService = new GitService(fastify.config.repositoryPath);

      // Check if it's a git repository
      if (!(await gitService.isRepo())) {
        return reply.code(400).send({
          error: 'Not a git repository',
        });
      }

      return gitService.getRepositoryInfo();
    }
  );
};

export default diffRoutes;
