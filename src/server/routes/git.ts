/**
 * Git API routes - repository info, branches, commits
 */
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { GitService } from '../services/git.service.ts'
import { ErrorSchema } from '../schemas/common.ts'

const RepositoryInfoSchema = Type.Object(
  {
    name: Type.String({ description: 'Repository name' }),
    branch: Type.String({ description: 'Current branch' }),
    remote: Type.Union([Type.String(), Type.Null()], { description: 'Remote URL' }),
    path: Type.String({ description: 'Repository path' }),
  },
  { description: 'Repository information' }
)

const BranchInfoSchema = Type.Object(
  {
    name: Type.String({ description: 'Branch name' }),
    isRemote: Type.Boolean({ description: 'Whether this is a remote branch' }),
    isCurrent: Type.Boolean({ description: 'Whether this is the current branch' }),
  },
  { description: 'Branch information' }
)

const DefaultBranchSchema = Type.Object(
  {
    defaultBranch: Type.String({ description: 'Default target branch for comparisons' }),
  },
  { description: 'Default branch response' }
)

const CommitInfoSchema = Type.Object(
  {
    sha: Type.String({ description: 'Commit hash' }),
    message: Type.String({ description: 'Commit message' }),
    author: Type.String({ description: 'Author name' }),
    date: Type.String({ description: 'Commit date' }),
  },
  { description: 'Commit information' }
)

const CommitsQuerystringSchema = Type.Object({
  limit: Type.Optional(Type.String({ description: 'Maximum number of commits to return (default: 20)' })),
  offset: Type.Optional(Type.String({ description: 'Number of commits to skip for pagination (default: 0)' })),
  search: Type.Optional(Type.String({ description: 'Search commits by message or author' })),
})

const CommitsResponseSchema = Type.Object(
  {
    commits: Type.Array(CommitInfoSchema, { description: 'List of commits' }),
    hasMore: Type.Boolean({ description: 'Whether there are more commits to load' }),
  },
  { description: 'Paginated commits response' }
)

const StagedStatusSchema = Type.Object(
  {
    hasStagedChanges: Type.Boolean({ description: 'Whether there are staged changes' }),
  },
  { description: 'Staged changes status' }
)

const UnstagedFileSchema = Type.Object(
  {
    path: Type.String({ description: 'File path' }),
    status: Type.Union([
      Type.Literal('modified'),
      Type.Literal('deleted'),
      Type.Literal('untracked'),
    ], { description: 'File status' }),
  },
  { description: 'Unstaged file information' }
)

const UnstagedStatusSchema = Type.Object(
  {
    hasUnstagedChanges: Type.Boolean({ description: 'Whether there are unstaged changes' }),
    files: Type.Array(UnstagedFileSchema, { description: 'List of unstaged files' }),
  },
  { description: 'Unstaged changes status' }
)

const StageRequestSchema = Type.Object(
  {
    files: Type.Array(Type.String(), { description: 'File paths to stage' }),
  },
  { description: 'Stage request body' }
)

const StageAllRequestSchema = Type.Object(
  {},
  { description: 'Stage all request body (empty)' }
)

const UnstageRequestSchema = Type.Object(
  {
    files: Type.Array(Type.String(), { description: 'File paths to unstage' }),
  },
  { description: 'Unstage request body' }
)

const StageResponseSchema = Type.Object(
  {
    success: Type.Boolean({ description: 'Whether the operation succeeded' }),
    staged: Type.Array(Type.String(), { description: 'Files that were staged' }),
  },
  { description: 'Stage response' }
)

const UnstageResponseSchema = Type.Object(
  {
    success: Type.Boolean({ description: 'Whether the operation succeeded' }),
    unstaged: Type.Array(Type.String(), { description: 'Files that were unstaged' }),
  },
  { description: 'Unstage response' }
)

const FileTreeResponseSchema = Type.Object(
  {
    ref: Type.String({ description: 'Git ref that was resolved' }),
    files: Type.Array(Type.String(), { description: 'List of all file paths' }),
  },
  { description: 'File tree response' }
)

const FileContentAtRefQuerySchema = Type.Object({
  ref: Type.String({ description: 'Git ref (commit SHA, branch name, or HEAD)' }),
})

const FileContentAtRefResponseSchema = Type.Object(
  {
    path: Type.String({ description: 'File path' }),
    ref: Type.String({ description: 'Git ref used' }),
    content: Type.String({ description: 'File content' }),
    lines: Type.Array(Type.String(), { description: 'Lines of content' }),
    lineCount: Type.Integer({ description: 'Number of lines' }),
    isBinary: Type.Boolean({ description: 'Whether the file is binary' }),
  },
  { description: 'File content at specific ref' }
)

const gitRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Helper to get git service
  const getService = () => {
    return new GitService(fastify.config.repositoryPath)
  }

  /**
   * GET /api/git/info
   * Get repository information
   */
  fastify.get('/api/git/info', {
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
    const service = getService()

    try {
      const info = await service.getRepositoryInfo()
      return info
    } catch (err) {
      return reply.code(500).send({
        error: 'Failed to get repository info',
      })
    }
  })

  /**
   * GET /api/git/branches
   * List all branches
   */
  fastify.get('/api/git/branches', {
    schema: {
      tags: ['git'],
      summary: 'List all branches',
      description: 'Get a list of all branches in the repository',
      response: {
        200: Type.Array(BranchInfoSchema),
      },
    },
  }, async () => {
    const service = getService()
    return service.getBranches()
  })

  /**
   * GET /api/git/default-branch
   * Get the default branch used for branch comparisons
   */
  fastify.get('/api/git/default-branch', {
    schema: {
      tags: ['git'],
      summary: 'Get default branch',
      description: 'Get the default branch used as the default comparison target',
      response: {
        200: DefaultBranchSchema,
      },
    },
  }, async () => {
    const service = getService()
    const defaultBranch = await service.getDefaultBranch()
    return { defaultBranch }
  })

  /**
   * GET /api/git/commits
   * List recent commits with pagination and search
   */
  fastify.get('/api/git/commits', {
    schema: {
      tags: ['git'],
      summary: 'List recent commits',
      description: 'Get a paginated list of commits with optional search filter',
      querystring: CommitsQuerystringSchema,
      response: {
        200: CommitsResponseSchema,
      },
    },
  }, async (request) => {
    const service = getService()
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20
    const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0
    const search = request.query.search || undefined

    return service.getCommits({ limit, offset, search })
  })

  /**
   * GET /api/git/staged
   * Check if there are staged changes
   */
  fastify.get('/api/git/staged', {
    schema: {
      tags: ['git'],
      summary: 'Check staged changes',
      description: 'Check if there are any staged changes in the repository',
      response: {
        200: StagedStatusSchema,
      },
    },
  }, async () => {
    const service = getService()
    const hasStagedChanges = await service.hasStagedChanges()
    return { hasStagedChanges }
  })

  /**
   * GET /api/git/unstaged
   * Get list of unstaged (working tree) files
   */
  fastify.get('/api/git/unstaged', {
    schema: {
      tags: ['git'],
      summary: 'Get unstaged changes',
      description: 'Get list of files with unstaged changes in the working tree',
      response: {
        200: UnstagedStatusSchema,
      },
    },
  }, async () => {
    const service = getService()
    const hasUnstagedChanges = await service.hasUnstagedChanges()
    const files = hasUnstagedChanges ? await service.getUnstagedFiles() : []
    return { hasUnstagedChanges, files }
  })

  /**
   * POST /api/git/stage
   * Stage specific files
   */
  fastify.post('/api/git/stage', {
    schema: {
      tags: ['git'],
      summary: 'Stage files',
      description: 'Stage specific files for commit',
      body: StageRequestSchema,
      response: {
        200: StageResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService()
    const { files } = request.body

    if (!files || files.length === 0) {
      return reply.code(400).send({ error: 'No files specified' })
    }

    try {
      await service.stageFiles(files)
      return { success: true, staged: files }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stage files'
      return reply.code(400).send({ error: message })
    }
  })

  /**
   * POST /api/git/stage-all
   * Stage all changes (including untracked files)
   */
  fastify.post('/api/git/stage-all', {
    schema: {
      tags: ['git'],
      summary: 'Stage all files',
      description: 'Stage all changes including untracked files',
      body: StageAllRequestSchema,
      response: {
        200: StageResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService()

    try {
      // Get list of unstaged files before staging
      const unstagedFiles = await service.getUnstagedFiles()
      const filePaths = unstagedFiles.map(f => f.path)

      await service.stageAll()
      return { success: true, staged: filePaths }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stage files'
      return reply.code(400).send({ error: message })
    }
  })

  /**
   * POST /api/git/unstage
   * Unstage specific files
   */
  fastify.post('/api/git/unstage', {
    schema: {
      tags: ['git'],
      summary: 'Unstage files',
      description: 'Unstage specific files (move from staging area back to working tree)',
      body: UnstageRequestSchema,
      response: {
        200: UnstageResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService()
    const { files } = request.body

    if (!files || files.length === 0) {
      return reply.code(400).send({ error: 'No files specified' })
    }

    try {
      for (const file of files) {
        await service.unstageFile(file)
      }
      return { success: true, unstaged: files }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unstage files'
      return reply.code(400).send({ error: message })
    }
  })

  /**
   * GET /api/git/tree/:ref
   * List all files at a specific git ref
   */
  fastify.get('/api/git/tree/:ref', {
    schema: {
      tags: ['git'],
      summary: 'List files at ref',
      description: 'Get a list of all files in the repository at a specific git ref (commit, branch, or HEAD)',
      params: Type.Object({
        ref: Type.String({ description: 'Git ref (commit SHA, branch name, or HEAD)' }),
      }),
      querystring: Type.Object({
        includeWorkingDir: Type.Optional(Type.Boolean({ description: 'Include new files from working directory (staged + untracked)' })),
      }),
      response: {
        200: FileTreeResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService()
    const { ref } = request.params
    const { includeWorkingDir } = request.query

    try {
      let files = await service.getFilesAtRef(ref)

      // Optionally include new files from working directory
      if (includeWorkingDir) {
        const newFiles = await service.getWorkingDirectoryNewFiles()
        if (newFiles.length > 0) {
          const fileSet = new Set(files)
          for (const file of newFiles) {
            fileSet.add(file)
          }
          files = Array.from(fileSet).sort()
        }
      }

      return { ref, files }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get file tree'
      return reply.code(400).send({ error: message })
    }
  })

  /**
   * GET /api/git/file/*
   * Get file content at a specific git ref
   */
  fastify.get('/api/git/file/*', {
    schema: {
      tags: ['git'],
      summary: 'Get file content at ref',
      description: 'Get the content of a file at a specific git ref',
      querystring: FileContentAtRefQuerySchema,
      response: {
        200: FileContentAtRefResponseSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const service = getService()
    const filePath = (request.params as Record<string, string>)['*']
    const { ref } = request.query

    if (!filePath) {
      return reply.code(400).send({ error: 'File path is required' })
    }

    try {
      const content = await service.getFileContentAtRef(filePath, ref)

      if (content === null) {
        return reply.code(404).send({ error: 'File not found' })
      }

      // Check if binary (contains null bytes)
      const isBinary = content.includes('\0')

      if (isBinary) {
        return {
          path: filePath,
          ref,
          content: '',
          lines: [],
          lineCount: 0,
          isBinary: true,
        }
      }

      const lines = content.split('\n')
      return {
        path: filePath,
        ref,
        content,
        lines,
        lineCount: lines.length,
        isBinary: false,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get file content'
      return reply.code(400).send({ error: message })
    }
  })
}

export default gitRoutes
