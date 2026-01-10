/**
 * Git service - handles all git operations
 */
import { simpleGit, type SimpleGit } from 'simple-git'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requestContext } from '../app.ts'
import type { RepositoryInfo } from '../../shared/types.ts'

export class GitService {
  private git: SimpleGit
  private repoPath: string

  constructor (repoPath: string) {
    this.repoPath = repoPath
    this.git = simpleGit(repoPath)
  }

  /** Get the logger from request context */
  private get log () {
    return requestContext.get('log')
  }

  /**
   * Check if the path is a valid git repository
   */
  async isRepo (): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir'])
      return true
    } catch (err) {
      this.log?.debug({ err, repoPath: this.repoPath }, 'isRepo check failed')
      return false
    }
  }

  /**
   * Check if the repository has any commits
   */
  async hasCommits (): Promise<boolean> {
    try {
      await this.git.revparse(['HEAD'])
      return true
    } catch (err) {
      this.log?.debug({ err, repoPath: this.repoPath }, 'hasCommits check failed')
      return false
    }
  }

  /**
   * Get the repository root directory
   */
  async getRepoRoot (): Promise<string> {
    const root = await this.git.revparse(['--show-toplevel'])
    return root.trim()
  }

  /**
   * Get repository metadata
   */
  async getRepositoryInfo (): Promise<RepositoryInfo> {
    const [root, branch, remotes] = await Promise.all([
      this.getRepoRoot(),
      this.getCurrentBranch(),
      this.git.getRemotes(true),
    ])

    const name = root.split('/').pop() ?? 'unknown'
    const originRemote = remotes.find((r) => r.name === 'origin')
    const remote = originRemote?.refs?.fetch ?? null

    return {
      name,
      branch: branch ?? 'main',
      remote,
      path: root,
    }
  }

  /**
   * Get current branch name (returns null for repos without commits)
   */
  async getCurrentBranch (): Promise<string | null> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD'])
      return branch.trim()
    } catch (err) {
      this.log?.debug({ err, repoPath: this.repoPath }, 'getCurrentBranch revparse failed, trying config')
      // No commits yet - try to get the default branch from config
      try {
        const defaultBranch = await this.git.raw(['config', '--get', 'init.defaultBranch'])
        return defaultBranch.trim() || null
      } catch (configErr) {
        this.log?.debug({ err: configErr, repoPath: this.repoPath }, 'getCurrentBranch config fallback failed')
        return null
      }
    }
  }

  /**
   * Get list of staged files with their status
   */
  async getStagedFiles (): Promise<StagedFile[]> {
    const status = await this.git.status()
    const staged: StagedFile[] = []

    for (const file of status.staged) {
      staged.push({
        path: file,
        status: 'modified',
      })
    }

    for (const file of status.created) {
      if (status.staged.includes(file) || await this.isFileStaged(file)) {
        staged.push({
          path: file,
          status: 'added',
        })
      }
    }

    for (const file of status.deleted) {
      if (await this.isFileStaged(file)) {
        staged.push({
          path: file,
          status: 'deleted',
        })
      }
    }

    for (const file of status.renamed) {
      staged.push({
        path: file.to,
        oldPath: file.from,
        status: 'renamed',
      })
    }

    return staged
  }

  /**
   * Check if a specific file is staged
   */
  private async isFileStaged (filePath: string): Promise<boolean> {
    try {
      const result = await this.git.diff(['--cached', '--name-only', '--', filePath])
      return result.trim().length > 0
    } catch (err) {
      this.log?.debug({ err, filePath }, 'isFileStaged check failed')
      return false
    }
  }

  /**
   * Get unified diff for all staged changes
   */
  async getStagedDiff (): Promise<string> {
    const diff = await this.git.diff(['--cached'])
    return diff
  }

  /**
   * Get unified diff for a specific staged file
   */
  async getStagedFileDiff (filePath: string): Promise<string> {
    const diff = await this.git.diff(['--cached', '--', filePath])
    return diff
  }

  /**
   * Get diff statistics for staged changes
   */
  async getStagedDiffStats (): Promise<DiffStats> {
    const numstat = await this.git.diff(['--cached', '--numstat'])

    const files: FileDiffStats[] = []
    const lines = numstat.trim().split('\n').filter(Boolean)

    for (const line of lines) {
      const [additions, deletions, path] = line.split('\t')
      files.push({
        path,
        additions: additions === '-' ? 0 : parseInt(additions, 10),
        deletions: deletions === '-' ? 0 : parseInt(deletions, 10),
      })
    }

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

    return {
      files,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
    }
  }

  /**
   * Check if there are any staged changes
   */
  async hasStagedChanges (): Promise<boolean> {
    const diff = await this.git.diff(['--cached', '--name-only'])
    return diff.trim().length > 0
  }

  /**
   * Get list of unstaged (working tree) files with their status
   */
  async getUnstagedFiles (): Promise<UnstagedFile[]> {
    const status = await this.git.status()
    const unstaged: UnstagedFile[] = []

    // Modified files that are not staged
    for (const file of status.modified) {
      if (!status.staged.includes(file)) {
        unstaged.push({
          path: file,
          status: 'modified',
        })
      }
    }

    // New files that are not staged (untracked)
    for (const file of status.not_added) {
      unstaged.push({
        path: file,
        status: 'untracked',
      })
    }

    // Deleted files that are not staged
    for (const file of status.deleted) {
      const isStaged = await this.isFileStaged(file)
      if (!isStaged) {
        unstaged.push({
          path: file,
          status: 'deleted',
        })
      }
    }

    return unstaged
  }

  /**
   * Check if there are any unstaged changes
   */
  async hasUnstagedChanges (): Promise<boolean> {
    const status = await this.git.status()
    return (
      status.modified.length > 0 ||
      status.not_added.length > 0 ||
      status.deleted.some(f => !status.staged.includes(f))
    )
  }

  /**
   * Get unified diff for all unstaged (working tree) changes
   * Includes both tracked file changes and new untracked files
   */
  async getUnstagedDiff (): Promise<string> {
    // Get regular diff for tracked files
    const diff = await this.git.diff()

    // Get untracked files and generate diff for them
    const status = await this.git.status()
    const untrackedDiffs: string[] = []

    for (const filePath of status.not_added) {
      try {
        const fullPath = join(this.repoPath, filePath)
        const content = await readFile(fullPath, 'utf-8')
        const lines = content.split('\n')

        // Generate unified diff format for new file
        const diffHeader = [
          `diff --git a/${filePath} b/${filePath}`,
          'new file mode 100644',
          '--- /dev/null',
          `+++ b/${filePath}`,
          `@@ -0,0 +1,${lines.length} @@`,
        ]

        const diffLines = lines.map(line => `+${line}`)
        untrackedDiffs.push([...diffHeader, ...diffLines].join('\n'))
      } catch {
        // Skip files that can't be read (binary, permission issues, etc.)
      }
    }

    // Combine tracked changes with untracked file diffs
    if (untrackedDiffs.length > 0) {
      return diff + '\n' + untrackedDiffs.join('\n')
    }

    return diff
  }

  /**
   * Stage a specific file
   */
  async stageFile (filePath: string): Promise<void> {
    await this.git.add(filePath)
  }

  /**
   * Stage multiple files
   */
  async stageFiles (filePaths: string[]): Promise<void> {
    if (filePaths.length > 0) {
      await this.git.add(filePaths)
    }
  }

  /**
   * Stage all changes (including untracked files)
   */
  async stageAll (): Promise<void> {
    await this.git.add('-A')
  }

  /**
   * Unstage a specific file
   */
  async unstageFile (filePath: string): Promise<void> {
    await this.git.reset(['HEAD', '--', filePath])
  }

  /**
   * Get the current HEAD commit SHA (returns null for repos without commits)
   */
  async getHeadSha (): Promise<string | null> {
    try {
      const sha = await this.git.revparse(['HEAD'])
      return sha.trim()
    } catch (err) {
      this.log?.debug({ err, repoPath: this.repoPath }, 'getHeadSha failed')
      return null
    }
  }

  /**
   * Get file content from the staged version (index)
   */
  async getStagedFileContent (filePath: string): Promise<string | null> {
    try {
      const content = await this.git.show([`:${filePath}`])
      return content
    } catch (err) {
      this.log?.debug({ err, filePath }, 'getStagedFileContent failed')
      return null
    }
  }

  /**
   * Get file content from HEAD
   */
  async getHeadFileContent (filePath: string): Promise<string | null> {
    try {
      const content = await this.git.show([`HEAD:${filePath}`])
      return content
    } catch (err) {
      this.log?.debug({ err, filePath }, 'getHeadFileContent failed')
      return null
    }
  }

  /**
   * Get file content from a specific commit/ref
   */
  async getFileContentAtRef (filePath: string, ref: string): Promise<string | null> {
    try {
      const content = await this.git.show([`${ref}:${filePath}`])
      return content
    } catch (err) {
      this.log?.debug({ err, filePath, ref }, 'getFileContentAtRef failed')
      return null
    }
  }

  /**
   * Get binary file content from the staged version (index) as base64
   */
  async getStagedBinaryContent (filePath: string): Promise<Buffer | null> {
    try {
      // Use execFileSync to get raw binary output - simple-git's raw() returns a string
      // which corrupts binary data. execFileSync with array args avoids shell injection.
      const result = execFileSync('git', ['show', `:${filePath}`], {
        cwd: this.repoPath,
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024, // 50MB max
      })
      return result
    } catch (err) {
      this.log?.debug({ err, filePath }, 'getStagedBinaryContent failed')
      return null
    }
  }

  /**
   * Get binary file content from HEAD as base64
   */
  async getHeadBinaryContent (filePath: string): Promise<Buffer | null> {
    try {
      // Use execFileSync to get raw binary output - simple-git's raw() returns a string
      // which corrupts binary data. execFileSync with array args avoids shell injection.
      const result = execFileSync('git', ['show', `HEAD:${filePath}`], {
        cwd: this.repoPath,
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024, // 50MB max
      })
      return result
    } catch (err) {
      this.log?.debug({ err, filePath }, 'getHeadBinaryContent failed')
      return null
    }
  }

  /**
   * Get diff between current branch and another branch
   * Shows what's in targetBranch that's not in HEAD (for code review)
   */
  async getBranchDiff (targetBranch: string): Promise<string> {
    // Get diff from HEAD to target branch (shows what's in target branch, not in HEAD)
    const diff = await this.git.diff([`HEAD...${targetBranch}`])
    return diff
  }

  /**
   * Get diff for specific commits
   */
  async getCommitsDiff (commits: string[]): Promise<string> {
    if (commits.length === 0) {
      return ''
    }

    if (commits.length === 1) {
      // Single commit - show that commit's diff
      const diff = await this.git.show([commits[0], '--format='])
      return diff
    }

    // Multiple commits - combine individual diffs
    // This works regardless of commit order or whether they're contiguous
    const diffs: string[] = []
    for (const commit of commits) {
      const diff = await this.git.show([commit, '--format='])
      if (diff.trim()) {
        diffs.push(diff)
      }
    }
    return diffs.join('\n')
  }

  /**
   * List all branches (local and remote)
   */
  async getBranches (): Promise<BranchInfo[]> {
    const result = await this.git.branch(['-a', '-v'])
    const branches: BranchInfo[] = []

    for (const branch of result.all) {
      const isRemote = branch.startsWith('remotes/')
      const isCurrent = branch === result.current
      const name = isRemote ? branch.replace(/^remotes\/origin\//, '') : branch

      // Skip HEAD pointer
      if (name === 'HEAD') continue

      branches.push({
        name,
        isRemote,
        isCurrent,
      })
    }

    // Deduplicate (local and remote with same name)
    const seen = new Set<string>()
    return branches.filter(b => {
      if (seen.has(b.name)) return false
      seen.add(b.name)
      return true
    })
  }

  /**
   * Sanitize search input to prevent regex injection
   * Only allows alphanumeric characters, spaces, and basic punctuation
   */
  private sanitizeSearch (search: string): string {
    // Limit length and remove potentially dangerous regex characters
    // Allow: alphanumeric, spaces, hyphens, underscores, dots, and common punctuation
    const sanitized = search
      .slice(0, 100) // Limit length
      .replace(/[^\w\s\-_.,'":;!?@#]/g, '') // Remove special chars except safe ones
    return sanitized
  }

  /**
   * Get recent commits with pagination and search
   */
  async getCommits (options: GetCommitsOptions = {}): Promise<GetCommitsResult> {
    const { limit = 20, offset = 0, search } = options

    // Build git log arguments
    const args = ['log', `--skip=${offset}`, `-${limit + 1}`, '--format=%H|%s|%an|%ai']

    // Add search filter if provided (searches commit message)
    if (search) {
      const sanitizedSearch = this.sanitizeSearch(search)
      if (sanitizedSearch) {
        // Use --fixed-strings for literal matching (prevents regex interpretation)
        // Note: --grep and --author together require BOTH to match (AND logic)
        // So we only search by message for simplicity
        args.push(`--grep=${sanitizedSearch}`, '--regexp-ignore-case', '--fixed-strings')
      }
    }

    const rawLog = await this.git.raw(args)
    const commits: CommitInfo[] = []

    const lines = rawLog.trim().split('\n').filter(line => line.length > 0)
    for (const line of lines) {
      const [sha, message, author, date] = line.split('|')
      if (sha) {
        commits.push({
          sha,
          message: message || '',
          author: author || '',
          date: date || '',
        })
      }
    }

    // Check if there are more commits (we fetched limit+1)
    const hasMore = commits.length > limit
    if (hasMore) {
      commits.pop() // Remove the extra commit
    }

    return {
      commits,
      hasMore,
    }
  }
}

export interface GetCommitsOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface GetCommitsResult {
  commits: CommitInfo[];
  hasMore: boolean;
}

export interface StagedFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface UnstagedFile {
  path: string;
  status: 'modified' | 'deleted' | 'untracked';
}

export interface FileDiffStats {
  path: string;
  additions: number;
  deletions: number;
}

export interface DiffStats {
  files: FileDiffStats[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isCurrent: boolean;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}
