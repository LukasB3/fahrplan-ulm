import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { departureBoard, pickRun } from '../src/departures.js'
import { efaDepartures, efaRuns } from '../src/efa.js'
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
      platformId: 'de:08421:1008:1:2',
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

  it('are none, not a failure, where nothing leaves in the next hours', async () => {
    const quiet = answering({ StopPassage: { State: 'no departures found' } })
    await expect(swuDepartures(quiet, 1675, 6)).resolves.toEqual([])
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
    const stops = stopDirectory((url) => Promise.resolve(fixture(url.includes('/route/') ? 'swu-routes' : 'swu-stops')))
    await stops.refresh()
    expect(stops.names()).toEqual(['Hauptbahnhof', 'Science Park II', 'Science Park III'])
    expect(stops.place(' hauptbahnhof ')).toMatchObject({ kind: 'stop', stop: 'de:08421:1008', name: 'Hauptbahnhof' })
    expect(stops.place('Münster')).toBeUndefined()
  })

  it('knows what a route number is called, and leaves depot trips unnamed', async () => {
    const stops = stopDirectory((url) => Promise.resolve(fixture(url.includes('/route/') ? 'swu-routes' : 'swu-stops')))
    await stops.refresh()
    expect([stops.lineOf(5), stops.lineOf(901), stops.lineOf(101), stops.lineOf(201)]).toEqual(['5', 'N1', '1', undefined])
  })
})

describe('DING departures, as recorded', () => {
  const recorded = () => efaDepartures(answering(fixture('efa-departures')), 'https://efa.example', 'de:08421:1008')

  it("keep SWU's own lines apart from everything else", async () => {
    const { swu, others } = await recorded()
    expect(others.map((departure) => departure.line)).toEqual(['ICE 515', 'RE55', 'WB 962', expect.stringMatching(/^\d+$/)])
    expect(swu.map((departure) => departure.line)).toEqual(['5', '1'])
    expect(swu[0]).toMatchObject({ platform: 'A', planned: '2026-11-15T12:26:00Z', vehicle: null, platformId: 'de:08421:1008:1:2' })
  })

  it('name trains, platforms and modes the way they are signed', async () => {
    const [ice, regional, , bus] = (await recorded()).others
    expect(ice).toMatchObject({ mode: 'train', destination: 'München Hbf', platform: '2', planned: '2026-11-15T12:15:00Z', vehicle: null })
    expect(regional).toMatchObject({ mode: 'train', platform: '7 Nord' })
    expect(bus?.mode).toBe('bus')
    expect(bus?.platform).not.toMatch(/Bstg/)
  })
})

describe('DING departures with their further stops, as recorded at Ehinger Tor', () => {
  const asked: string[] = []
  const recorded: GetJson = (url) => {
    asked.push(url)
    return Promise.resolve(fixture('efa-departures-runs'))
  }
  const runs = () => efaRuns(recorded, 'https://efa.example', 'de:08421:1350', new Date('2026-11-15T20:18:00Z'))

  it('are asked for from the given moment, by the clock in Ulm, with the stop sequences', async () => {
    await runs()
    expect(asked.at(-1)).toContain('includeCompleteStopSeq=1')
    expect(asked.at(-1)).toContain('itdDate=20261115&itdTime=2118')
  })

  it("include SWU's own lines, each starting at this stop", async () => {
    const events = await runs()
    expect(events.map((event) => event.line)).toEqual(['49', '1', '2', '7', '4', '1'])
    expect(events.every((event) => event.stops[0]?.name === 'Ehinger Tor')).toBe(true)
  })

  it('give every further stop with the time the vehicle gets there', async () => {
    const tram = (await runs())[1]!
    expect(tram.platformId).toBe('de:08421:1350:1:C')
    expect(tram.stops.map((stop) => stop.name)).toEqual(['Ehinger Tor', 'Hauptbahnhof', 'Theater', 'Justizgebäude', 'Ostpreußenweg'])
    expect(tram.stops[0]).toMatchObject({ planned: '2026-11-15T20:27:00Z', platform: 'C' })
    expect(tram.stops.at(-1)).toMatchObject({ planned: '2026-11-15T20:52:00Z' })
    expect(tram.stops.every((stop, index, all) => index === 0 || stop.planned >= all[index - 1]!.planned)).toBe(true)
  })

  it('leave out a further stop that has no time, and a departure that has none', async () => {
    const answer = fixture('efa-departures-runs') as { stopEvents: { departureTimePlanned?: string; onwardLocations: Record<string, unknown>[] }[] }
    delete answer.stopEvents[0]!.departureTimePlanned
    answer.stopEvents[1]!.onwardLocations[1] = { name: 'Ulm Theater', type: 'platform' }
    const events = await efaRuns(answering(answer), 'https://efa.example', 'de:08421:1350', new Date('2026-11-15T20:18:00Z'))
    expect(events).toHaveLength(5)
    expect(events[0]!.stops.map((stop) => stop.name)).toEqual(['Ehinger Tor', 'Hauptbahnhof', 'Justizgebäude', 'Ostpreußenweg'])
  })

  it('name a stop outside Ulm with its town, unless the town is in the name already', async () => {
    const answer = fixture('efa-departures-runs') as { stopEvents: { onwardLocations: { parent: { disassembledName: string; parent: { name: string } } }[] }[] }
    const [first, second] = answer.stopEvents[0]!.onwardLocations
    Object.assign(first!.parent, { disassembledName: 'Bahnhof', parent: { name: 'Ehingen (Donau)' } })
    Object.assign(second!.parent, { disassembledName: 'Wendlingen (N)', parent: { name: 'Wendlingen (Neckar)' } })
    const [event] = await efaRuns(answering(answer), 'https://efa.example', 'de:08421:1350', new Date('2026-11-15T20:18:00Z'))
    expect(event!.stops.slice(1, 3).map((stop) => stop.name)).toEqual(['Ehingen (Donau), Bahnhof', 'Wendlingen (N)'])
  })

  describe('and the one a board row means', () => {
    const picked = async (wanted: Parameters<typeof pickRun>[1]) => pickRun(await runs(), wanted)
    const next = async (wanted: Parameters<typeof pickRun>[1]) => (await picked(wanted))?.stops[1]?.name

    it('is found among four leaving in the same minute, by platform and line', async () => {
      expect(await next({ line: '4', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:B' })).toBe('Steinerne Brücke')
      expect((await picked({ line: '7', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:B' }))?.stops.at(-1)?.name).toBe('Rathaus Jungingen')
      expect((await picked({ line: '2', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:C' }))?.stops.at(-1)?.name).toBe('Science Park II')
      expect((await picked({ line: '1', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:C' }))?.stops.at(-1)?.name).toBe('Ostpreußenweg')
    })

    it('is found by line and minute when the platform is unknown or differs', async () => {
      expect(await next({ line: '4', planned: '2026-11-15T20:27:30.000Z', platformId: null })).toBe('Steinerne Brücke')
      expect(await next({ line: '1', planned: '2026-11-15T20:30:00.000Z', platformId: 'de:08421:1350:9:Z' })).toBe('Blücherstraße')
    })

    it('is taken as it is when it is alone at its platform and minute, whatever the line is called', async () => {
      expect(await next({ line: '1E', planned: '2026-11-15T20:30:00.000Z', platformId: 'de:08421:1350:1:D' })).toBe('Blücherstraße')
    })

    it('is not guessed: another minute, or two candidates and no matching line', async () => {
      expect(await next({ line: '4', planned: '2026-11-15T20:28:00.000Z', platformId: 'de:08421:1350:1:B' })).toBeUndefined()
      expect(await next({ line: 'X', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:C' })).toBeUndefined()
    })
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
  const listed = (number: number, name: string, platform: string) => ({ StopNumber: number, StopName: name, StopCoordinates: { Latitude: 48.39, Longitude: 9.98 }, StopPoints: [{ StopPointCode: platform }] })
  // SWU calls the second stop "Rathaus"; DING, in the recorded answer, "Rathaus Ulm".
  const stopList = { StopAttributes: { StopData: [listed(1350, 'Ehinger Tor', 'de:08421:1350:0:1'), listed(1002, 'Rathaus', 'de:08421:1002:0:1')] } }

  const setUp = async (swu: unknown[], efa: (() => unknown) | undefined) => {
    const asked: string[] = []
    const getJson: GetJson = (url) => {
      asked.push(new URL(url).pathname.split('/').pop()!)
      if (url.includes('/route/')) return Promise.resolve({ RouteAttributes: { RouteData: [] } })
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

  it("shows SWU's lines from DING after the last departure SWU lists", async () => {
    const { board } = await setUp([swuEntry('5', 4)], () => ({ stopEvents: [efaEvent('5', 4, 'SWU'), efaEvent('5', 64, 'SWU'), efaEvent('5', 124, 'SWU')] }))
    const { departures } = await board.board(1350, 20)
    expect(departures.map((departure) => departure.line)).toEqual(['5', '5', '5'])
    // The first is SWU's, with its live time; the later two are DING's timetable.
    expect(departures.map((departure) => departure.expected !== null)).toEqual([true, false, false])
  })

  it('shows the next bus of a stop where SWU lists nothing, as at night', async () => {
    const { board } = await setUp([], () => ({ stopEvents: [efaEvent('N1', 83, 'SWU'), efaEvent('70', 90)] }))
    expect((await board.board(1350, 20)).departures.map((departure) => departure.line)).toEqual(['N1', '70'])
  })

  it("takes SWU's word within its own time: a trip only DING lists there is left out", async () => {
    const { board } = await setUp([swuEntry('5', 4), swuEntry('7', 30)], () => ({ stopEvents: [efaEvent('5', 4, 'SWU'), efaEvent('9', 20, 'SWU'), efaEvent('7', 30, 'SWU'), efaEvent('5', 64, 'SWU')] }))
    expect((await board.board(1350, 20)).departures.map((departure) => departure.line)).toEqual(['5', '7', '5'])
  })

  it('asks DING once for boards of the same stop shown together', async () => {
    const { board, asked } = await setUp([swuEntry('5', 4)], () => ({ stopEvents: [] }))
    await Promise.all([board.board(1350, 20), board.board(1350, 10)])
    await board.board(1350, 20)
    expect(asked.filter((request) => request === 'XML_DM_REQUEST')).toHaveLength(1)
  })

  it("finds a departure's run at DING, asking once for several rows of a board", async () => {
    const { board, asked } = await setUp([], () => fixture('efa-departures-runs'))
    const first = await board.run(1350, { line: '4', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:B' })
    const second = await board.run(1350, { line: '1', planned: '2026-11-15T20:30:00.000Z', platformId: 'de:08421:1350:1:D' })
    expect(first?.stops.map((stop) => stop.name)).toEqual(['Ehinger Tor', 'Steinerne Brücke', 'Rathaus', 'Hafengasse', 'Egertweg'])
    expect(second?.stops.at(-1)?.name).toBe('Söflingen')
    expect(asked.filter((request) => request === 'XML_DM_REQUEST')).toHaveLength(1)
  })

  it("names the stops of a run as SWU does where SWU knows them, and gives only what the contract has", async () => {
    const { board } = await setUp([], () => fixture('efa-departures-runs'))
    const run = await board.run(1350, { line: '4', planned: '2026-11-15T20:27:00.000Z', platformId: 'de:08421:1350:1:B' })
    expect(run?.stops[2]).toEqual({ name: 'Rathaus', platform: expect.any(String), planned: expect.any(String), expected: expect.any(String) })
  })

  it('knows no run for a departure DING does not list, and none at a stop it cannot place at DING', async () => {
    const { board } = await setUp([], () => fixture('efa-departures-runs'))
    await expect(board.run(1350, { line: '4', planned: '2026-11-15T23:59:00.000Z', platformId: null })).resolves.toBeUndefined()
    await expect(board.run(1008, { line: '4', planned: '2026-11-15T20:27:00.000Z', platformId: null })).rejects.toBeInstanceOf(UnknownStop)
  })

  it('shows SWU lines only for a stop it cannot place at DING', async () => {
    const { board, asked } = await setUp([swuEntry('5', 4)], () => ({ stopEvents: [efaEvent('70', 8)] }))
    expect((await board.board(1008, 20)).departures.map((departure) => departure.line)).toEqual(['5'])
    expect(asked).not.toContain('XML_DM_REQUEST')
  })
})
