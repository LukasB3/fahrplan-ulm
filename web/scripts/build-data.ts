// Builds the snapshot the pages are made from: stops, lines and timetables.
// Sources: SWU's timetable feed (GTFS, CC0), SWU's stop list (for the stop
// numbers the live departures are asked for) and one lookup at DING per new
// stop (for its municipality).
//
//   npm run data             writes web/data
//   npm run data -- --check  fails if web/data is out of date or the timetable is about to expire

import { strFromU8, unzipSync } from 'fflate'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DayType, Grid, Line, LineKind, Meta, Stop, TimetableTable } from '../src/lib/data-types'

const GTFS_URL = 'https://gtfs.swu.de/daten/SWU.zip'
const SWU_STOPS_URL = 'https://api.swu.de/mobility/v1/stop/attributes/BaseData'
const EFA_BASE = 'https://www.ding.eu/ding3'
const USER_AGENT = 'fahrplan-ulm.de data build (+https://fahrplan-ulm.de)'
// A destination gets its own entry when at least this share of the trips goes there.
const REGULAR_SHARE = 0.15
const EXPIRY_WARNING_DAYS = 14

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const check = process.argv.includes('--check')

type Row = Record<string, string>

const parseCsv = (text: string): Row[] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char !== '"') field += char
      else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else quoted = false
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field || row.length) rows.push([...row, field])
  const [header = [], ...body] = rows
  return body.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])))
}

const get = async (url: string) => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res
}

const count = <T>(items: Iterable<T>) => {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// "de:08421:1008:1:2" is a platform; its first three parts are the stop at DING.
const dhidOf = (platformId: string) => /^(de:\d+:\d+)(?::|$)/.exec(platformId)?.[1]

const lineKind = (route: Row): LineKind => (route.route_type === '0' ? 'tram' : route.route_short_name!.startsWith('N') ? 'night' : 'bus')
const KIND_ORDER: LineKind[] = ['tram', 'bus', 'night']
// Trams first, then buses by number with lettered lines after them, then night lines.
const lineRank = (line: Pick<Line, 'id' | 'kind'>) => KIND_ORDER.indexOf(line.kind) * 10_000 + (Number(line.id.replace(/\D/g, '')) || 9_000)

const DAY_OF_SERVICE: Record<string, DayType> = { 'Mo-Th': 'moth', Fr: 'fr', Sa: 'sa', Su: 'su' }
const dayOf = (serviceId: string): DayType => {
  const day = DAY_OF_SERVICE[/(Mo-Th|Fr|Sa|Su)$/.exec(serviceId)?.[1] ?? '']
  if (!day) throw new Error(`Unknown service "${serviceId}": the feed's day types changed`)
  return day
}

const isoDate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`

const townOf = async (dhid: string): Promise<string> => {
  const url = `${EFA_BASE}/XML_STOPFINDER_REQUEST?outputFormat=rapidJSON&type_sf=any&name_sf=${encodeURIComponent(dhid)}`
  const answer = (await (await get(url)).json()) as { locations?: { id: string; parent?: { name?: string } }[] }
  const town = answer.locations?.find((location) => location.id === dhid)?.parent?.name
  if (!town) throw new Error(`DING does not know the municipality of ${dhid}`)
  return town
}

const build = async () => {
  const files = unzipSync(new Uint8Array(await (await get(GTFS_URL)).arrayBuffer()))
  const table = (name: string) => {
    const file = files[name]
    if (!file) throw new Error(`The feed has no ${name}`)
    return parseCsv(strFromU8(file))
  }
  const feed = table('feed_info.txt')[0]!
  const meta: Meta = { feedVersion: feed.feed_version!, validFrom: isoDate(feed.feed_start_date!), validUntil: isoDate(feed.feed_end_date!) }

  const routes = new Map(table('routes.txt').map((route) => [route.route_id!, route]))
  const trips = new Map(table('trips.txt').map((trip) => [trip.trip_id!, trip]))
  const gtfsStops = table('stops.txt')
  const stations = gtfsStops.filter((stop) => stop.location_type === '1')
  const stationOf = new Map(gtfsStops.filter((stop) => stop.location_type !== '1').map((platform) => [platform.stop_id!, platform.parent_station!]))

  // Every trip as its calls in running order.
  const calls = new Map<string, { station: string; platform: string; hour: number; minute: number; sequence: number }[]>()
  for (const time of table('stop_times.txt')) {
    const station = stationOf.get(time.stop_id!)
    if (!station) throw new Error(`Platform ${time.stop_id} belongs to no stop`)
    const [hour, minute] = time.departure_time!.split(':').map(Number) as [number, number]
    const trip = calls.get(time.trip_id!) ?? []
    trip.push({ station, platform: time.stop_id!, hour, minute, sequence: Number(time.stop_sequence) })
    calls.set(time.trip_id!, trip)
  }
  for (const trip of calls.values()) trip.sort((a, b) => a.sequence - b.sequence)

  const lineId = (trip: Row) => routes.get(trip.route_id!)!.route_short_name!

  // Lines, with the usual run to each regular destination.
  const lines: Line[] = [...routes.values()]
    .map((route) => {
      const own = [...trips.values()].filter((trip) => trip.route_id === route.route_id)
      const directions = ['0', '1'].flatMap((direction) => {
        const oneWay = own.filter((trip) => trip.direction_id === direction)
        return count(oneWay.map((trip) => trip.trip_headsign!))
          .filter(([, trips]) => trips >= oneWay.length * REGULAR_SHARE)
          .map(([headsign]) => {
            const runs = oneWay.filter((trip) => trip.trip_headsign === headsign).map((trip) => (calls.get(trip.trip_id!) ?? []).map((call) => call.station).join(' '))
            return { headsign, stops: count(runs)[0]![0].split(' ') }
          })
      })
      return {
        id: route.route_short_name!,
        kind: lineKind(route),
        color: `#${route.route_color!.toLowerCase()}`,
        textColor: `#${route.route_text_color!.toLowerCase()}`,
        name: route.route_long_name!.replace(/\s+[-–]\s+/g, ' – '),
        directions,
      }
    })
    .sort((a, b) => lineRank(a) - lineRank(b))
  const rankOfLine = new Map(lines.map((line, index) => [line.id, index]))

  // Departures per stop, line, direction and day type. A call is a departure
  // only if the trip still goes to another stop afterwards: the calls at the
  // final stop, which can be several platforms, are arrivals.
  type Departures = { headsigns: string[]; days: Map<DayType, Map<number, Set<number>>> }
  const departures = new Map<string, Map<string, Departures>>()
  const weight = new Map<string, number>()
  for (const [tripId, tripCalls] of calls) {
    const trip = trips.get(tripId)!
    const day = dayOf(trip.service_id!)
    const key = `${lineId(trip)} ${trip.direction_id}`
    const finalStop = tripCalls.at(-1)!.station
    const lastDeparture = tripCalls.findLastIndex((call) => call.station !== finalStop)
    for (const call of tripCalls.slice(0, lastDeparture + 1)) {
      const ofStop = departures.get(call.station) ?? new Map<string, Departures>()
      departures.set(call.station, ofStop)
      const entry: Departures = ofStop.get(key) ?? { headsigns: [], days: new Map() }
      ofStop.set(key, entry)
      entry.headsigns.push(trip.trip_headsign!)
      const hours = entry.days.get(day) ?? new Map<number, Set<number>>()
      entry.days.set(day, hours)
      hours.set(call.hour, (hours.get(call.hour) ?? new Set()).add(call.minute))
      weight.set(call.station, (weight.get(call.station) ?? 0) + (day === 'moth' ? 4 : 1))
    }
  }

  const timetables = new Map<string, TimetableTable[]>()
  for (const [station, ofStop] of departures) {
    const tables = [...ofStop].map(([key, entry]): TimetableTable => {
      const grid = (day: DayType): Grid | undefined => {
        const hours = entry.days.get(day)
        return hours && [...hours].sort((a, b) => a[0] - b[0]).map(([hour, minutes]) => [hour, [...minutes].sort((a, b) => a - b)])
      }
      const [moth, fr, sa, su] = [grid('moth'), grid('fr'), grid('sa'), grid('su')]
      const sameAllWeek = JSON.stringify(moth) === JSON.stringify(fr)
      const days = sameAllWeek ? { mofr: moth, sa, su } : { moth, fr, sa, su }
      const headsigns = count(entry.headsigns)
      return {
        line: key.split(' ')[0]!,
        headsign: headsigns
          .filter(([, trips]) => trips >= entry.headsigns.length * REGULAR_SHARE)
          .map(([headsign]) => headsign)
          .join(' / '),
        // JSON drops the day types this stop has no service on.
        days: JSON.parse(JSON.stringify(days)) as TimetableTable['days'],
      }
    })
    tables.sort((a, b) => rankOfLine.get(a.line)! - rankOfLine.get(b.line)! || a.headsign.localeCompare(b.headsign, 'de'))
    timetables.set(station, tables)
  }

  // Stops: numbers from SWU, municipality from DING, slugs kept once given.
  const swu = (await (await get(SWU_STOPS_URL)).json()) as { StopAttributes: { StopData: { StopNumber: number; StopCode: string }[] } }
  const numberOf = new Map(swu.StopAttributes.StopData.map((stop) => [stop.StopCode, stop.StopNumber]))
  const stopsFile = join(dataDir, 'stops.json')
  const previous = new Map((existsSync(stopsFile) ? (JSON.parse(readFileSync(stopsFile, 'utf8')) as Stop[]) : []).map((stop) => [stop.code, stop]))
  const taken = new Set([...previous.values()].map((stop) => stop.slug))

  const stops: Stop[] = []
  for (const station of stations.filter((station) => departures.has(station.stop_id!)).sort((a, b) => a.stop_name!.localeCompare(b.stop_name!, 'de'))) {
    const code = station.stop_id!
    if (!/^[A-Z0-9]+$/.test(code)) throw new Error(`Stop code "${code}" cannot name a file`)
    const id = numberOf.get(code)
    if (id === undefined) throw new Error(`SWU's stop list has no stop ${code} (${station.stop_name})`)
    const dhids = count(
      [...stationOf]
        .filter(([, parent]) => parent === code)
        .map(([platform]) => dhidOf(platform))
        .filter((dhid) => dhid !== undefined),
    )
    if (dhids.length !== 1) throw new Error(`Stop ${code} has ${dhids.length} ids at DING`)
    const dhid = dhids[0]![0]
    const before = previous.get(code)
    const town = before?.dhid === dhid ? before.town : await townOf(dhid)
    let slug = before?.slug
    if (!slug) {
      slug = [slugify(station.stop_name!), `${slugify(station.stop_name!)}-${slugify(town)}`, `${slugify(station.stop_name!)}-${code.toLowerCase()}`].find((candidate) => !taken.has(candidate))!
      taken.add(slug)
    }
    stops.push({
      id,
      code,
      slug,
      name: station.stop_name!,
      town,
      dhid,
      lat: Number(Number(station.stop_lat).toFixed(6)),
      lon: Number(Number(station.stop_lon).toFixed(6)),
      lines: [...new Set(timetables.get(code)!.map((table) => table.line))],
      weight: weight.get(code)!,
    })
  }

  const perLine = (items: unknown[]) => `[\n${items.map((item) => `  ${JSON.stringify(item)}`).join(',\n')}\n]\n`
  const output = new Map<string, string>([
    ['meta.json', `${JSON.stringify(meta, null, 2)}\n`],
    ['stops.json', perLine(stops)],
    ['lines.json', perLine(lines)],
    ...stops.map((stop): [string, string] => [`timetable/${stop.code}.json`, perLine(timetables.get(stop.code)!)]),
  ])
  return { meta, output, stops: stops.length, lines: lines.length }
}

const { meta, output, stops, lines } = await build()
const onDisk = existsSync(join(dataDir, 'timetable')) ? ['meta.json', 'stops.json', 'lines.json', ...readdirSync(join(dataDir, 'timetable')).map((name) => `timetable/${name}`)] : []
const stale = onDisk.filter((name) => !output.has(name))
const changed = [...output].filter(([name, content]) => !existsSync(join(dataDir, name)) || readFileSync(join(dataDir, name), 'utf8') !== content).map(([name]) => name)
const daysLeft = Math.floor((Date.parse(meta.validUntil) - Date.now()) / 86_400_000)

if (check) {
  const problems = [
    ...(changed.length + stale.length ? [`${changed.length} files differ from the sources and ${stale.length} are left over (${[...changed, ...stale].slice(0, 8).join(', ')}). Run "npm run data" and commit.`] : []),
    ...(daysLeft < EXPIRY_WARNING_DAYS ? [`The timetable is valid until ${meta.validUntil}, ${daysLeft} days from now. SWU has not published the next one yet.`] : []),
  ]
  for (const problem of problems) console.error(problem)
  if (problems.length) process.exit(1)
  console.log(`web/data is current: ${stops} stops, ${lines} lines, timetable ${meta.feedVersion} valid until ${meta.validUntil}.`)
} else {
  mkdirSync(join(dataDir, 'timetable'), { recursive: true })
  for (const name of stale) rmSync(join(dataDir, name))
  for (const [name, content] of output) writeFileSync(join(dataDir, name), content)
  console.log(`Wrote ${stops} stops, ${lines} lines (${changed.length} files changed, ${stale.length} removed). Timetable ${meta.feedVersion}, valid until ${meta.validUntil}.`)
}
