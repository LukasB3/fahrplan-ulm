import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AlertBoard } from '../src/alerts.js'
import type { Asker } from '../src/ask.js'
import { loadConfig } from '../src/config.js'
import type { DepartureBoard } from '../src/departures.js'
import { buildServer } from '../src/server.js'
import type { TripPlanner } from '../src/trips.js'
import type { Alerts, AskRequest, AskResult, Departures, Place, TripRequest, Trips } from '../src/types.js'
import { UnknownStop, UnknownVehicle } from '../src/upstream.js'
import type { VehicleBoard } from '../src/vehicles.js'

const cfg = loadConfig({ WEB_ORIGIN: 'https://fahrplan-ulm.de/' })
const board: Departures = { now: '2026-11-15T12:00:00.000Z', stale: false, departures: [] }
const asked: [number, number][] = []
const departures: DepartureBoard = {
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
  matches: (query) => (query === 'down' ? Promise.reject(new Error('DING is down')) : Promise.resolve([{ place: hbf, quality: 1000 }])),
  trips: (request) => {
    planned.push(request)
    return request.from.name === 'down' ? Promise.reject(new Error('DING is down')) : Promise.resolve(trips)
  },
}
const understood: AskResult = { status: 'ok', from: null, to: hbf, time: { mode: 'depart', at: null }, timeAssumed: false, needs: [] }
const sentences: [AskRequest, string][] = []
const ask: Asker = (request, visitor) => {
  sentences.push([request, visitor])
  return Promise.resolve(understood)
}
const notices: Alerts = { now: '2026-11-15T12:00:00.000Z', alerts: [] }
let alertsDown = false
const alerts: AlertBoard = () => (alertsDown ? Promise.reject(new Error('DING is down')) : Promise.resolve(notices))
const tram = { id: 47, line: '1', mode: 'tram' as const, lat: 48.4, lon: 9.99, bearing: 260, delaySeconds: 10, destination: 'Söflingen' }
const vehicles: VehicleBoard = {
  all: () => Promise.resolve({ now: '2026-11-15T12:00:00.000Z', vehicles: [tram] }),
  trip: (id) => (id === 47 ? Promise.resolve({ id, line: '1', mode: 'tram', destination: 'Söflingen', stops: [], track: [] }) : Promise.reject(new UnknownVehicle('not on a trip'))),
}
let app: Awaited<ReturnType<typeof buildServer>>

beforeAll(async () => {
  app = await buildServer({ cfg, departures, planner, ask, alerts, vehicles, logTo: { write: () => {} } })
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

describe('a request in plain words', () => {
  const post = (payload: unknown, remoteAddress?: string) => app.inject({ method: 'POST', url: '/api/ask', payload: payload as object, remoteAddress })

  it('is passed on with the visitor it came from', async () => {
    const request: AskRequest = { text: 'in 30 Minuten zum Hauptbahnhof', position: null, saved: { home, work: null } }
    const res = await post(request, '2001:db8:1:2:3:4:5:6')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(understood)
    // Every address of one IPv6 household counts as one visitor.
    expect(sentences.at(-1)).toEqual([request, '2001:db8:1:2'])
  })

  it.each([
    ['nothing', {}],
    ['an empty sentence', { text: '  ', position: null, saved: { home: null, work: null } }],
    ['a novel', { text: 'x'.repeat(301), position: null, saved: { home: null, work: null } }],
    ['a position on another continent', { text: 'zum Bahnhof', position: { lat: 40.7, lon: -74 }, saved: { home: null, work: null } }],
  ])('turns %s away', async (_, payload) => {
    expect((await post(payload)).statusCode).toBe(400)
  })
})

describe('alerts', () => {
  it('answers with the current notices, and says so when they cannot be had', async () => {
    const res = await app.inject({ url: '/api/alerts' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(notices)
    alertsDown = true
    expect((await app.inject({ url: '/api/alerts' })).statusCode).toBe(502)
    alertsDown = false
  })
})

describe('vehicles', () => {
  it('answers with the vehicles on the road', async () => {
    const res = await app.inject({ url: '/api/vehicles' })
    expect(res.statusCode).toBe(200)
    expect(res.json().vehicles).toEqual([tram])
  })

  it('answers with one vehicle\'s trip, or says that it is on none', async () => {
    expect((await app.inject({ url: '/api/vehicles/47' })).json()).toMatchObject({ id: 47, line: '1' })
    expect((await app.inject({ url: '/api/vehicles/48' })).statusCode).toBe(404)
    expect((await app.inject({ url: '/api/vehicles/abc' })).statusCode).toBe(400)
  })
})
