/**
 * Diff API routes
 */
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { GitService } from '../services/git.service.ts'
import { parseDiff, getDiffSummary, filterDiffFiles } from '../services/diff.service.ts'
import { loadGitignore } from '../utils/gitignore.ts'
import { ErrorSchema } from '../schemas/common.ts'

const DiffLineSchema = Type.Object({
  type: Type.Union([Type.Literal('added'), Type.Literal('removed'), Type.Literal('context')]),
  content: Type.String(),
  oldLineNumber: Type.Union([Type.Integer(), Type.Null()]),
  newLineNumber: Type.Union([Type.Integer(), Type.Null()]),
})

const DiffHunkSchema = Type.Object({
  oldStart: Type.Integer(),
  oldLines: Type.Integer(),
  newStart: Type.Integer(),
  newLines: Type.Integer(),
  lines: Type.Array(DiffLineSchema),
})

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
)

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
)

const RepositoryInfoSchema = Type.Object(
  {
    name: Type.String({ description: 'Repository name' }),
    branch: Type.String({ description: 'Current branch' }),
    remote: Type.Union([Type.String(), Type.Null()], { description: 'Remote URL' }),
    path: Type.String({ description: 'Repository path' }),
  },
  { description: 'Repository information' }
)

const StagedDiffResponseSchema = Type.Object(
  {
    files: Type.Array(DiffFileSchema),
    summary: DiffSummarySchema,
    repository: RepositoryInfoSchema,
  },
  { description: 'Staged diff response' }
)

const UnstagedDiffResponseSchema = Type.Object(
  {
    files: Type.Array(DiffFileSchema),
    summary: DiffSummarySchema,
    repository: RepositoryInfoSchema,
  },
  { description: 'Unstaged diff response' }
)

const StagedFileSchema = Type.Object({
  path: Type.String({ description: 'File path' }),
  oldPath: Type.Optional(Type.String({ description: 'Original path for renames' })),
  status: Type.Union([
    Type.Literal('added'),
    Type.Literal('modified'),
    Type.Literal('deleted'),
    Type.Literal('renamed'),
  ]),
  additions: Type.Integer({ description: 'Lines added' }),
  deletions: Type.Integer({ description: 'Lines deleted' }),
})

const StagedFilesResponseSchema = Type.Object(
  {
    files: Type.Array(StagedFileSchema),
    hasStagedChanges: Type.Boolean({ description: 'Whether there are staged changes' }),
  },
  { description: 'Staged files response' }
)

const RepositoryInfoExtendedSchema = Type.Intersect([
  RepositoryInfoSchema,
  Type.Object({
    hasCommits: Type.Boolean({ description: 'Whether repository has commits' }),
  }),
])

const FileVersionQuerystringSchema = Type.Object({
  version: Type.Optional(
    Type.Union([Type.Literal('staged'), Type.Literal('head'), Type.Literal('working')], {
      default: 'staged',
      description: 'File version to retrieve: staged (index), head (last commit), or working (disk)',
    })
  ),
})

const FileContentResponseSchema = Type.Object(
  {
    path: Type.String({ description: 'File path' }),
    version: Type.Union([Type.Literal('staged'), Type.Literal('head'), Type.Literal('working')]),
    content: Type.String({ description: 'File content' }),
    lines: Type.Array(Type.String(), { description: 'Lines array' }),
    lineCount: Type.Integer({ description: 'Number of lines' }),
  },
  { description: 'File content response' }
)

const WildcardParamsSchema = Type.Object({
  '*': Type.String({ description: 'File path' }),
})

const diffRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  /**
   * GET /api/diff/staged
   * Returns parsed diff data for all staged changes
   */
  fastify.get('/api/diff/staged', {
    schema: {
      tags: ['diff'],
      summary: 'Get staged diff',
      description: 'Returns parsed diff data for all staged changes in the repository',
      response: {
        200: StagedDiffResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const gitService = new GitService(fastify.config.repositoryPath)

    // Check if it's a git repository
    if (!(await gitService.isRepo())) {
      return reply.code(400).send({
        error: 'Not a git repository',
        code: 'NOT_GIT_REPO',
      })
    }

    // Check if the repository has any commits
    if (!(await gitService.hasCommits())) {
      return reply.code(400).send({
        error: 'Repository has no commits yet. Create an initial commit first.',
        code: 'NO_COMMITS',
      })
    }

    // Check if there are staged changes
    if (!(await gitService.hasStagedChanges())) {
      const repoInfo = await gitService.getRepositoryInfo()
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
      }
    }

    // Get and parse the diff
    const diffText = await gitService.getStagedDiff()
    const allFiles = parseDiff(diffText)

    // Filter out files matching .gitignore patterns
    const ig = await loadGitignore(fastify.config.repositoryPath, request.log)
    const files = filterDiffFiles(allFiles, ig)

    const summary = getDiffSummary(files)
    const repository = await gitService.getRepositoryInfo()

    return {
      files,
      summary,
      repository,
    }
  })

  /**
   * GET /api/diff/unstaged
   * Returns parsed diff data for all unstaged (working tree) changes
   */
  fastify.get('/api/diff/unstaged', {
    schema: {
      tags: ['diff'],
      summary: 'Get unstaged diff',
      description: 'Returns parsed diff data for all unstaged changes in the working tree',
      response: {
        200: UnstagedDiffResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const gitService = new GitService(fastify.config.repositoryPath)

    // Check if it's a git repository
    if (!(await gitService.isRepo())) {
      return reply.code(400).send({
        error: 'Not a git repository',
        code: 'NOT_GIT_REPO',
      })
    }

    // Check if the repository has any commits
    if (!(await gitService.hasCommits())) {
      return reply.code(400).send({
        error: 'Repository has no commits yet. Create an initial commit first.',
        code: 'NO_COMMITS',
      })
    }

    // Check if there are unstaged changes
    if (!(await gitService.hasUnstagedChanges())) {
      const repoInfo = await gitService.getRepositoryInfo()
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
      }
    }

    // Get and parse the diff
    const diffText = await gitService.getUnstagedDiff()
    const allFiles = parseDiff(diffText)

    // Filter out files matching .gitignore patterns
    const ig = await loadGitignore(fastify.config.repositoryPath, request.log)
    const files = filterDiffFiles(allFiles, ig)

    const summary = getDiffSummary(files)
    const repository = await gitService.getRepositoryInfo()

    return {
      files,
      summary,
      repository,
    }
  })

  /**
   * GET /api/diff/files
   * Returns list of staged files with stats
   */
  fastify.get('/api/diff/files', {
    schema: {
      tags: ['diff'],
      summary: 'Get staged files list',
      description: 'Returns list of staged files with addition/deletion stats',
      response: {
        200: StagedFilesResponseSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const gitService = new GitService(fastify.config.repositoryPath)

    // Check if it's a git repository
    if (!(await gitService.isRepo())) {
      return reply.code(400).send({
        error: 'Not a git repository',
      })
    }

    const hasStagedChanges = await gitService.hasStagedChanges()

    if (!hasStagedChanges) {
      return {
        files: [],
        hasStagedChanges: false,
      }
    }

    // Get staged files and stats
    const stagedFiles = await gitService.getStagedFiles()
    const stats = await gitService.getStagedDiffStats()

    // Merge file info with stats
    const files = stagedFiles.map((file) => {
      const fileStat = stats.files.find((s) => s.path === file.path)
      return {
        path: file.path,
        oldPath: file.oldPath,
        status: file.status,
        additions: fileStat?.additions ?? 0,
        deletions: fileStat?.deletions ?? 0,
      }
    })

    return {
      files,
      hasStagedChanges: true,
    }
  })

  /**
   * GET /api/info
   * Returns repository information
   */
  fastify.get('/api/info', {
    schema: {
      tags: ['git'],
      summary: 'Get repository info',
      description: 'Returns basic information about the current repository',
      response: {
        200: RepositoryInfoExtendedSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const gitService = new GitService(fastify.config.repositoryPath)

    // Check if it's a git repository
    if (!(await gitService.isRepo())) {
      return reply.code(400).send({
        error: 'Not a git repository',
        code: 'NOT_GIT_REPO',
      })
    }

    const hasCommits = await gitService.hasCommits()
    const repoInfo = await gitService.getRepositoryInfo()

    return {
      ...repoInfo,
      hasCommits,
    }
  })

  /**
   * GET /api/diff/file/:path
   * Returns the full content of a staged file
   * Query params:
   *   - version: 'staged' (default) or 'head'
   */
  fastify.get('/api/diff/file/*', {
    schema: {
      tags: ['diff'],
      summary: 'Get file content',
      description: 'Returns the full content of a file from either the staged version or HEAD',
      params: WildcardParamsSchema,
      querystring: FileVersionQuerystringSchema,
      response: {
        200: FileContentResponseSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const filePath = request.params['*']
    const version = request.query.version ?? 'staged'

    if (!filePath) {
      return reply.code(400).send({ error: 'File path is required' })
    }

    const gitService = new GitService(fastify.config.repositoryPath)

    if (!(await gitService.isRepo())) {
      return reply.code(400).send({ error: 'Not a git repository' })
    }

    let content: string | null = null

    if (version === 'head') {
      content = await gitService.getHeadFileContent(filePath)
    } else if (version === 'working') {
      content = await gitService.getWorkingFileContent(filePath)
    } else {
      // Default to staged, fall back to working if not found
      content = await gitService.getStagedFileContent(filePath)
      if (content === null) {
        content = await gitService.getWorkingFileContent(filePath)
      }
    }

    if (content === null) {
      return reply.code(404).send({ error: 'File not found' })
    }

    const lines = content.split('\n')

    return {
      path: filePath,
      version,
      content,
      lines,
      lineCount: lines.length,
    }
  })
}

// Helper to get MIME type from file extension
function getMimeType (filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * GET /api/diff/image/:path
 * Returns the raw image content from git
 * Query params:
 *   - version: 'staged' (default) or 'head'
 */
const imageRoute: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/api/diff/image/*', {
    schema: {
      tags: ['diff'],
      summary: 'Get image content',
      description: 'Returns raw image content from either the staged version or HEAD',
      params: WildcardParamsSchema,
      querystring: FileVersionQuerystringSchema,
    },
  }, async (request, reply) => {
    const filePath = request.params['*']
    const version = request.query.version ?? 'staged'

    if (!filePath) {
      return reply.code(400).send({ error: 'File path is required' })
    }

    const gitService = new GitService(fastify.config.repositoryPath)

    if (!(await gitService.isRepo())) {
      return reply.code(400).send({ error: 'Not a git repository' })
    }

    let content: Buffer | null = null

    if (version === 'head') {
      content = await gitService.getHeadBinaryContent(filePath)
    } else if (version === 'working') {
      content = await gitService.getWorkingBinaryContent(filePath)
    } else {
      // Default to staged, but fall back to working directory if not found in staging
      content = await gitService.getStagedBinaryContent(filePath)
      if (content === null) {
        content = await gitService.getWorkingBinaryContent(filePath)
      }
    }

    if (content === null) {
      return reply.code(404).send({ error: 'Image not found' })
    }

    const mimeType = getMimeType(filePath)
    return reply.header('Content-Type', mimeType).send(content)
  })
}

export { imageRoute }
export default diffRoutes
