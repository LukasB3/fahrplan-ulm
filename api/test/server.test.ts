import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { buildServer } from '../src/server.js'

const cfg = loadConfig({ WEB_ORIGIN: 'https://fahrplan-ulm.de/' })
let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => {
  app = await buildServer({ cfg, logTo: { write: () => {} } })
})
afterAll(() => app.close())

describe('health', () => {
  it('answers with the server time', async () => {
    const res = await app.inject({ url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(Math.abs(Date.parse(body.now) - Date.now())).toBeLessThan(5_000)
  })
})

describe('cross-origin calls', () => {
  it('are allowed from the website', async () => {
    const res = await app.inject({ url: '/api/health', headers: { origin: 'https://fahrplan-ulm.de' } })
    expect(res.headers['access-control-allow-origin']).toBe('https://fahrplan-ulm.de')
  })

  it('are not allowed from anywhere else', async () => {
    const res = await app.inject({ url: '/api/health', headers: { origin: 'https://example.com' } })
    expect(res.headers['access-control-allow-origin']).not.toBe('https://example.com')
  })
})
