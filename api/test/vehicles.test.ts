import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { swuVehicles, swuVehicleTrip } from '../src/swu.js'
import { UnknownVehicle, type GetJson } from '../src/upstream.js'
import { vehicleBoard } from '../src/vehicles.js'

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const lineOf = (route: number) => (route < 200 ? String(route) : undefined)

describe('vehicles, as recorded', () => {
  it('are the ones on a trip, with position, heading, delay and line', async () => {
    const sightings = await swuVehicles(() => Promise.resolve(fixture('swu-vehicles')), lineOf)
    // Of five in the list one is parked and one has no route.
    expect(sightings.map((one) => one.vehicle.id)).toEqual([47, 52, 53])
    expect(sightings[0]!.vehicle).toMatchObject({ line: '1', mode: 'tram', destination: 'Söflingen', bearing: 260 })
    expect(sightings[0]!.vehicle.lat).toBeCloseTo(48.40196, 4)
  })

  it('are late where SWU gives a negative deviation, and early where a positive one', async () => {
    const sightings = await swuVehicles(() => Promise.resolve(fixture('swu-vehicles')), lineOf)
    // Recorded: 47 with a deviation of 20, 52 with -10.
    expect(sightings.map((one) => one.vehicle.delaySeconds).slice(0, 2)).toEqual([-20, 10])
  })

  it('were seen as long ago as SWU says by its own clock', async () => {
    const before = Date.now()
    const sightings = await swuVehicles(() => Promise.resolve(fixture('swu-vehicles')), lineOf)
    // Recorded at 14:35:48 with a report of 14:35:39.
    expect(before - sightings[0]!.seen).toBeLessThanOrEqual(9_000)
    expect(Date.now() - sightings[0]!.seen).toBeGreaterThanOrEqual(9_000)
  })

  it('leave out routes that have no name', async () => {
    expect(await swuVehicles(() => Promise.resolve(fixture('swu-vehicles')), () => undefined)).toEqual([])
  })
})

describe("a vehicle's trip, as recorded", () => {
  const answering: GetJson = (url) => Promise.resolve(fixture(url.includes('Pattern') ? 'swu-pattern' : 'swu-passage'))

  it('lists the stops still ahead and the way', async () => {
    const trip = await swuVehicleTrip(answering, 47)
    expect(trip).toMatchObject({ id: 47, line: '1', mode: 'tram', destination: 'Söflingen' })
    // The first two stops in the recording are behind the tram.
    expect(trip.stops.map((stop) => stop.name)).toEqual(['Königstraße', 'Sonnenstraße', 'Söflingen'])
    expect(trip.stops[0]!.planned).toMatch(/^2026-11-15T\d\d:\d\d:00\.000Z$/)
    expect(trip.track).toHaveLength(5)
  })

  it('shows the stops when the way cannot be had', async () => {
    const withoutWay: GetJson = (url) => (url.includes('Pattern') ? Promise.reject(new Error('down')) : Promise.resolve(fixture('swu-passage')))
    expect((await swuVehicleTrip(withoutWay, 47)).track).toEqual([])
  })

  it('reports a vehicle that is on no trip', async () => {
    const parked: GetJson = () => Promise.resolve({ VehiclePassage: { State: 'no vehicle found' }, VehiclePattern: {} })
    await expect(swuVehicleTrip(parked, 1)).rejects.toBeInstanceOf(UnknownVehicle)
  })
})

describe('the vehicle board', () => {
  const START = Date.parse('2026-11-19T21:40:00Z')
  // SWU's list as it is at the moment it is asked: every vehicle with the age of its report in seconds, or parked.
  const swu = (fleet: () => Record<number, number | 'parked'>) => {
    let asked = 0
    const getJson: GetJson = () => {
      asked++
      const now = Date.now()
      return Promise.resolve({
        VehicleTrip: {
          CurrentTimestamp: new Date(now).toISOString().replace('.000Z', '+00:00'),
          TripData: Object.entries(fleet()).map(([id, age]) =>
            age === 'parked'
              ? { VehicleNumber: Number(id), VehicleCategory: 1, IsActive: false }
              : {
                  VehicleNumber: Number(id),
                  VehicleCategory: 1,
                  IsActive: true,
                  PositionData: { Longitude: 9.99, Latitude: 48.4, Bearing: 90 },
                  TimeData: { Deviation: 0, ReferenceTime: new Date(now - age * 1_000).toISOString().replace('.000Z', '+00:00') },
                  JourneyData: { RouteNumber: 1, DepartureDirectionText: 'Söflingen' },
                },
          ),
        },
      })
    }
    return { getJson, asked: () => asked }
  }
  const ids = (answer: { vehicles: { id: number }[] }) => answer.vehicles.map((vehicle) => vehicle.id)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })
  afterEach(() => vi.useRealTimers())

  it('asks SWU once for all maps opened right after a start', async () => {
    const { getJson, asked } = swu(() => ({ 47: 9, 52: 9, 53: 9 }))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    const [first, second] = await Promise.all([board.all(), board.all()])
    expect(ids(first)).toEqual([47, 52, 53])
    expect(ids(second)).toEqual([47, 52, 53])
    expect(first.asOf).toBe('2026-11-19T21:39:51.000Z')
    expect(asked()).toBe(1)
  })

  it('asks SWU around the clock, map or no map, and answers a map from memory', async () => {
    const { getJson, asked } = swu(() => ({ 47: 9 }))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(asked()).toBe(5)
    await board.all()
    await board.all()
    expect(asked()).toBe(5)
    // Nobody looks at a map for ten minutes.
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(asked()).toBe(45)
  })

  it('leaves a slow SWU alone for a while after each answer', async () => {
    const source = swu(() => ({ 47: 9 }))
    const getJson: GetJson = (url) => new Promise((answer) => setTimeout(() => answer(source.getJson(url)), 14_000))
    vehicleBoard({ getJson, stops: { lineOf } })
    // Asked at 0, answered at 14; asked again at 19, 38 and 57.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(source.asked()).toBe(3)
    await vi.advanceTimersByTimeAsync(11_000)
    expect(source.asked()).toBe(4)
  })

  it('drops a vehicle that a list with news leaves out', async () => {
    let fleet: Record<number, number | 'parked'> = { 47: 9, 52: 9 }
    const { getJson } = swu(() => fleet)
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    expect(ids(await board.all())).toEqual([47, 52])
    fleet = { 47: 9, 52: 'parked' }
    await vi.advanceTimersByTimeAsync(15_000)
    expect(ids(await board.all())).toEqual([47])
  })

  it("keeps the vehicles where they were while SWU's reports stall, and says since when", async () => {
    // As seen on 2026-11-19: no news for minutes, and after two of them SWU lists every vehicle as parked.
    let reportedAt = START - 9_000
    let stalled = false
    const age = () => Math.round((Date.now() - reportedAt) / 1_000)
    const { getJson } = swu(() => (stalled && age() > 120 ? { 47: 'parked', 52: 'parked' } : { 47: age(), 52: age() }))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    expect(ids(await board.all())).toEqual([47, 52])

    stalled = true
    for (let minute = 0; minute < 6; minute++) {
      await vi.advanceTimersByTimeAsync(60_000)
      const answer = await board.all()
      expect(ids(answer)).toEqual([47, 52])
      expect(answer.asOf).toBe('2026-11-19T21:39:51.000Z')
    }

    // Seven minutes after their last report they are gone.
    await vi.advanceTimersByTimeAsync(90_000)
    expect(await board.all()).toMatchObject({ vehicles: [], asOf: null })

    // The reports are back.
    reportedAt = Date.now()
    stalled = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(ids(await board.all())).toEqual([47, 52])
  })

  // As seen on 2026-11-19 and 2026-11-20: SWU hands out new positions every five minutes and
  // lists every vehicle as parked once its report is two minutes old.
  const everyFiveMinutes = () => {
    const age = () => Math.round(((Date.now() - (START - 9_000)) % 300_000) / 1_000)
    return swu(() => (age() > 120 ? { 47: 'parked', 52: 'parked' } : { 47: age(), 52: age() }))
  }

  it('has the vehicles for a map opened after a long pause, in a minute in which SWU lists none', async () => {
    const { getJson, asked } = everyFiveMinutes()
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    // Nobody looks at a map for 23 minutes. The last positions are three minutes old by then.
    await vi.advanceTimersByTimeAsync(23 * 60_000)
    const before = asked()
    const answer = await board.all()
    expect(ids(answer)).toEqual([47, 52])
    expect(answer.asOf).toBe('2026-11-19T21:59:51.000Z')
    expect(asked()).toBe(before)
  })

  it("notes once an hour what SWU's list did", async () => {
    const { getJson } = everyFiveMinutes()
    const notes: string[] = []
    vehicleBoard({ getJson, stops: { lineOf }, note: (line) => notes.push(line) })
    await vi.advanceTimersByTimeAsync(59 * 60_000)
    expect(notes).toEqual([])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(notes).toEqual(["SWU's vehicle list in the last hour: asked 241 times, 0 failed, slowest answer 0 s, up to 2 vehicles, longest without a new position 300 s"])
  })

  it('shows what it knows while SWU does not answer, and fails once that is seven minutes old', async () => {
    let down = false
    const source = swu(() => ({ 47: 9 }))
    const logged: unknown[] = []
    const board = vehicleBoard({ getJson: (url) => (down ? Promise.reject(new Error('SWU is down')) : source.getJson(url)), stops: { lineOf }, log: (problem) => logged.push(problem) })
    expect(ids(await board.all())).toEqual([47])
    down = true
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(ids(await board.all())).toEqual([47])
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(ids(await board.all())).toEqual([47])
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    await expect(board.all()).rejects.toThrow('SWU is down')
    // One line in the log for the whole outage.
    expect(logged).toHaveLength(1)
  })

  it("lets a map opened right after a start wait for SWU's first answer", async () => {
    const source = swu(() => ({ 47: 9 }))
    const getJson: GetJson = (url) => new Promise((answer) => setTimeout(() => answer(source.getJson(url)), 8_000))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    const answer = board.all()
    await vi.advanceTimersByTimeAsync(8_000)
    expect(ids(await answer)).toEqual([47])
  })

  it('fails while SWU cannot be reached and nothing is known, and has the vehicles once it can', async () => {
    let down = true
    const source = swu(() => ({ 47: 9 }))
    const board = vehicleBoard({ getJson: (url) => (down ? Promise.reject(new Error('SWU is down')) : source.getJson(url)), stops: { lineOf } })
    await expect(board.all()).rejects.toThrow('SWU is down')
    down = false
    await vi.advanceTimersByTimeAsync(15_000)
    expect(ids(await board.all())).toEqual([47])
  })
})
