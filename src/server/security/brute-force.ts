/**
 * Brute force protection with exponential backoff
 *
 * Tracks failed authentication attempts in memory and enforces
 * exponential delays between retries. State is attached to the
 * Fastify instance for proper isolation and cleanup.
 */
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

const BASE_DELAY_MS = 1000 // 1 second base delay
const MAX_DELAY_MS = 60000 // 60 seconds max delay
const WINDOW_MS = 15 * 60 * 1000 // 15 minute window before reset
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // Clean up stale records every 5 minutes

interface AttemptRecord {
  failures: number
  lastAttempt: number
  delayUntil: number
}

export interface RateLimiter {
  getClientId: (ip: string, userAgent: string | undefined) => string
  checkDelay: (clientId: string) => number
  recordFailure: (clientId: string) => void
  clearAttempts: (clientId: string) => void
}

/**
 * Calculate delay in milliseconds based on number of failures
 * Exponential: 1s -> 2s -> 4s -> 8s -> ... -> 60s max
 */
export function calculateDelay (failures: number): number {
  if (failures <= 0) return 0
  const delay = BASE_DELAY_MS * Math.pow(2, failures - 1)
  return Math.min(delay, MAX_DELAY_MS)
}

/**
 * Create a rate limiter instance with its own state
 */
function createRateLimiter (): { limiter: RateLimiter, cleanup: () => void } {
  const attempts = new Map<string, AttemptRecord>()
  let cleanupTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Generate a client identifier from request properties
   * Uses IP + User-Agent to help differentiate localhost clients
   */
  function getClientId (ip: string, userAgent: string | undefined): string {
    return `${ip}:${userAgent ?? 'unknown'}`
  }

  /**
   * Check if a client must wait before attempting auth
   * Returns remaining delay in seconds, or 0 if no delay needed
   */
  function checkDelay (clientId: string): number {
    const record = attempts.get(clientId)
    if (!record) return 0

    const now = Date.now()

    // Check if the window has expired
    if (now - record.lastAttempt > WINDOW_MS) {
      attempts.delete(clientId)
      return 0
    }

    // Check if still in delay period
    if (now < record.delayUntil) {
      return Math.ceil((record.delayUntil - now) / 1000)
    }

    return 0
  }

  /**
   * Record a failed authentication attempt
   * Increments failure count and sets new delay
   */
  function recordFailure (clientId: string): void {
    const now = Date.now()
    const record = attempts.get(clientId)

    if (record) {
      // Check if window expired
      if (now - record.lastAttempt > WINDOW_MS) {
        // Start fresh
        attempts.set(clientId, {
          failures: 1,
          lastAttempt: now,
          delayUntil: now + BASE_DELAY_MS,
        })
      } else {
        // Increment failures
        record.failures++
        record.lastAttempt = now
        record.delayUntil = now + calculateDelay(record.failures)
      }
    } else {
      // First failure
      attempts.set(clientId, {
        failures: 1,
        lastAttempt: now,
        delayUntil: now + BASE_DELAY_MS,
      })
    }
  }

  /**
   * Clear all failed attempts for a client (on successful auth)
   */
  function clearAttempts (clientId: string): void {
    attempts.delete(clientId)
  }

  /**
   * Clean up stale records that have expired
   */
  function cleanupStale (): void {
    const now = Date.now()
    for (const [clientId, record] of attempts) {
      if (now - record.lastAttempt > WINDOW_MS) {
        attempts.delete(clientId)
      }
    }
  }

  // Start periodic cleanup
  cleanupTimer = setInterval(cleanupStale, CLEANUP_INTERVAL_MS)
  cleanupTimer.unref()

  function cleanup (): void {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }
    attempts.clear()
  }

  return {
    limiter: {
      getClientId,
      checkDelay,
      recordFailure,
      clearAttempts,
    },
    cleanup,
  }
}

/**
 * Fastify plugin that adds rate limiting to the instance
 */
const bruteForcePlugin = fp(async (fastify: FastifyInstance) => {
  const { limiter, cleanup } = createRateLimiter()

  fastify.decorate('rateLimiter', limiter)

  fastify.addHook('onClose', () => {
    cleanup()
  })
}, {
  name: 'brute-force',
})

export default bruteForcePlugin

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    rateLimiter: RateLimiter
  }
}
