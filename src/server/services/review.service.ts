/**
 * Review service - business logic for review management
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ReviewRepository } from '../repositories/review.repo.ts';
import { GitService } from './git.service.ts';
import { parseDiff, getDiffSummary, type DiffSummary } from './diff.service.ts';
import type {
  Review,
  ReviewStatus,
  DiffFile,
  RepositoryInfo,
  CreateReviewRequest,
  UpdateReviewRequest,
  PaginatedResponse,
} from '../../shared/types.ts';

export interface ReviewWithDetails extends Omit<Review, 'snapshotData'> {
  files: DiffFile[];
  summary: DiffSummary;
  repository: RepositoryInfo;
}

export interface ReviewListItem extends Omit<Review, 'snapshotData'> {
  summary: DiffSummary;
}

export class ReviewService {
  private repo: ReviewRepository;
  private git: GitService;

  constructor(db: DatabaseSync, repositoryPath: string) {
    this.repo = new ReviewRepository(db);
    this.git = new GitService(repositoryPath);
  }

  /**
   * Create a new review from current staged changes
   */
  async create(request: CreateReviewRequest): Promise<ReviewWithDetails> {
    // Verify we're in a git repo
    const isRepo = await this.git.isRepo();
    if (!isRepo) {
      throw new ReviewError('Not a git repository', 'NOT_GIT_REPO');
    }

    // Get staged diff
    const diffText = await this.git.getStagedDiff();
    const hasStagedChanges = await this.git.hasStagedChanges();

    if (!hasStagedChanges) {
      throw new ReviewError('No staged changes to review', 'NO_STAGED_CHANGES');
    }

    // Parse diff and get repository info
    const files = parseDiff(diffText);
    const summary = getDiffSummary(files);
    const repoInfo = await this.git.getRepositoryInfo();
    const baseRef = await this.git.getHeadSha();

    // Create snapshot data
    const snapshotData = JSON.stringify({
      files,
      repository: repoInfo,
    });

    // Create review
    const review = this.repo.create({
      id: randomUUID(),
      title: request.title,
      description: request.description ?? null,
      repositoryPath: repoInfo.path,
      baseRef,
      snapshotData,
      status: 'in_progress',
    });

    return {
      id: review.id,
      title: review.title,
      description: review.description,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      files,
      summary,
      repository: repoInfo,
    };
  }

  /**
   * Get a review by ID with full details
   */
  getById(id: string): ReviewWithDetails | null {
    const review = this.repo.findById(id);
    if (!review) {
      return null;
    }

    return this.toReviewWithDetails(review);
  }

  /**
   * Get a review by ID (raw, without parsing snapshot)
   */
  getRaw(id: string): Review | null {
    return this.repo.findById(id);
  }

  /**
   * List reviews with pagination and filtering
   */
  list(options: {
    status?: ReviewStatus;
    repositoryPath?: string;
    page?: number;
    pageSize?: number;
  } = {}): PaginatedResponse<ReviewListItem> {
    const { page = 1, pageSize = 20 } = options;

    const result = this.repo.findAll(options);

    return {
      data: result.data.map((review) => this.toReviewListItem(review)),
      total: result.total,
      page,
      pageSize,
    };
  }

  /**
   * Update a review
   */
  update(id: string, request: UpdateReviewRequest): ReviewWithDetails | null {
    const review = this.repo.update(id, {
      title: request.title,
      description: request.description,
      status: request.status,
    });

    if (!review) {
      return null;
    }

    return this.toReviewWithDetails(review);
  }

  /**
   * Delete a review
   */
  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  /**
   * Get review statistics for a repository
   */
  getStats(repositoryPath?: string): ReviewStats {
    if (repositoryPath) {
      // Stats for a specific repository
      const all = this.repo.findAll({ repositoryPath, pageSize: 1000 });
      return {
        total: all.total,
        inProgress: all.data.filter((r) => r.status === 'in_progress').length,
        approved: all.data.filter((r) => r.status === 'approved').length,
        changesRequested: all.data.filter((r) => r.status === 'changes_requested').length,
      };
    }

    return {
      total: this.repo.countAll(),
      inProgress: this.repo.countByStatus('in_progress'),
      approved: this.repo.countByStatus('approved'),
      changesRequested: this.repo.countByStatus('changes_requested'),
    };
  }

  private toReviewWithDetails(review: Review): ReviewWithDetails {
    const snapshot = JSON.parse(review.snapshotData) as {
      files: DiffFile[];
      repository: RepositoryInfo;
    };

    return {
      id: review.id,
      title: review.title,
      description: review.description,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      files: snapshot.files,
      summary: getDiffSummary(snapshot.files),
      repository: snapshot.repository,
    };
  }

  private toReviewListItem(review: Review): ReviewListItem {
    const snapshot = JSON.parse(review.snapshotData) as {
      files: DiffFile[];
      repository: RepositoryInfo;
    };

    return {
      id: review.id,
      title: review.title,
      description: review.description,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      summary: getDiffSummary(snapshot.files),
    };
  }
}

export interface ReviewStats {
  total: number;
  inProgress: number;
  approved: number;
  changesRequested: number;
}

export class ReviewError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ReviewError';
    this.code = code;
  }
}
