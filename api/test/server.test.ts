import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import type { DepartureBoard } from '../src/departures.js'
import { buildServer } from '../src/server.js'
import type { TripPlanner } from '../src/trips.js'
import type { Departures, Place, TripRequest, Trips } from '../src/types.js'
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
const hbf: Place = { kind: 'stop', stop: 'de:08421:1008', name: 'Hauptbahnhof', town: 'Ulm', lat: 48.39935, lon: 9.98421 }
const home: Place = { kind: 'address', stop: null, name: 'Frauenstraße 20', town: 'Ulm', lat: 48.39855, lon: 9.99649 }
const trips: Trips = { now: '2026-11-15T12:00:00.000Z', journeys: [], note: 'ok' }
const planned: TripRequest[] = []
const planner: TripPlanner = {
  places: (query) => (query === 'down' ? Promise.reject(new Error('DING is down')) : Promise.resolve([hbf])),
  trips: (request) => {
    planned.push(request)
    return request.from.name === 'down' ? Promise.reject(new Error('DING is down')) : Promise.resolve(trips)
  },
}
let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => {
  app = await buildServer({ cfg, departures, planner, logTo: { write: () => {} } })
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

describe('places', () => {
  it('answers with the places that match', async () => {
    const res = await app.inject({ url: '/api/places?q=hauptbahnhof' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ places: [hbf] })
  })

  it.each(['', '?q=a', `?q=${'x'.repeat(81)}`])('turns "%s" away', async (query) => {
    expect((await app.inject({ url: `/api/places${query}` })).statusCode).toBe(400)
  })

  it('says so when the planner cannot be reached', async () => {
    expect((await app.inject({ url: '/api/places?q=down' })).statusCode).toBe(502)
  })
})

describe('trips', () => {
  const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/trips', payload: payload as object })

  it('plans from one place to another', async () => {
    const request: TripRequest = { from: home, to: hbf, time: { mode: 'arrive', at: '2026-11-15T13:00:00.000Z' } }
    const res = await post(request)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(trips)
    expect(planned.at(-1)).toEqual(request)
  })

  it.each([
    ['nothing', {}],
    ['a place outside the region', { from: { ...home, lat: 52.5 }, to: hbf, time: { mode: 'depart', at: null } }],
    ['a made-up stop id', { from: { ...hbf, stop: 'x' }, to: home, time: { mode: 'depart', at: null } }],
    ['a time that is none', { from: home, to: hbf, time: { mode: 'depart', at: 'tomorrow' } }],
  ])('turns %s away', async (_, payload) => {
    expect((await post(payload)).statusCode).toBe(400)
  })

  it('says so when the planner cannot be reached', async () => {
    const res = await post({ from: { ...home, name: 'down' }, to: hbf, time: { mode: 'depart', at: null } })
    expect(res.statusCode).toBe(502)
  })
})
