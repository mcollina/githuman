/**
 * Ask session service - business logic for assistant↔human handoff sessions
 */
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { AskSessionRepository } from '../repositories/ask-session.repo.ts'
import { ReviewRepository } from '../repositories/review.repo.ts'
import { CommentRepository } from '../repositories/comment.repo.ts'
import { TodoRepository } from '../repositories/todo.repo.ts'
import type {
  AskFeedback,
  AskSession,
  AskSessionDetails,
  CreateAskSessionRequest,
  Review,
  ReviewStatus,
} from '../../shared/types.ts'

function wasCreatedDuringSession (record: { createdAt: string }, sessionStartedAt: number): boolean {
  return Date.parse(record.createdAt) >= sessionStartedAt
}

function wasTouchedDuringSession (record: { createdAt: string; updatedAt: string }, sessionStartedAt: number): boolean {
  return Math.max(Date.parse(record.createdAt), Date.parse(record.updatedAt)) >= sessionStartedAt
}

export class AskSessionService {
  private repo: AskSessionRepository
  private reviewRepo: ReviewRepository
  private commentRepo: CommentRepository
  private todoRepo: TodoRepository

  constructor (db: DatabaseSync) {
    this.repo = new AskSessionRepository(db)
    this.reviewRepo = new ReviewRepository(db)
    this.commentRepo = new CommentRepository(db)
    this.todoRepo = new TodoRepository(db)
  }

  create (repositoryPath: string, request: CreateAskSessionRequest): AskSession {
    if (!request.message.trim()) {
      throw new AskSessionError('Message is required', 'INVALID_MESSAGE')
    }

    const reviewId: string | null = request.reviewId ?? null
    if (reviewId) {
      const review = this.reviewRepo.findById(reviewId)
      if (!review) {
        throw new AskSessionError('Review not found', 'REVIEW_NOT_FOUND')
      }
      if (review.repositoryPath !== repositoryPath) {
        throw new AskSessionError('Review does not belong to this repository', 'REVIEW_NOT_FOUND')
      }
    }

    return this.repo.create({
      id: randomUUID(),
      repositoryPath,
      reviewId,
      message: request.message.trim(),
      status: 'waiting_for_human',
      assistantContext: request.assistantContext?.trim() || null,
      completedAt: null,
    })
  }

  getById (id: string): AskSession | null {
    return this.repo.findById(id)
  }

  getDetails (id: string): AskSessionDetails | null {
    const ask = this.repo.findById(id)
    if (!ask) {
      return null
    }

    const feedback = this.collectFeedbackInternal(ask)
    const review = ask.reviewId ? this.reviewRepo.findById(ask.reviewId) : null

    return {
      ...ask,
      review: review
        ? {
            id: review.id,
            sourceType: review.sourceType,
            sourceRef: review.sourceRef,
            baseRef: review.baseRef,
            status: review.status,
          }
        : null,
      feedback: {
        reviewStatus: feedback.reviewStatus,
        todoCount: feedback.todos.length,
        commentCount: feedback.comments.length,
        unresolvedCommentCount: feedback.comments.filter(comment => !comment.resolved).length,
      },
    }
  }

  markReadyForAgent (id: string): AskSession | null {
    return this.repo.update(id, {
      status: 'ready_for_agent',
      completedAt: new Date().toISOString(),
    })
  }

  cancel (id: string): AskSession | null {
    return this.repo.update(id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    })
  }

  collectFeedback (id: string): AskFeedback | null {
    const ask = this.repo.findById(id)
    if (!ask) {
      return null
    }

    return this.collectFeedbackInternal(ask)
  }

  private collectFeedbackInternal (ask: AskSession): AskFeedback {
    const sessionStartedAt = Date.parse(ask.createdAt)

    const reviews = this.reviewRepo.findAll({
      repositoryPath: ask.repositoryPath,
      pageSize: 1000,
    }).data

    const reviewStatus = this.getLatestReviewStatus(reviews, sessionStartedAt, ask.reviewId ?? undefined)

    if (ask.reviewId) {
      const todos = this.todoRepo.findByReview(ask.reviewId)
        .filter(todo => wasCreatedDuringSession(todo, sessionStartedAt))
      const comments = this.commentRepo.findByReview(ask.reviewId)
        .filter(comment => wasCreatedDuringSession(comment, sessionStartedAt))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

      return {
        ask,
        reviewStatus,
        todos,
        comments,
      }
    }

    const reviewIds = new Set(reviews.map(review => review.id))
    const comments = reviews
      .flatMap(review => this.commentRepo.findByReview(review.id))
      .filter(comment => wasCreatedDuringSession(comment, sessionStartedAt))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

    const todos = this.todoRepo.findAll()
      .filter(todo => {
        if (!wasCreatedDuringSession(todo, sessionStartedAt)) return false
        if (todo.reviewId == null) return true
        return reviewIds.has(todo.reviewId)
      })

    return {
      ask,
      reviewStatus,
      todos,
      comments,
    }
  }

  private getLatestReviewStatus (reviews: Review[], sessionStartedAt: number, reviewId?: string): ReviewStatus | null {
    if (reviewId) {
      return reviews.find(review => review.id === reviewId)?.status ?? null
    }

    const recent = reviews
      .filter(review => wasTouchedDuringSession(review, sessionStartedAt))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]

    return recent?.status ?? null
  }
}

export class AskSessionError extends Error {
  code: string

  constructor (message: string, code: string) {
    super(message)
    this.name = 'AskSessionError'
    this.code = code
  }
}
