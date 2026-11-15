import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import type { Config } from './config.js'
import type { Health } from './types.js'

export interface ServerDeps {
  cfg: Config
  // Where the request log goes, if not to standard output.
  logTo?: { write(line: string): void }
}

export const buildServer = async ({ cfg, logTo }: ServerDeps) => {
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

  return app
}
