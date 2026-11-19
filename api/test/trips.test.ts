import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { efaJourneys, efaPlaces } from '../src/efa.js'
import { berlinClock } from '../src/time.js'
import { arrivesAt, leavesAt, tripPlanner } from '../src/trips.js'
import type { Journey, Place, TripRequest } from '../src/types.js'
import type { GetJson } from '../src/upstream.js'

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const answering = (answer: unknown): GetJson => () => Promise.resolve(answer)

const hbf: Place = { kind: 'stop', stop: 'de:08421:1008', name: 'Hauptbahnhof', town: 'Ulm', lat: 48.39935, lon: 9.98421 }
const home: Place = { kind: 'address', stop: null, name: 'Frauenstraße 20', town: 'Ulm', lat: 48.398554, lon: 9.996488 }

describe('the clock in Ulm', () => {
  it('is an hour ahead of UTC in winter and two in summer', () => {
    expect(berlinClock(new Date('2026-11-15T12:05:00Z'))).toEqual({ date: '20261115', time: '1305' })
    expect(berlinClock(new Date('2026-07-01T22:30:00Z'))).toEqual({ date: '20260702', time: '0030' })
  })
})

describe('place search, as recorded', () => {
  it('finds a house address and leaves out the same street in another town far away', async () => {
    const places = (await efaPlaces(answering(fixture('efa-places-address')), 'https://efa.example', 'Frauenstraße 20')).map((match) => match.place)
    expect(places[0]).toEqual({ kind: 'address', stop: null, name: 'Frauenstraße 20', town: 'Ulm', lat: 48.398554, lon: 9.996488 })
    expect(places.map((place) => place.town)).toEqual(['Ulm', 'Vöhringen (Kreis Neu-Ulm)', 'Ulm', 'Ulm'])
  })

  it('puts the stop before the shop of the same name and keeps its id', async () => {
    const places = (await efaPlaces(answering(fixture('efa-places-stop')), 'https://efa.example', 'Blautal-Center')).map((match) => match.place)
    expect(places.map((place) => [place.kind, place.stop])).toEqual([
      ['stop', 'de:08421:1354'],
      ['poi', null],
    ])
  })

  it('asks within Ulm unless a town is named', async () => {
    const asked: string[] = []
    const getJson: GetJson = (url) => {
      asked.push(new URL(url).searchParams.get('name_sf')!)
      return Promise.resolve({ locations: [] })
    }
    await efaPlaces(getJson, 'https://efa.example', 'Frauenstraße 20')
    await efaPlaces(getJson, 'https://efa.example', 'Neu-Ulm Bahnhofstraße 3')
    expect(asked).toEqual(['Ulm Frauenstraße 20', 'Neu-Ulm Bahnhofstraße 3'])
  })

  it('drops places far from Ulm', async () => {
    const aachen = { id: 'de:05334:1008', type: 'stop', name: 'Aachen, Hauptbahnhof', coord: [50.7678, 6.0911], matchQuality: 1000 }
    expect(await efaPlaces(answering({ locations: [aachen] }), 'https://efa.example', 'Hauptbahnhof')).toEqual([])
  })
})

describe('journeys, as recorded', () => {
  const query = { from: home, to: hbf, mode: 'depart' as const, at: new Date('2026-11-15T12:40:00Z') }

  it('are a walk to the stop and a ride', async () => {
    const [journey] = await efaJourneys(answering(fixture('efa-trip-walk-ride')), 'https://efa.example', query)
    expect(journey!.legs.map((leg) => leg.kind)).toEqual(['walk', 'ride'])
    const [walk, ride] = journey!.legs
    expect(walk).toMatchObject({ kind: 'walk', metres: 590, from: { name: 'Hafenbad 33', planned: '2026-11-15T12:52:00Z' }, to: { name: 'Theater', platform: 'B' } })
    expect(walk?.kind === 'walk' ? walk.path.length : 0).toBe(44)
    expect(ride).toMatchObject({ kind: 'ride', line: '2', mode: 'tram', destination: 'Science Park II', stopsBetween: 6, to: { name: 'Kliniken Wissenschaftsstadt', platform: 'C', planned: '2026-11-15T13:12:00Z' } })
    expect(journey!.changes).toBe(0)
    expect(journey!.fare).toBe(3.05)
  })

  it('count a change and end with the walk to the door', async () => {
    const [journey] = await efaJourneys(answering(fixture('efa-trip-change')), 'https://efa.example', query)
    expect(journey!.legs.map((leg) => (leg.kind === 'ride' ? leg.line : 'walk'))).toEqual(['1', '2', 'walk'])
    expect(journey!.changes).toBe(1)
    expect(journey!.legs.at(-1)).toMatchObject({ metres: 390, to: { name: 'Albert-Einstein-Allee 25', platform: null } })
  })

  it('ask for a stop by its id and for anything else by its position, in the clock of Ulm', async () => {
    let asked = new URL('https://efa.example')
    const getJson: GetJson = (url) => {
      asked = new URL(url)
      return Promise.resolve({ journeys: [] })
    }
    await efaJourneys(getJson, 'https://efa.example', { ...query, mode: 'arrive' })
    const param = (name: string) => asked.searchParams.get(name)
    expect([param('type_origin'), param('name_origin')]).toEqual(['coord', '9.99649:48.39855:WGS84[dd.ddddd]'])
    expect([param('type_destination'), param('name_destination')]).toEqual(['any', 'de:08421:1008'])
    expect([param('itdDate'), param('itdTime'), param('itdTripDateTimeDepArr')]).toEqual(['20261115', '1340', 'arr'])
  })

  it('name the stops a ride passes, each with its time', async () => {
    const at = (minute: number) => `2026-11-15T13:${String(minute).padStart(2, '0')}:00Z`
    const platform = (name: string, times: Record<string, string>) => ({ type: 'platform', name: `Ulm ${name}`, parent: { disassembledName: name, parent: { name: 'Ulm' } }, ...times })
    const sequence = [
      platform('Hauptbahnhof', { departureTimePlanned: at(0) }),
      platform('Theater', { arrivalTimePlanned: at(1), departureTimePlanned: at(1), arrivalTimeEstimated: at(3), departureTimeEstimated: at(3) }),
      // A stop the planner names without a time is counted but cannot be listed.
      platform('Stadtwerke', {}),
      platform('Lehrer Tal', { departureTimePlanned: at(4) }),
      platform('Multscherschule', { arrivalTimePlanned: at(6) }),
    ]
    const leg = { origin: sequence[0], destination: sequence.at(-1), transportation: { number: '2', product: { class: 4 }, destination: { name: 'Science Park II' } }, stopSequence: sequence }
    const [journey] = await efaJourneys(answering({ journeys: [{ legs: [leg] }] }), 'https://efa.example', query)
    const [ride] = journey!.legs
    expect(ride).toMatchObject({ kind: 'ride', stopsBetween: 3 })
    expect(ride?.kind === 'ride' ? ride.calls : []).toEqual([
      { name: 'Theater', platform: null, planned: at(1), expected: at(3) },
      { name: 'Lehrer Tal', platform: null, planned: at(4), expected: null },
    ])
  })

  it('leave out a journey with a leg that has no times, and legs that are no travel', async () => {
    const leg = (productClass: number, from?: string, to?: string) => ({
      origin: { name: 'A', departureTimePlanned: from },
      destination: { name: 'B', arrivalTimePlanned: to },
      transportation: { number: '7', product: { class: productClass }, destination: { name: 'Jungingen' } },
    })
    const journeys = await efaJourneys(
      answering({
        journeys: [{ legs: [leg(5)] }, { legs: [leg(5, '2026-11-15T13:00:00Z', '2026-11-15T13:10:00Z'), leg(98, '2026-11-15T13:10:00Z', '2026-11-15T13:10:00Z')] }],
      }),
      'https://efa.example',
      query,
    )
    expect(journeys).toHaveLength(1)
    expect(journeys[0]!.legs).toHaveLength(1)
  })
})

describe('what the planner shows', () => {
  const NOW = Date.parse('2026-11-15T12:00:00Z')
  const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()
  const ride = (line: string, leave: number, arrive: number) => ({
    origin: { type: 'platform', parent: { disassembledName: 'Theater' }, departureTimePlanned: inMinutes(leave) },
    destination: { type: 'platform', parent: { disassembledName: 'Hauptbahnhof' }, arrivalTimePlanned: inMinutes(arrive) },
    transportation: { number: line, product: { class: 5 }, destination: { name: 'Hauptbahnhof' } },
  })
  const journey = (line: string, leave: number, arrive: number, interchanges = 0) => ({ interchanges, legs: [ride(line, leave, arrive)] })

  const planning = (answers: { depart?: unknown[]; arrive?: unknown[] }) => {
    const asked: string[] = []
    const getJson: GetJson = (url) => {
      const mode = new URL(url).searchParams.get('itdTripDateTimeDepArr') === 'arr' ? 'arrive' : 'depart'
      asked.push(mode)
      return Promise.resolve({ journeys: answers[mode] ?? [] })
    }
    return { planner: tripPlanner({ getJson, efaBase: 'https://efa.example' }), asked }
  }
  const request = (mode: 'depart' | 'arrive', at: string | null): TripRequest => ({ from: home, to: hbf, time: { mode, at } })
  const lines = (journeys: Journey[]) => journeys.map(({ legs: [first] }) => (first?.kind === 'ride' ? first.line : 'walk'))

  it('lists journeys in the order they leave, without the ones already gone', async () => {
    const { planner } = planning({ depart: [journey('7', 12, 20), journey('5', 3, 15), journey('4', -4, 6)] })
    const trips = await planner.trips(request('depart', null), NOW)
    expect(lines(trips.journeys)).toEqual(['5', '7'])
    expect(trips.note).toBe('ok')
  })

  it('leaves out doubles and journeys no one would take', async () => {
    // Line 9 leaves before line 5 and arrives after it.
    const { planner } = planning({ depart: [journey('5', 5, 15), journey('5', 5, 15), journey('9', 4, 25), journey('7', 12, 20)] })
    expect(lines((await planner.trips(request('depart', null), NOW)).journeys)).toEqual(['5', '7'])
  })

  it('keeps a slower journey that saves a change', async () => {
    const { planner } = planning({ depart: [journey('5', 5, 15, 1), journey('9', 4, 25, 0)] })
    expect(lines((await planner.trips(request('depart', null), NOW)).journeys)).toEqual(['9', '5'])
  })

  it('puts the latest journey that still arrives in time first', async () => {
    const { planner } = planning({ arrive: [journey('4', 10, 22), journey('5', 30, 44), journey('7', 40, 58), journey('8', 50, 70)] })
    const trips = await planner.trips(request('arrive', inMinutes(60)), NOW)
    expect(lines(trips.journeys)).toEqual(['7', '5', '4'])
    expect(trips.note).toBe('ok')
    expect(arrivesAt(trips.journeys[0]!)).toBeLessThanOrEqual(NOW + 60 * 60_000)
  })

  it('shows what leaves next, and says so, when nothing arrives in time', async () => {
    const { planner, asked } = planning({ arrive: [journey('4', -20, 8)], depart: [journey('5', 6, 25)] })
    const trips = await planner.trips(request('arrive', inMinutes(10)), NOW)
    expect(trips.note).toBe('too_late')
    expect(lines(trips.journeys)).toEqual(['5'])
    expect(leavesAt(trips.journeys[0]!)).toBeGreaterThan(NOW)
    expect(asked).toEqual(['arrive', 'depart'])
  })

  it('lists journeys that have left when the ones before the list are asked for', async () => {
    const { planner } = planning({ arrive: [journey('4', -30, -18), journey('5', -12, -2), journey('7', 3, 15)] })
    // Earlier than a list that started now: whatever arrives before its first journey does.
    const earlier = await planner.trips({ ...request('arrive', inMinutes(0)), past: true }, NOW)
    expect(lines(earlier.journeys)).toEqual(['5', '4'])
    expect(earlier.note).toBe('ok')
    // Without the word, a time that has passed still gives what leaves next.
    expect((await planner.trips(request('arrive', inMinutes(0)), NOW)).note).toBe('too_late')
  })

  it('lists walking all the way after the rides, unless it gets there first', async () => {
    const walk = (leave: number, arrive: number) => ({
      interchanges: 0,
      legs: [{ origin: { type: 'address', name: 'Hier', departureTimePlanned: inMinutes(leave) }, destination: { type: 'address', name: 'Dort', arrivalTimePlanned: inMinutes(arrive) }, transportation: { product: { class: 100 } }, distance: 900 }],
    })
    // The rides need a change, so walking is not simply worse and stays in the list.
    const slowWalk = planning({ depart: [walk(0, 14), journey('5', 3, 9, 1), journey('7', 8, 16, 1)] })
    expect(lines((await slowWalk.planner.trips(request('depart', null), NOW)).journeys)).toEqual(['5', '7', 'walk'])
    // A direct ride that leaves later and arrives earlier makes the walk pointless: it is not listed at all.
    const pointlessWalk = planning({ depart: [walk(0, 14), journey('5', 3, 9)] })
    expect(lines((await pointlessWalk.planner.trips(request('depart', null), NOW)).journeys)).toEqual(['5'])
    const quickWalk = planning({ depart: [walk(0, 6), journey('5', 3, 9)] })
    expect(lines((await quickWalk.planner.trips(request('depart', null), NOW)).journeys)).toEqual(['walk', '5'])
  })

  it('asks the planner once for the same journey within the minute', async () => {
    const { planner, asked } = planning({ depart: [journey('5', 5, 15)] })
    await planner.trips(request('depart', null), NOW)
    await planner.trips(request('depart', null), NOW + 20_000)
    expect(asked).toHaveLength(1)
  })
})
