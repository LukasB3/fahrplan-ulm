import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { swuVehicles, swuVehicleTrip } from '../src/swu.js'
import { UnknownVehicle, type GetJson } from '../src/upstream.js'
import { vehicleBoard } from '../src/vehicles.js'

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const lineOf = (route: number) => (route < 200 ? String(route) : undefined)

describe('vehicles, as recorded', () => {
  it('are the ones on a trip, with position, heading, delay and line', async () => {
    const vehicles = await swuVehicles(() => Promise.resolve(fixture('swu-vehicles')), lineOf)
    // Of five in the list one is parked and one has no route.
    expect(vehicles.map((vehicle) => vehicle.id)).toEqual([47, 52, 53])
    expect(vehicles[0]).toMatchObject({ line: '1', mode: 'tram', destination: 'Söflingen', bearing: 260, delaySeconds: 20 })
    expect(vehicles[0]!.lat).toBeCloseTo(48.40196, 4)
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
  it('asks SWU once for all maps open within ten seconds', async () => {
    let asked = 0
    const getJson: GetJson = () => {
      asked++
      return Promise.resolve(fixture('swu-vehicles'))
    }
    const board = vehicleBoard({ getJson, stops: { lineOf } })
    const [first, second] = await Promise.all([board.all(), board.all()])
    expect(first.vehicles).toHaveLength(3)
    expect(second.vehicles).toHaveLength(3)
    expect(asked).toBe(1)
  })
})
