import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { z } from 'zod'
import type { Config } from './config.js'
import type { DepartureBoard } from './departures.js'
import type { ApiError, Departures, Health } from './types.js'
import { UnknownStop } from './upstream.js'

export interface ServerDeps {
  cfg: Config
  departures: DepartureBoard
  // Where the request log goes, if not to standard output.
  logTo?: { write(line: string): void }
}

const departuresQuery = z.object({
  stop: z.coerce.number().int().positive().max(99_999),
  limit: z.coerce.number().int().min(1).max(40).default(20),
})

export const buildServer = async ({ cfg, departures, logTo }: ServerDeps) => {
  // Caddy on the same host is the only client, so its forwarded address is
  // trusted; without it every visitor would share one rate limit.
  // Request logs carry neither the client address nor the query, which can
  // hold a place or a position.
  const app = Fastify({
    trustProxy: '127.0.0.1',
    bodyLimit: 16_384,
    logger: { level: 'info', stream: logTo, serializers: { req: (req) => ({ method: req.method, url: req.url.split('?')[0] }) } },
  })
  await app.register(cors, { origin: cfg.WEB_ORIGIN, methods: ['GET', 'POST'], allowedHeaders: ['content-type', 'authorization'] })
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })

  app.get('/api/health', (): Health => ({ status: 'ok', now: new Date().toISOString() }))

  app.get('/api/departures', async (req, reply): Promise<Departures | ApiError> => {
    const query = departuresQuery.safeParse(req.query)
    if (!query.success) return reply.code(400).send({ error: 'stop must be a stop number' })
    try {
      return await departures.board(query.data.stop, query.data.limit)
    } catch (problem) {
      if (problem instanceof UnknownStop) return reply.code(404).send({ error: 'unknown stop' })
      req.log.error(problem)
      return reply.code(502).send({ error: 'departures are unavailable' })
    }
  })

  return app
}
