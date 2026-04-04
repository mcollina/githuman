/**
 * Ask session API routes
 */
import { Type, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { getDatabase } from '../db/index.ts'
import { AskSessionError, AskSessionService } from '../services/ask-session.service.ts'
import { ErrorSchema } from '../schemas/common.ts'

const AskStatusSchema = Type.Union([
  Type.Literal('waiting_for_human'),
  Type.Literal('ready_for_agent'),
  Type.Literal('cancelled'),
])

const AskSessionSchema = Type.Object({
  id: Type.String(),
  repositoryPath: Type.String(),
  reviewId: Type.Union([Type.String(), Type.Null()]),
  message: Type.String(),
  status: AskStatusSchema,
  assistantContext: Type.Union([Type.String(), Type.Null()]),
  completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

const AskSessionReviewContextSchema = Type.Object({
  id: Type.String(),
  sourceType: Type.Union([Type.Literal('staged'), Type.Literal('branch'), Type.Literal('commits')]),
  sourceRef: Type.Union([Type.String(), Type.Null()]),
  baseRef: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union([
    Type.Literal('in_progress'),
    Type.Literal('approved'),
    Type.Literal('changes_requested'),
  ]),
})

const AskSessionDetailsSchema = Type.Intersect([
  AskSessionSchema,
  Type.Object({
    review: Type.Union([AskSessionReviewContextSchema, Type.Null()]),
    feedback: Type.Object({
      reviewStatus: Type.Union([
        Type.Literal('in_progress'),
        Type.Literal('approved'),
        Type.Literal('changes_requested'),
        Type.Null(),
      ]),
      todoCount: Type.Integer(),
      commentCount: Type.Integer(),
      unresolvedCommentCount: Type.Integer(),
    }),
  }),
])

const TodoSchema = Type.Object({
  id: Type.String(),
  content: Type.String(),
  completed: Type.Boolean(),
  reviewId: Type.Union([Type.String(), Type.Null()]),
  position: Type.Integer(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

const CommentSchema = Type.Object({
  id: Type.String(),
  reviewId: Type.String(),
  filePath: Type.String(),
  lineNumber: Type.Union([Type.Integer(), Type.Null()]),
  lineType: Type.Union([
    Type.Literal('added'),
    Type.Literal('removed'),
    Type.Literal('context'),
    Type.Null(),
  ]),
  content: Type.String(),
  suggestion: Type.Union([Type.String(), Type.Null()]),
  resolved: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

const AskFeedbackSchema = Type.Object({
  ask: AskSessionSchema,
  reviewStatus: Type.Union([
    Type.Literal('in_progress'),
    Type.Literal('approved'),
    Type.Literal('changes_requested'),
    Type.Null(),
  ]),
  todos: Type.Array(TodoSchema),
  comments: Type.Array(CommentSchema),
})

const CreateAskSessionSchema = Type.Object({
  message: Type.String({ minLength: 1 }),
  reviewId: Type.Optional(Type.String()),
  assistantContext: Type.Optional(Type.String()),
})

const AskIdParamsSchema = Type.Object({
  id: Type.String(),
})

const askRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const getService = () => {
    const db = getDatabase()
    return new AskSessionService(db)
  }

  fastify.post('/api/asks', {
    schema: {
      tags: ['asks'],
      summary: 'Create a new ask session',
      description: 'Create an assistant↔human handoff session',
      body: CreateAskSessionSchema,
      response: {
        201: AskSessionSchema,
        400: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const ask = getService().create(fastify.config.repositoryPath, request.body)
      reply.code(201)
      return ask
    } catch (err) {
      if (err instanceof AskSessionError) {
        return reply.code(400).send({
          error: err.message,
          code: err.code,
        })
      }
      throw err
    }
  })

  fastify.get('/api/asks/:id', {
    schema: {
      tags: ['asks'],
      summary: 'Get an ask session',
      description: 'Get ask session details and feedback counts',
      params: AskIdParamsSchema,
      response: {
        200: AskSessionDetailsSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const ask = getService().getDetails(request.params.id)
    if (!ask) {
      return reply.code(404).send({ error: 'Ask session not found' })
    }
    return ask
  })

  fastify.get('/api/asks/:id/feedback', {
    schema: {
      tags: ['asks'],
      summary: 'Get ask session feedback',
      description: 'Get the feedback collected during an ask session',
      params: AskIdParamsSchema,
      response: {
        200: AskFeedbackSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const feedback = getService().collectFeedback(request.params.id)
    if (!feedback) {
      return reply.code(404).send({ error: 'Ask session not found' })
    }
    return feedback
  })

  fastify.post('/api/asks/:id/continue', {
    schema: {
      tags: ['asks'],
      summary: 'Continue the assistant',
      description: 'Mark the ask session as ready for the assistant to resume',
      params: AskIdParamsSchema,
      response: {
        200: AskSessionSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const ask = getService().markReadyForAgent(request.params.id)
    if (!ask) {
      return reply.code(404).send({ error: 'Ask session not found' })
    }
    return ask
  })

  fastify.post('/api/asks/:id/cancel', {
    schema: {
      tags: ['asks'],
      summary: 'Cancel an ask session',
      description: 'Cancel an assistant↔human handoff session',
      params: AskIdParamsSchema,
      response: {
        200: AskSessionSchema,
        404: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const ask = getService().cancel(request.params.id)
    if (!ask) {
      return reply.code(404).send({ error: 'Ask session not found' })
    }
    return ask
  })
}

export default askRoutes
