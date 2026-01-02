/**
 * Git service - handles all git operations
 */
import { simpleGit, type SimpleGit } from 'simple-git';
import type { RepositoryInfo } from '../../shared/types.ts';

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Check if the path is a valid git repository
   */
  async isRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if the repository has any commits
   */
  async hasCommits(): Promise<boolean> {
    try {
      await this.git.revparse(['HEAD']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the repository root directory
   */
  async getRepoRoot(): Promise<string> {
    const root = await this.git.revparse(['--show-toplevel']);
    return root.trim();
  }

  /**
   * Get repository metadata
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    const [root, branch, remotes] = await Promise.all([
      this.getRepoRoot(),
      this.getCurrentBranch(),
      this.git.getRemotes(true),
    ]);

    const name = root.split('/').pop() ?? 'unknown';
    const originRemote = remotes.find((r) => r.name === 'origin');
    const remote = originRemote?.refs?.fetch ?? null;

    return {
      name,
      branch: branch ?? 'main',
      remote,
      path: root,
    };
  }

  /**
   * Get current branch name (returns null for repos without commits)
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch {
      // No commits yet - try to get the default branch from config
      try {
        const defaultBranch = await this.git.raw(['config', '--get', 'init.defaultBranch']);
        return defaultBranch.trim() || null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Get list of staged files with their status
   */
  async getStagedFiles(): Promise<StagedFile[]> {
    const status = await this.git.status();
    const staged: StagedFile[] = [];

    for (const file of status.staged) {
      staged.push({
        path: file,
        status: 'modified',
      });
    }

    for (const file of status.created) {
      if (status.staged.includes(file) || await this.isFileStaged(file)) {
        staged.push({
          path: file,
          status: 'added',
        });
      }
    }

    for (const file of status.deleted) {
      if (await this.isFileStaged(file)) {
        staged.push({
          path: file,
          status: 'deleted',
        });
      }
    }

    for (const file of status.renamed) {
      staged.push({
        path: file.to,
        oldPath: file.from,
        status: 'renamed',
      });
    }

    return staged;
  }

  /**
   * Check if a specific file is staged
   */
  private async isFileStaged(filePath: string): Promise<boolean> {
    try {
      const result = await this.git.diff(['--cached', '--name-only', '--', filePath]);
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get unified diff for all staged changes
   */
  async getStagedDiff(): Promise<string> {
    const diff = await this.git.diff(['--cached']);
    return diff;
  }

  /**
   * Get unified diff for a specific staged file
   */
  async getStagedFileDiff(filePath: string): Promise<string> {
    const diff = await this.git.diff(['--cached', '--', filePath]);
    return diff;
  }

  /**
   * Get diff statistics for staged changes
   */
  async getStagedDiffStats(): Promise<DiffStats> {
    const diffStat = await this.git.diff(['--cached', '--stat']);
    const numstat = await this.git.diff(['--cached', '--numstat']);

    const files: FileDiffStats[] = [];
    const lines = numstat.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const [additions, deletions, path] = line.split('\t');
      files.push({
        path,
        additions: additions === '-' ? 0 : parseInt(additions, 10),
        deletions: deletions === '-' ? 0 : parseInt(deletions, 10),
      });
    }

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    return {
      files,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
    };
  }

  /**
   * Check if there are any staged changes
   */
  async hasStagedChanges(): Promise<boolean> {
    const diff = await this.git.diff(['--cached', '--name-only']);
    return diff.trim().length > 0;
  }

  /**
   * Get the current HEAD commit SHA (returns null for repos without commits)
   */
  async getHeadSha(): Promise<string | null> {
    try {
      const sha = await this.git.revparse(['HEAD']);
      return sha.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get file content from the staged version (index)
   */
  async getStagedFileContent(filePath: string): Promise<string | null> {
    try {
      const content = await this.git.show([`:${filePath}`]);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get file content from HEAD
   */
  async getHeadFileContent(filePath: string): Promise<string | null> {
    try {
      const content = await this.git.show([`HEAD:${filePath}`]);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get file content from a specific commit/ref
   */
  async getFileContentAtRef(filePath: string, ref: string): Promise<string | null> {
    try {
      const content = await this.git.show([`${ref}:${filePath}`]);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Get binary file content from the staged version (index) as base64
   */
  async getStagedBinaryContent(filePath: string): Promise<Buffer | null> {
    try {
      const result = await this.git.raw(['show', `:${filePath}`]);
      return Buffer.from(result, 'binary');
    } catch {
      return null;
    }
  }

  /**
   * Get binary file content from HEAD as base64
   */
  async getHeadBinaryContent(filePath: string): Promise<Buffer | null> {
    try {
      const result = await this.git.raw(['show', `HEAD:${filePath}`]);
      return Buffer.from(result, 'binary');
    } catch {
      return null;
    }
  }

  /**
   * Get diff between current branch and another branch
   */
  async getBranchDiff(targetBranch: string): Promise<string> {
    // Get diff from target branch to HEAD (shows what would be merged)
    const diff = await this.git.diff([`${targetBranch}...HEAD`]);
    return diff;
  }

  /**
   * Get diff for specific commits
   */
  async getCommitsDiff(commits: string[]): Promise<string> {
    if (commits.length === 0) {
      return '';
    }

    if (commits.length === 1) {
      // Single commit - show that commit's diff
      const diff = await this.git.show([commits[0], '--format=']);
      return diff;
    }

    // Multiple commits - combine individual diffs
    // This works regardless of commit order or whether they're contiguous
    const diffs: string[] = [];
    for (const commit of commits) {
      const diff = await this.git.show([commit, '--format=']);
      if (diff.trim()) {
        diffs.push(diff);
      }
    }
    return diffs.join('\n');
  }

  /**
   * List all branches (local and remote)
   */
  async getBranches(): Promise<BranchInfo[]> {
    const result = await this.git.branch(['-a', '-v']);
    const branches: BranchInfo[] = [];

    for (const branch of result.all) {
      const isRemote = branch.startsWith('remotes/');
      const isCurrent = branch === result.current;
      const name = isRemote ? branch.replace(/^remotes\/origin\//, '') : branch;

      // Skip HEAD pointer
      if (name === 'HEAD') continue;

      branches.push({
        name,
        isRemote,
        isCurrent,
      });
    }

    // Deduplicate (local and remote with same name)
    const seen = new Set<string>();
    return branches.filter(b => {
      if (seen.has(b.name)) return false;
      seen.add(b.name);
      return true;
    });
  }

  /**
   * Get recent commits
   */
  async getCommits(limit: number = 20): Promise<CommitInfo[]> {
    // Use raw() to get properly formatted output since log() doesn't parse custom formats well
    const rawLog = await this.git.raw(['log', `-${limit}`, '--format=%H|%s|%an|%ai']);
    const commits: CommitInfo[] = [];

    const lines = rawLog.trim().split('\n').filter(line => line.length > 0);
    for (const line of lines) {
      const [sha, message, author, date] = line.split('|');
      if (sha) {
        commits.push({
          sha,
          message: message || '',
          author: author || '',
          date: date || '',
        });
      }
    }

    return commits;
  }
}

export interface StagedFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
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
