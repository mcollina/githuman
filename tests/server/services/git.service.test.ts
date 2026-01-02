import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitService } from '../../../src/server/services/git.service.ts';

describe('git.service', () => {
  // Use current directory which is a git repo
  const git = new GitService(process.cwd());

  describe('getCommits', () => {
    it('should return an array of commits', async () => {
      const commits = await git.getCommits(5);

      assert.ok(Array.isArray(commits));
      assert.ok(commits.length > 0);
      assert.ok(commits.length <= 5);
    });

    it('should return commits with required properties', async () => {
      const commits = await git.getCommits(1);

      assert.strictEqual(commits.length, 1);
      const commit = commits[0];

      assert.ok(typeof commit.sha === 'string');
      assert.ok(commit.sha.length === 40, 'SHA should be 40 characters');
      assert.ok(typeof commit.message === 'string');
      assert.ok(typeof commit.author === 'string');
      assert.ok(typeof commit.date === 'string');
    });

    it('should respect the limit parameter', async () => {
      const commits3 = await git.getCommits(3);
      const commits10 = await git.getCommits(10);

      assert.ok(commits3.length <= 3);
      assert.ok(commits10.length <= 10);
      assert.ok(commits10.length >= commits3.length);
    });

    it('should return commits in order (newest first)', async () => {
      const commits = await git.getCommits(5);

      if (commits.length >= 2) {
        // Parse dates and compare - newer should come first
        const date1 = new Date(commits[0].date);
        const date2 = new Date(commits[1].date);
        assert.ok(date1 >= date2, 'Commits should be ordered newest first');
      }
    });
  });

  describe('getCommitsDiff', () => {
    it('should return empty string for empty commits array', async () => {
      const diff = await git.getCommitsDiff([]);
      assert.strictEqual(diff, '');
    });

    it('should return diff for a single commit', async () => {
      const commits = await git.getCommits(1);
      assert.ok(commits.length > 0, 'Need at least one commit to test');

      const diff = await git.getCommitsDiff([commits[0].sha]);

      // Diff should be a string (could be empty if commit has no changes)
      assert.ok(typeof diff === 'string');
    });

    it('should return combined diff for multiple commits', async () => {
      const commits = await git.getCommits(3);

      if (commits.length >= 2) {
        const diff = await git.getCommitsDiff([commits[0].sha, commits[1].sha]);

        // Should return a string with diff content
        assert.ok(typeof diff === 'string');
      }
    });

    it('should handle commits in any order', async () => {
      const commits = await git.getCommits(3);

      if (commits.length >= 2) {
        // Order shouldn't matter - we combine individual diffs
        const diff1 = await git.getCommitsDiff([commits[0].sha, commits[1].sha]);
        const diff2 = await git.getCommitsDiff([commits[1].sha, commits[0].sha]);

        // Both should be valid strings
        assert.ok(typeof diff1 === 'string');
        assert.ok(typeof diff2 === 'string');
      }
    });
  });

  describe('getBranches', () => {
    it('should return an array of branches', async () => {
      const branches = await git.getBranches();

      assert.ok(Array.isArray(branches));
      assert.ok(branches.length > 0, 'Should have at least one branch');
    });

    it('should have one current branch', async () => {
      const branches = await git.getBranches();
      const currentBranches = branches.filter(b => b.isCurrent);

      assert.strictEqual(currentBranches.length, 1, 'Should have exactly one current branch');
    });

    it('should return branches with required properties', async () => {
      const branches = await git.getBranches();

      for (const branch of branches) {
        assert.ok(typeof branch.name === 'string');
        assert.ok(typeof branch.isRemote === 'boolean');
        assert.ok(typeof branch.isCurrent === 'boolean');
      }
    });
  });

  describe('isRepo', () => {
    it('should return true for a git repository', async () => {
      const result = await git.isRepo();
      assert.strictEqual(result, true);
    });

    it('should return false for a non-git directory', async () => {
      const nonGit = new GitService('/tmp');
      const result = await nonGit.isRepo();
      assert.strictEqual(result, false);
    });
  });

  describe('hasCommits', () => {
    it('should return true for a repository with commits', async () => {
      const result = await git.hasCommits();
      assert.strictEqual(result, true);
    });

    it('should return false for a non-git directory', async () => {
      const nonGit = new GitService('/tmp');
      const result = await nonGit.hasCommits();
      assert.strictEqual(result, false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await git.getCurrentBranch();

      assert.ok(typeof branch === 'string');
      assert.ok(branch.length > 0);
    });
  });
});
