import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { z } from 'zod'
import type { AlertBoard } from './alerts.js'
import type { Asker } from './ask.js'
import type { Config } from './config.js'
import type { DepartureBoard } from './departures.js'
import type { TripPlanner } from './trips.js'
import type { Alerts, ApiError, AskResult, Departures, Health, Places, Trips } from './types.js'
import { UnknownStop } from './upstream.js'

export interface ServerDeps {
  cfg: Config
  departures: DepartureBoard
  planner: TripPlanner
  ask: Asker
  alerts: AlertBoard
  // Where the request log goes, if not to standard output.
  logTo?: { write(line: string): void }
}

const departuresQuery = z.object({
  stop: z.coerce.number().int().positive().max(99_999),
  limit: z.coerce.number().int().min(1).max(40).default(20),
})

const placesQuery = z.object({ q: z.string().trim().min(2).max(80) })

// What the website sends as an end of a journey. The bounds keep requests to the region.
const place = z.object({
  kind: z.enum(['stop', 'address', 'poi', 'position']),
  stop: z
    .string()
    .regex(/^[a-z]{2}:\d{1,6}:\d{1,6}$/)
    .nullable(),
  name: z.string().max(120),
  town: z.string().max(80).nullable(),
  lat: z.number().min(47).max(50),
  lon: z.number().min(8).max(12),
})

const tripRequest = z.object({
  from: place,
  to: place,
  time: z.object({ mode: z.enum(['depart', 'arrive']), at: z.iso.datetime().nullable() }),
})

const askRequest = z.object({
  text: z.string().trim().min(1).max(300),
  position: z.object({ lat: z.number().min(47).max(50), lon: z.number().min(8).max(12) }).nullable(),
  saved: z.object({ home: place.nullable(), work: place.nullable() }),
})

// One IPv6 customer usually owns a whole /64, so that is what gets limited.
export const visitorKey = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip)

export const buildServer = async ({ cfg, departures, planner, ask, alerts, logTo }: ServerDeps) => {
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

  app.get('/api/alerts', async (req, reply): Promise<Alerts | ApiError> => {
    try {
      return await alerts()
    } catch (problem) {
      req.log.error(problem)
      return reply.code(502).send({ error: 'alerts are unavailable' })
    }
  })

  app.get('/api/places', async (req, reply): Promise<Places | ApiError> => {
    const query = placesQuery.safeParse(req.query)
    if (!query.success) return reply.code(400).send({ error: 'q must be 2 to 80 characters' })
    try {
      return { places: (await planner.matches(query.data.q)).map((match) => match.place) }
    } catch (problem) {
      req.log.error(problem)
      return reply.code(502).send({ error: 'the place search is unavailable' })
    }
  })

  // The ends of a journey travel in the body, so they stay out of logs and addresses.
  // Each request is a heavy one for the planner, hence the tighter limit.
  app.post('/api/trips', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply): Promise<Trips | ApiError> => {
    const request = tripRequest.safeParse(req.body)
    if (!request.success) return reply.code(400).send({ error: 'from, to and time are required' })
    try {
      return await planner.trips(request.data)
    } catch (problem) {
      req.log.error(problem)
      return reply.code(502).send({ error: 'the journey planner is unavailable' })
    }
  })

  // The sentence is read by a language model, which costs money per request:
  // hence the tightest limit. The sentence itself is never logged.
  app.post('/api/ask', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply): Promise<AskResult | ApiError> => {
    const request = askRequest.safeParse(req.body)
    if (!request.success) return reply.code(400).send({ error: 'text of 1 to 300 characters, position and saved are required' })
    return ask(request.data, visitorKey(req.ip))
  })

  return app
}
