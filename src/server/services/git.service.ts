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
      branch,
      remote,
      path: root,
    };
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
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
   * Get the current HEAD commit SHA
   */
  async getHeadSha(): Promise<string> {
    const sha = await this.git.revparse(['HEAD']);
    return sha.trim();
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
