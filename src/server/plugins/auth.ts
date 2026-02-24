/**
 * Token authentication plugin with brute force protection
 */
import { timingSafeEqual } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import bruteForcePlugin from '../security/brute-force.ts'

function safeCompare (a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Compare against itself to maintain constant time
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export interface AuthPluginOptions {
  token: string | null; // null means auth disabled (localhost)
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify,
  options
) => {
  const { token } = options

  // If no token configured, skip authentication (localhost mode)
  if (!token) {
    fastify.decorate('authEnabled', false)
    return
  }

  // Register brute force protection (creates rate limiter on this instance)
  await fastify.register(bruteForcePlugin)

  fastify.decorate('authEnabled', true)

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for 404
    if (request.is404) {
      return
    }

    // Skip auth for health endpoint
    if (request.url === '/api/health') {
      return
    }

    // Skip auth for static files
    if (!request.url.startsWith('/api/')) {
      return
    }

    const { rateLimiter } = fastify

    // Get client identifier for rate limiting
    const clientId = rateLimiter.getClientId(request.ip, request.headers['user-agent'])

    // Check Authorization header first - valid token bypasses rate limiting
    const header = request.headers.authorization
    if (header?.startsWith('Bearer ')) {
      const providedToken = header.slice(7)
      if (safeCompare(providedToken, token)) {
        // Valid token clears any rate limiting
        rateLimiter.clearAttempts(clientId)
        return
      }
    }

    // Fall back to query parameter (needed for SSE since EventSource can't send headers)
    const queryToken = (request.query as Record<string, string>)?.token
    if (queryToken && safeCompare(queryToken, token)) {
      // Valid token clears any rate limiting
      rateLimiter.clearAttempts(clientId)
      return
    }

    // Auth failed - check if client must wait due to previous failures
    const delaySeconds = rateLimiter.checkDelay(clientId)
    if (delaySeconds > 0) {
      return reply
        .code(429)
        .header('Retry-After', delaySeconds.toString())
        .send({
          error: 'Too Many Requests',
          message: `Too many failed attempts. Retry in ${delaySeconds} seconds.`,
          statusCode: 429,
          retryAfter: delaySeconds,
        })
    }

    // Record the failure
    rateLimiter.recordFailure(clientId)

    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization',
      statusCode: 401,
    })
  })
}

export default fp(authPlugin, {
  name: 'auth',
})

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authEnabled: boolean
  }
}
