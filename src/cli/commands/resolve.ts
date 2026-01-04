/**
 * Resolve command - mark a review as approved and resolve all comments
 */
import { parseArgs } from 'node:util';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/index.ts';
import { createConfig } from '../../server/config.ts';

function printHelp() {
  console.log(`
Usage: githuman resolve <review-id|last> [options]

Mark a review as approved and resolve all its comments.

Arguments:
  review-id              The ID of the review to resolve, or "last" for the most recent

Options:
  --json                 Output as JSON
  -h, --help             Show this help message
`);
}

function getLastReviewId(db: ReturnType<typeof getDatabase>): string | null {
  const stmt = db.prepare('SELECT id FROM reviews ORDER BY created_at DESC LIMIT 1');
  const row = stmt.get() as { id: string } | undefined;
  return row?.id ?? null;
}

interface ResolveResult {
  reviewId: string;
  previousStatus: string;
  newStatus: string;
  commentsResolved: number;
  commentsAlreadyResolved: number;
}

export async function resolveCommand(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  let reviewId = positionals[0];

  if (!reviewId) {
    console.error('Error: review-id is required\n');
    printHelp();
    process.exit(1);
  }

  const config = createConfig();

  try {
    initDatabase(config.dbPath);
    const db = getDatabase();

    // Handle "last" keyword
    if (reviewId === 'last') {
      const lastId = getLastReviewId(db);
      if (!lastId) {
        console.error('Error: No reviews found');
        process.exit(1);
      }
      reviewId = lastId;
    }

    // Get current review
    const reviewStmt = db.prepare('SELECT id, status FROM reviews WHERE id = ?');
    const review = reviewStmt.get(reviewId) as { id: string; status: string } | undefined;

    if (!review) {
      console.error(`Error: Review not found: ${reviewId}`);
      process.exit(1);
    }

    const previousStatus = review.status;

    // Update review status to approved
    const now = new Date().toISOString();
    const updateReviewStmt = db.prepare('UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?');
    updateReviewStmt.run('approved', now, reviewId);

    // Get all comments for this review
    const commentsStmt = db.prepare('SELECT id, resolved FROM comments WHERE review_id = ?');
    const comments = commentsStmt.all(reviewId) as Array<{ id: string; resolved: number }>;

    // Resolve all unresolved comments
    const unresolvedComments = comments.filter((c) => !c.resolved);
    const alreadyResolved = comments.length - unresolvedComments.length;

    if (unresolvedComments.length > 0) {
      const resolveStmt = db.prepare('UPDATE comments SET resolved = 1, updated_at = ? WHERE id = ?');
      for (const comment of unresolvedComments) {
        resolveStmt.run(now, comment.id);
      }
    }

    const result: ResolveResult = {
      reviewId,
      previousStatus,
      newStatus: 'approved',
      commentsResolved: unresolvedComments.length,
      commentsAlreadyResolved: alreadyResolved,
    };

    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Review ${reviewId} resolved:`);
      console.log(`  Status: ${previousStatus} -> approved`);
      console.log(`  Comments resolved: ${unresolvedComments.length}`);
      if (alreadyResolved > 0) {
        console.log(`  Comments already resolved: ${alreadyResolved}`);
      }
    }

    closeDatabase();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('Error: Database does not exist. No reviews have been created yet.');
      process.exit(1);
    } else {
      throw err;
    }
  }
}
