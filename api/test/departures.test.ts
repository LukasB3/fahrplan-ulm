import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { departureBoard } from '../src/departures.js'
import { efaDeparturesOfOthers } from '../src/efa.js'
import { stopDirectory } from '../src/stops.js'
import { swuDepartures, swuStops } from '../src/swu.js'
import { UnknownStop, type GetJson } from '../src/upstream.js'

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const answering = (answer: unknown): GetJson => () => Promise.resolve(answer)

describe('SWU departures, as recorded', () => {
  it('become departures with line, destination, platform and vehicle', async () => {
    const departures = await swuDepartures(answering(fixture('swu-departures')), 1008, 6)
    expect(departures[0]).toEqual({
      line: '5',
      mode: 'bus',
      destination: 'Ludwigsfeld',
      platform: 'A',
      planned: '2026-11-15T12:26:00.000Z',
      expected: expect.stringMatching(/^2026-11-15T12:\d\d:\d\d\.000Z$/),
      vehicle: 173,
    })
    expect(departures.find((departure) => departure.line === '2')?.mode).toBe('tram')
  })

  it('keep a trip that has no vehicle yet', async () => {
    const departures = await swuDepartures(answering(fixture('swu-departures')), 1008, 6)
    expect(departures.find((departure) => departure.destination === 'Kasernstraße')).toMatchObject({ line: '7', mode: 'bus', vehicle: null })
  })

  it('drop only the entry SWU got wrong', async () => {
    const departures = await swuDepartures(answering(fixture('swu-departures')), 1008, 6)
    expect(departures).toHaveLength(5)
    expect(departures.some((departure) => departure.destination === 'Söflingen')).toBe(false)
  })

  it('report a stop SWU does not know', async () => {
    const unknown = answering({ StopPassage: { State: 'no stop found' } })
    await expect(swuDepartures(unknown, 999_999, 6)).rejects.toBeInstanceOf(UnknownStop)
  })
})

describe('SWU stop list, as recorded', () => {
  it("gives each stop's id at DING from its platforms, not from its number", async () => {
    const ids = new Map((await swuStops(answering(fixture('swu-stops')))).map((stop) => [stop.number, stop.dhid]))
    expect(ids.get(1008)).toBe('de:08421:1008')
    // SWU and DING number these two the other way round.
    expect(ids.get(1249)).toBe('de:08421:1250')
    expect(ids.get(1250)).toBe('de:08421:1249')
  })

  it('makes a stop a place to travel to, whatever the spelling of its name', async () => {
    const stops = stopDirectory(answering(fixture('swu-stops')))
    await stops.refresh()
    expect(stops.names()).toEqual(['Hauptbahnhof', 'Science Park II', 'Science Park III'])
    expect(stops.place(' hauptbahnhof ')).toMatchObject({ kind: 'stop', stop: 'de:08421:1008', name: 'Hauptbahnhof' })
    expect(stops.place('Münster')).toBeUndefined()
  })
})

describe('DING departures, as recorded', () => {
  it("leave out SWU's own lines", async () => {
    const departures = await efaDeparturesOfOthers(answering(fixture('efa-departures')), 'https://efa.example', 'de:08421:1008')
    expect(departures.map((departure) => departure.line)).toEqual(['ICE 515', 'RE55', 'WB 962', expect.stringMatching(/^\d+$/)])
  })

  it('name trains, platforms and modes the way they are signed', async () => {
    const [ice, regional, , bus] = await efaDeparturesOfOthers(answering(fixture('efa-departures')), 'https://efa.example', 'de:08421:1008')
    expect(ice).toMatchObject({ mode: 'train', destination: 'München Hbf', platform: '2', planned: '2026-11-15T12:15:00Z', vehicle: null })
    expect(regional).toMatchObject({ mode: 'train', platform: '7 Nord' })
    expect(bus?.mode).toBe('bus')
    expect(bus?.platform).not.toMatch(/Bstg/)
  })
})

describe('the board of a stop', () => {
  const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
  const swuEntry = (line: string, minutes: number) => ({ RouteName: line, VehicleCategory: 5, DepartureDirectionText: 'Wiley', PlatformName: 'A', DepartureTimeScheduled: inMinutes(minutes), DepartureTimeActual: inMinutes(minutes) })
  const efaEvent = (number: string, minutes: number, operator = 'RAB') => ({
    departureTimePlanned: inMinutes(minutes),
    location: { properties: { platformName: 'Bstg. E' } },
    transportation: { number, name: `Regionalbus Linie ${number}`, product: { class: 6 }, destination: { name: 'Illertissen' }, operator: { name: operator } },
  })
  const stopList = { StopAttributes: { StopData: [{ StopNumber: 1350, StopName: 'Ehinger Tor', StopCoordinates: { Latitude: 48.39, Longitude: 9.98 }, StopPoints: [{ StopPointCode: 'de:08421:1350:0:1' }] }] } }

  const setUp = async (swu: unknown[], efa: (() => unknown) | undefined) => {
    const asked: string[] = []
    const getJson: GetJson = (url) => {
      asked.push(new URL(url).pathname.split('/').pop()!)
      if (url.includes('BaseData')) return Promise.resolve(stopList)
      if (url.includes('XML_DM_REQUEST')) return efa ? Promise.resolve(efa()) : Promise.reject(new Error('DING is down'))
      return Promise.resolve({ StopPassage: { State: 'ok', DepartureData: swu } })
    }
    const problems: unknown[] = []
    const stops = stopDirectory(getJson)
    await stops.refresh()
    const board = departureBoard({ getJson, efaBase: 'https://efa.example', stops, log: (problem) => problems.push(problem) })
    return { board, asked, problems }
  }

  it('merges both sources in the order things leave', async () => {
    const { board } = await setUp([swuEntry('5', 4), swuEntry('7', 12)], () => ({ stopEvents: [efaEvent('70', 8), efaEvent('5', 4, 'SWU')] }))
    const { departures, stale } = await board.board(1350, 20)
    expect(departures.map((departure) => departure.line)).toEqual(['5', '70', '7'])
    expect(stale).toBe(false)
  })

  it('leaves out what has left and stops at the limit', async () => {
    const { board } = await setUp([swuEntry('4', -5), swuEntry('5', 2), swuEntry('7', 3), swuEntry('8', 4)], () => ({ stopEvents: [] }))
    expect((await board.board(1350, 2)).departures.map((departure) => departure.line)).toEqual(['5', '7'])
  })

  it("shows SWU's lines when DING is down", async () => {
    const { board, problems } = await setUp([swuEntry('5', 4)], undefined)
    expect((await board.board(1350, 20)).departures).toHaveLength(1)
    expect(problems).toHaveLength(1)
  })

  it('does not ask DING again about a stop that only SWU serves', async () => {
    const { board, asked } = await setUp([swuEntry('5', 4)], () => ({ stopEvents: [efaEvent('5', 4, 'SWU')] }))
    await board.board(1350, 20)
    await board.board(1350, 20)
    expect(asked.filter((request) => request === 'XML_DM_REQUEST')).toHaveLength(1)
  })

  it('shows SWU lines only for a stop it cannot place at DING', async () => {
    const { board, asked } = await setUp([swuEntry('5', 4)], () => ({ stopEvents: [efaEvent('70', 8)] }))
    expect((await board.board(1008, 20)).departures.map((departure) => departure.line)).toEqual(['5'])
    expect(asked).not.toContain('XML_DM_REQUEST')
  })
})
