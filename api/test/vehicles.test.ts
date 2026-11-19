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

  it('asks SWU once for all maps opened together', async () => {
    const { getJson, asked } = swu(() => ({ 47: 9, 52: 9, 53: 9 }))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    const [first, second] = await Promise.all([board.all(), board.all()])
    expect(ids(first)).toEqual([47, 52, 53])
    expect(ids(second)).toEqual([47, 52, 53])
    expect(first.asOf).toBe('2026-11-19T21:39:51.000Z')
    expect(asked()).toBe(1)
  })

  it('asks SWU on its own clock while a map is open, and stops when none is', async () => {
    const { getJson, asked } = swu(() => ({ 47: 9 }))
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    await board.all()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(asked()).toBe(4)
    // The map asks again: answered from memory, without a request of its own.
    await board.all()
    expect(asked()).toBe(4)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    const whileWatched = asked()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(asked()).toBe(whileWatched)
  })

  it('drops a vehicle that a list with news leaves out', async () => {
    let fleet: Record<number, number | 'parked'> = { 47: 9, 52: 9 }
    const { getJson } = swu(() => fleet)
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    expect(ids(await board.all())).toEqual([47, 52])
    fleet = { 47: 9, 52: 'parked' }
    await vi.advanceTimersByTimeAsync(10_000)
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
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ids(await board.all())).toEqual([47, 52])
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

  it('fails when SWU cannot be reached and nothing is known', async () => {
    const board = vehicleBoard({ getJson: () => Promise.reject(new Error('SWU is down')), stops: { lineOf } })
    await expect(board.all()).rejects.toThrow('SWU is down')
  })
})
