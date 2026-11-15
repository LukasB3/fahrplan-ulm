import { z } from 'zod'

const schema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().default(8787),
  // The only origin whose pages may call this API from a browser.
  WEB_ORIGIN: z
    .url()
    .transform((url) => new URL(url).origin)
    .default('http://localhost:3000'),
})

export type Config = z.infer<typeof schema>

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => schema.parse(env)
