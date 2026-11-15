import { z } from 'zod'

const schema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().default(8787),
  // The only origin whose pages may call this API from a browser.
  WEB_ORIGIN: z
    .url()
    .transform((url) => new URL(url).origin)
    .default('http://localhost:3000'),
  // DING's journey planner. MobiData BW runs the same software with the same
  // ids (https://www.efa-bw.de/mobidata-bw), slower, should DING turn us away.
  EFA_BASE: z.url().default('https://www.ding.eu/ding3'),

  // The sentence request ("in 30 Minuten zum Hauptbahnhof") is read by Claude.
  // Without the key, or switched off, the website falls back to its form.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ASK: z.enum(['on', 'off']).default('on'),
  ASK_MODEL: z.string().default('claude-haiku-5-5'),
  // What all requests of a day may cost before the form takes over until midnight.
  ASK_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),
  ASK_PER_VISITOR_PER_DAY: z.coerce.number().int().positive().default(40),
})

export type Config = z.infer<typeof schema>

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env)
