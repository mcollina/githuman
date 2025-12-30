import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseDiff, getDiffSummary } from '../../../src/server/services/diff.service.ts';

describe('diff.service', () => {
  describe('parseDiff', () => {
    it('should return empty array for empty diff', () => {
      const result = parseDiff('');
      assert.deepStrictEqual(result, []);
    });

    it('should return empty array for whitespace-only diff', () => {
      const result = parseDiff('   \n\n  ');
      assert.deepStrictEqual(result, []);
    });

    it('should parse a simple modified file diff', () => {
      const diff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
-old line 2
+new line 2
+added line
 line 3`;

      const result = parseDiff(diff);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].oldPath, 'file.txt');
      assert.strictEqual(result[0].newPath, 'file.txt');
      assert.strictEqual(result[0].status, 'modified');
      assert.strictEqual(result[0].additions, 2);
      assert.strictEqual(result[0].deletions, 1);
      assert.strictEqual(result[0].hunks.length, 1);
    });

    it('should parse a new file diff', () => {
      const diff = `diff --git a/newfile.txt b/newfile.txt
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

      const result = parseDiff(diff);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].status, 'added');
      assert.strictEqual(result[0].additions, 3);
      assert.strictEqual(result[0].deletions, 0);
    });

    it('should parse a deleted file diff', () => {
      const diff = `diff --git a/deleted.txt b/deleted.txt
deleted file mode 100644
index 1234567..0000000
--- a/deleted.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line 1
-line 2`;

      const result = parseDiff(diff);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].status, 'deleted');
      assert.strictEqual(result[0].additions, 0);
      assert.strictEqual(result[0].deletions, 2);
    });

    it('should parse a renamed file diff', () => {
      const diff = `diff --git a/old-name.txt b/new-name.txt
similarity index 100%
rename from old-name.txt
rename to new-name.txt`;

      const result = parseDiff(diff);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].oldPath, 'old-name.txt');
      assert.strictEqual(result[0].newPath, 'new-name.txt');
      assert.strictEqual(result[0].status, 'renamed');
    });

    it('should parse multiple files diff', () => {
      const diff = `diff --git a/file1.txt b/file1.txt
index 1234567..abcdefg 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-old
+new
diff --git a/file2.txt b/file2.txt
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/file2.txt
@@ -0,0 +1 @@
+content`;

      const result = parseDiff(diff);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].newPath, 'file1.txt');
      assert.strictEqual(result[0].status, 'modified');
      assert.strictEqual(result[1].newPath, 'file2.txt');
      assert.strictEqual(result[1].status, 'added');
    });

    it('should correctly track line numbers', () => {
      const diff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -5,4 +5,5 @@
 context line 5
-removed line 6
+added line 6a
+added line 6b
 context line 7
 context line 8`;

      const result = parseDiff(diff);
      const lines = result[0].hunks[0].lines;

      // Context line
      assert.strictEqual(lines[0].type, 'context');
      assert.strictEqual(lines[0].oldLineNumber, 5);
      assert.strictEqual(lines[0].newLineNumber, 5);

      // Removed line
      assert.strictEqual(lines[1].type, 'removed');
      assert.strictEqual(lines[1].oldLineNumber, 6);
      assert.strictEqual(lines[1].newLineNumber, null);

      // Added lines
      assert.strictEqual(lines[2].type, 'added');
      assert.strictEqual(lines[2].oldLineNumber, null);
      assert.strictEqual(lines[2].newLineNumber, 6);

      assert.strictEqual(lines[3].type, 'added');
      assert.strictEqual(lines[3].oldLineNumber, null);
      assert.strictEqual(lines[3].newLineNumber, 7);
    });

    it('should parse multiple hunks', () => {
      const diff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-old line 2
+new line 2
 line 3
@@ -10,3 +10,3 @@
 line 10
-old line 11
+new line 11
 line 12`;

      const result = parseDiff(diff);

      assert.strictEqual(result[0].hunks.length, 2);
      assert.strictEqual(result[0].hunks[0].oldStart, 1);
      assert.strictEqual(result[0].hunks[1].oldStart, 10);
    });
  });

  describe('getDiffSummary', () => {
    it('should return zeros for empty files array', () => {
      const summary = getDiffSummary([]);

      assert.strictEqual(summary.totalFiles, 0);
      assert.strictEqual(summary.totalAdditions, 0);
      assert.strictEqual(summary.totalDeletions, 0);
    });

    it('should calculate correct totals', () => {
      const files = [
        { oldPath: 'a.txt', newPath: 'a.txt', status: 'modified' as const, additions: 5, deletions: 2, hunks: [] },
        { oldPath: 'b.txt', newPath: 'b.txt', status: 'added' as const, additions: 10, deletions: 0, hunks: [] },
        { oldPath: 'c.txt', newPath: 'c.txt', status: 'deleted' as const, additions: 0, deletions: 8, hunks: [] },
      ];

      const summary = getDiffSummary(files);

      assert.strictEqual(summary.totalFiles, 3);
      assert.strictEqual(summary.totalAdditions, 15);
      assert.strictEqual(summary.totalDeletions, 10);
      assert.strictEqual(summary.filesAdded, 1);
      assert.strictEqual(summary.filesModified, 1);
      assert.strictEqual(summary.filesDeleted, 1);
      assert.strictEqual(summary.filesRenamed, 0);
    });
  });
});
