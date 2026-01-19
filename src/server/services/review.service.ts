/**
 * Review service - business logic for review management
 */
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ReviewRepository } from '../repositories/review.repo.ts'
import { ReviewFileRepository, type CreateReviewFileInput } from '../repositories/review-file.repo.ts'
import { GitService } from './git.service.ts'
import { parseDiff, parseSingleFileDiff, getDiffSummary, type DiffSummary } from './diff.service.ts'
import type {
  Review,
  ReviewStatus,
  ReviewSourceType,
  DiffFile,
  DiffHunk,
  RepositoryInfo,
  CreateReviewRequest,
  UpdateReviewRequest,
  PaginatedResponse,
} from '../../shared/types.ts'

/** File metadata without hunks (for lazy loading) */
export interface DiffFileMetadata {
  oldPath: string;
  newPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface ReviewWithDetails extends Omit<Review, 'snapshotData'> {
  files: DiffFileMetadata[];
  summary: DiffSummary;
  repository: RepositoryInfo;
}

export interface ReviewListItem extends Omit<Review, 'snapshotData'> {
  summary: DiffSummary;
}

export class ReviewService {
  private repo: ReviewRepository
  private fileRepo: ReviewFileRepository
  private git: GitService
  private db: DatabaseSync

  constructor (db: DatabaseSync, repositoryPath: string) {
    this.db = db
    this.repo = new ReviewRepository(db)
    this.fileRepo = new ReviewFileRepository(db)
    this.git = new GitService(repositoryPath)
  }

  /**
   * Create a new review from current staged changes
   */
  async create (request: CreateReviewRequest = {}): Promise<ReviewWithDetails> {
    // Verify we're in a git repo
    const isRepo = await this.git.isRepo()
    if (!isRepo) {
      throw new ReviewError('Not a git repository', 'NOT_GIT_REPO')
    }

    // Verify the repo has at least one commit
    const hasCommits = await this.git.hasCommits()
    if (!hasCommits) {
      throw new ReviewError('Repository has no commits yet. Create an initial commit first.', 'NO_COMMITS')
    }

    const sourceType = request.sourceType || 'staged'
    const sourceRef = request.sourceRef || null

    let diffText: string
    let baseRef: string | null

    if (sourceType === 'staged') {
      // Get staged diff
      diffText = await this.git.getStagedDiff()
      const hasStagedChanges = await this.git.hasStagedChanges()

      if (!hasStagedChanges) {
        throw new ReviewError('No staged changes to review', 'NO_STAGED_CHANGES')
      }
      baseRef = await this.git.getHeadSha()
    } else if (sourceType === 'branch' && sourceRef) {
      // Compare branches
      diffText = await this.git.getBranchDiff(sourceRef)
      baseRef = await this.git.getHeadSha()
    } else if (sourceType === 'commits' && sourceRef) {
      // Get diff for specific commits
      const commits = sourceRef.split(',').map(s => s.trim())
      diffText = await this.git.getCommitsDiff(commits)
      baseRef = commits[commits.length - 1] || null
    } else {
      throw new ReviewError('Invalid source type or missing source ref', 'INVALID_SOURCE')
    }

    // Parse diff and get repository info
    const files = parseDiff(diffText)
    const summary = getDiffSummary(files)
    const repoInfo = await this.git.getRepositoryInfo()

    if (files.length === 0) {
      throw new ReviewError('No changes to review', 'NO_CHANGES')
    }

    const reviewId = randomUUID()

    // For staged reviews, store hunks in review_files table
    // For committed reviews (branch/commits), only store metadata - hunks are regenerated from git
    const storeHunks = sourceType === 'staged'

    // Create file records
    const fileInputs: CreateReviewFileInput[] = files.map((file) => ({
      id: randomUUID(),
      reviewId,
      filePath: file.newPath,
      oldPath: file.oldPath !== file.newPath ? file.oldPath : null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      hunksData: storeHunks ? ReviewFileRepository.serializeHunks(file.hunks) : null,
    }))

    // Create snapshot data (lightweight - just repository info for new reviews)
    // Files are stored separately in review_files table
    const snapshotData = JSON.stringify({
      repository: repoInfo,
      version: 2, // Indicates new format with separate file storage
    })

    // Create review
    const review = this.repo.create({
      id: reviewId,
      repositoryPath: repoInfo.path,
      baseRef,
      sourceType,
      sourceRef,
      snapshotData,
      status: 'in_progress',
    })

    // Store files in review_files table
    this.fileRepo.createBulk(fileInputs)

    // Convert files to metadata (without hunks)
    const fileMetadata: DiffFileMetadata[] = files.map((file) => ({
      oldPath: file.oldPath,
      newPath: file.newPath,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    }))

    return {
      id: review.id,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      sourceType: review.sourceType,
      sourceRef: review.sourceRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      files: fileMetadata,
      summary,
      repository: repoInfo,
    }
  }

  /**
   * Get a review by ID with full details (files without hunks)
   */
  getById (id: string): ReviewWithDetails | null {
    const review = this.repo.findById(id)
    if (!review) {
      return null
    }

    return this.toReviewWithDetails(review)
  }

  /**
   * Get a review by ID (raw, without parsing snapshot)
   */
  getRaw (id: string): Review | null {
    return this.repo.findById(id)
  }

  /**
   * Get hunks for a specific file in a review (lazy loading)
   */
  async getFileHunks (reviewId: string, filePath: string): Promise<DiffHunk[]> {
    const review = this.repo.findById(reviewId)
    if (!review) {
      throw new ReviewError('Review not found', 'NOT_FOUND')
    }

    // Try to get from review_files table first (new format)
    const fileRecord = this.fileRepo.findByReviewAndPath(reviewId, filePath)
    if (fileRecord && fileRecord.hunksData) {
      return ReviewFileRepository.parseHunks(fileRecord.hunksData)
    }

    // For committed reviews (branch/commits) or legacy reviews without stored hunks,
    // regenerate from git
    if (review.sourceType === 'branch' && review.sourceRef) {
      const diffText = await this.git.getBranchFileDiff(review.sourceRef, filePath)
      const file = parseSingleFileDiff(diffText)
      return file?.hunks ?? []
    }

    if (review.sourceType === 'commits' && review.sourceRef) {
      const commits = review.sourceRef.split(',').map(s => s.trim())
      const diffText = await this.git.getCommitsFileDiff(commits, filePath)
      const file = parseSingleFileDiff(diffText)
      return file?.hunks ?? []
    }

    // For staged reviews without stored hunks (legacy), try to get from snapshot
    const snapshot = this.parseSnapshotData(review.snapshotData)
    if (snapshot.files) {
      const legacyFile = snapshot.files.find((f: DiffFile) => f.newPath === filePath)
      if (legacyFile) {
        return legacyFile.hunks
      }
    }

    // Staged review but changes are no longer staged - hunks unavailable
    return []
  }

  /**
   * List reviews with pagination and filtering
   */
  list (options: {
    status?: ReviewStatus;
    repositoryPath?: string;
    sourceType?: ReviewSourceType;
    page?: number;
    pageSize?: number;
  } = {}): PaginatedResponse<ReviewListItem> {
    const { page = 1, pageSize = 20 } = options

    const result = this.repo.findAll(options)

    return {
      reviews: result.data.map((review) => this.toReviewListItem(review)),
      total: result.total,
      page,
      pageSize,
    }
  }

  /**
   * Update a review
   */
  update (id: string, request: UpdateReviewRequest): ReviewWithDetails | null {
    const review = this.repo.update(id, {
      status: request.status,
    })

    if (!review) {
      return null
    }

    return this.toReviewWithDetails(review)
  }

  /**
   * Delete a review
   */
  delete (id: string): boolean {
    // Files are deleted via CASCADE, but explicitly delete for clarity
    this.fileRepo.deleteByReview(id)
    return this.repo.delete(id)
  }

  /**
   * Get review statistics for a repository
   */
  getStats (repositoryPath?: string): ReviewStats {
    if (repositoryPath) {
      // Stats for a specific repository
      const all = this.repo.findAll({ repositoryPath, pageSize: 1000 })
      return {
        total: all.total,
        inProgress: all.data.filter((r) => r.status === 'in_progress').length,
        approved: all.data.filter((r) => r.status === 'approved').length,
        changesRequested: all.data.filter((r) => r.status === 'changes_requested').length,
      }
    }

    return {
      total: this.repo.countAll(),
      inProgress: this.repo.countByStatus('in_progress'),
      approved: this.repo.countByStatus('approved'),
      changesRequested: this.repo.countByStatus('changes_requested'),
    }
  }

  /**
   * Parse snapshot data and handle both old and new formats
   */
  private parseSnapshotData (snapshotData: string): {
    files?: DiffFile[];
    repository: RepositoryInfo;
    version?: number;
  } {
    return JSON.parse(snapshotData)
  }

  /**
   * Check if snapshot uses new format (version 2)
   */
  private isNewFormat (snapshot: { version?: number }): boolean {
    return snapshot.version === 2
  }

  private toReviewWithDetails (review: Review): ReviewWithDetails {
    const snapshot = this.parseSnapshotData(review.snapshotData)

    let fileMetadata: DiffFileMetadata[]
    let summary: DiffSummary

    if (this.isNewFormat(snapshot)) {
      // New format: get files from review_files table
      const reviewFiles = this.fileRepo.findByReview(review.id)
      fileMetadata = reviewFiles.map((rf) => ({
        oldPath: rf.oldPath ?? rf.filePath,
        newPath: rf.filePath,
        status: rf.status,
        additions: rf.additions,
        deletions: rf.deletions,
      }))

      // Calculate summary from file metadata
      let totalAdditions = 0
      let totalDeletions = 0
      for (const file of fileMetadata) {
        totalAdditions += file.additions
        totalDeletions += file.deletions
      }

      summary = {
        totalFiles: fileMetadata.length,
        totalAdditions,
        totalDeletions,
        filesAdded: fileMetadata.filter((f) => f.status === 'added').length,
        filesModified: fileMetadata.filter((f) => f.status === 'modified').length,
        filesDeleted: fileMetadata.filter((f) => f.status === 'deleted').length,
        filesRenamed: fileMetadata.filter((f) => f.status === 'renamed').length,
      }
    } else {
      // Legacy format: files embedded in snapshot_data
      const files = snapshot.files ?? []
      fileMetadata = files.map((file) => ({
        oldPath: file.oldPath,
        newPath: file.newPath,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      }))
      summary = getDiffSummary(files)
    }

    return {
      id: review.id,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      sourceType: review.sourceType,
      sourceRef: review.sourceRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      files: fileMetadata,
      summary,
      repository: snapshot.repository,
    }
  }

  private toReviewListItem (review: Review): ReviewListItem {
    const snapshot = this.parseSnapshotData(review.snapshotData)

    let summary: DiffSummary

    if (this.isNewFormat(snapshot)) {
      // New format: get files from review_files table
      const reviewFiles = this.fileRepo.findByReview(review.id)

      let totalAdditions = 0
      let totalDeletions = 0
      for (const file of reviewFiles) {
        totalAdditions += file.additions
        totalDeletions += file.deletions
      }

      summary = {
        totalFiles: reviewFiles.length,
        totalAdditions,
        totalDeletions,
        filesAdded: reviewFiles.filter((f) => f.status === 'added').length,
        filesModified: reviewFiles.filter((f) => f.status === 'modified').length,
        filesDeleted: reviewFiles.filter((f) => f.status === 'deleted').length,
        filesRenamed: reviewFiles.filter((f) => f.status === 'renamed').length,
      }
    } else {
      // Legacy format
      const files = snapshot.files ?? []
      summary = getDiffSummary(files)
    }

    return {
      id: review.id,
      repositoryPath: review.repositoryPath,
      baseRef: review.baseRef,
      sourceType: review.sourceType,
      sourceRef: review.sourceRef,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      summary,
    }
  }
}

export interface ReviewStats {
  total: number;
  inProgress: number;
  approved: number;
  changesRequested: number;
}

export class ReviewError extends Error {
  code: string

  constructor (message: string, code: string) {
    super(message)
    this.name = 'ReviewError'
    this.code = code
  }
}
