import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import type { DepartureBoard } from '../src/departures.js'
import { buildServer } from '../src/server.js'
import type { Departures } from '../src/types.js'
import { UnknownStop } from '../src/upstream.js'

const cfg = loadConfig({ WEB_ORIGIN: 'https://fahrplan-ulm.de/' })
const board: Departures = { now: '2026-11-15T12:00:00.000Z', stale: false, departures: [] }
const asked: [number, number][] = []
const departures: DepartureBoard = {
  refreshStops: () => Promise.resolve(),
  board: (stop, limit) => {
    asked.push([stop, limit])
    if (stop === 404) return Promise.reject(new UnknownStop('no such stop'))
    if (stop === 502) return Promise.reject(new Error('SWU is down'))
    return Promise.resolve(board)
  },
}
let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => {
  app = await buildServer({ cfg, departures, logTo: { write: () => {} } })
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

describe('departures', () => {
  it('answers with the board of the stop, 20 departures unless told otherwise', async () => {
    const res = await app.inject({ url: '/api/departures?stop=1008' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(board)
    expect(asked.at(-1)).toEqual([1008, 20])
    await app.inject({ url: '/api/departures?stop=1008&limit=5' })
    expect(asked.at(-1)).toEqual([1008, 5])
  })

  it.each(['', '?stop=abc', '?stop=-1', '?stop=1008&limit=500'])('turns "%s" away', async (query) => {
    expect((await app.inject({ url: `/api/departures${query}` })).statusCode).toBe(400)
  })

  it('says so when the stop does not exist', async () => {
    expect((await app.inject({ url: '/api/departures?stop=404' })).statusCode).toBe(404)
  })

  it('says so when the operator cannot be reached', async () => {
    const res = await app.inject({ url: '/api/departures?stop=502' })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ error: 'departures are unavailable' })
  })
})
