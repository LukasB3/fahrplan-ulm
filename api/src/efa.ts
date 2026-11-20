import { z } from 'zod'
import { paragraphs, tidy } from './text.js'
import { berlinClock } from './time.js'
import type { Alert, Departure, Journey, Leg, Mode, Place, Stopover } from './types.js'
import type { GetJson } from './upstream.js'

// DING's journey planner (EFA). It is the public backend of ding.eu, not a
// documented open API: ask sparingly and expect it to change.
const COMMON = 'outputFormat=rapidJSON&coordOutputFormat=WGS84%5Bdd.ddddd%5D'

// EFA's product classes: 4 is tram, 5 city bus, 6 regional bus; trains are 0 and 13 to 16.
const TRAM_CLASS = 4
const TRAIN_CLASSES = [0, 1, 2, 13, 14, 15, 16]
const modeOf = (productClass: number): Mode => (productClass === TRAM_CLASS ? 'tram' : TRAIN_CLASSES.includes(productClass) ? 'train' : 'bus')

const stopEvent = z.object({
  departureTimePlanned: z.iso.datetime(),
  departureTimeEstimated: z.iso.datetime().nullish(),
  location: z.object({ id: z.string().nullish(), properties: z.object({ platformName: z.string().nullish(), platform: z.string().nullish() }).nullish() }),
  transportation: z.object({
    number: z.string().nullish(),
    name: z.string().nullish(),
    product: z.object({ class: z.number().int() }),
    destination: z.object({ name: z.string() }),
    operator: z.object({ name: z.string().nullish() }).nullish(),
  }),
})

const monitor = z.object({ stopEvents: z.array(z.unknown()).optional() })

// Regional trains carry their name in `number` ("RE 5", "RS7"); long-distance
// trains only a bare number there and the name in front of it ("ICE 515 InterCityExpress").
const lineOf = (number: string, name: string, mode: Mode) => (mode === 'train' && /^\d+$/.test(number) ? name.split(' ').slice(0, 2).join(' ') : number.replace(/\s+/g, ''))

// The departures of a stop over the next 24 hours, SWU's own lines apart from everything else.
export type EfaBoard = { swu: Departure[]; others: Departure[] }

export const efaDepartures = async (getJson: GetJson, base: string, dhid: string): Promise<EfaBoard> => {
  const url = `${base}/XML_DM_REQUEST?${COMMON}&type_dm=any&name_dm=${encodeURIComponent(dhid)}&mode=direct&useRealtime=1&depType=stopEvents&limit=40`
  const { stopEvents = [] } = monitor.parse(await getJson(url))
  const board: EfaBoard = { swu: [], others: [] }
  for (const item of stopEvents) {
    const parsed = stopEvent.safeParse(item)
    if (!parsed.success) continue
    const { transportation, location, departureTimePlanned, departureTimeEstimated } = parsed.data
    const mode = modeOf(transportation.product.class)
    const line = lineOf(transportation.number ?? '', transportation.name ?? '', mode)
    if (!line) continue
    board[transportation.operator?.name === 'SWU' ? 'swu' : 'others'].push({
      line,
      mode,
      destination: transportation.destination.name,
      platform: (location.properties?.platformName ?? location.properties?.platform)?.replace(/^Bstg\.\s*/, '') ?? null,
      planned: departureTimePlanned,
      expected: departureTimeEstimated ?? null,
      vehicle: null,
      platformId: location.id ?? null,
    })
  }
  return board
}

// --- Places ---------------------------------------------------------------

// The planner knows all of Germany. Only places around Ulm are wanted.
const AREA = { south: 48.15, north: 48.65, west: 9.6, east: 10.4 }
const PLACE_KINDS: Record<string, Place['kind']> = { stop: 'stop', singlehouse: 'address', street: 'address', address: 'address', poi: 'poi' }

const foundPlace = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  disassembledName: z.string().nullish(),
  coord: z.tuple([z.number(), z.number()]),
  matchQuality: z.number().nullish(),
  parent: z.object({ name: z.string().nullish() }).nullish(),
})

const placeAnswer = z.object({ locations: z.array(z.unknown()).optional() })

export type PlaceMatch = { place: Place; quality: number }

// Stops, addresses and points of interest matching what someone typed, best match first.
// `quality` is the planner's own score, up to 1000.
export const efaPlaces = async (getJson: GetJson, base: string, query: string, limit = 8): Promise<PlaceMatch[]> => {
  // Without a town the planner answers with matches from anywhere, Aachen first.
  const wanted = /ulm/i.test(query) ? query : `Ulm ${query}`
  const { locations = [] } = placeAnswer.parse(await getJson(`${base}/XML_STOPFINDER_REQUEST?${COMMON}&type_sf=any&name_sf=${encodeURIComponent(wanted)}`))
  return locations
    .flatMap((item) => {
      const parsed = foundPlace.safeParse(item)
      if (!parsed.success) return []
      const { id, type, name, disassembledName, coord, matchQuality, parent } = parsed.data
      const kind = PLACE_KINDS[type]
      const [lat, lon] = coord
      if (!kind || lat < AREA.south || lat > AREA.north || lon < AREA.west || lon > AREA.east) return []
      const place: Place = { kind, stop: kind === 'stop' ? id : null, name: disassembledName ?? name, town: parent?.name ?? null, lat, lon }
      return [{ place, quality: matchQuality ?? 0 }]
    })
    .sort((a, b) => b.quality - a.quality || Number(b.place.kind === 'stop') - Number(a.place.kind === 'stop'))
    .slice(0, limit)
}

// --- Journeys ---------------------------------------------------------------

// Product classes of legs that are no travel at all ("gesicherter Anschluss") and of walking.
const WALK_CLASSES = [99, 100]
const FIRST_PSEUDO_CLASS = 97

const time = z.iso.datetime().nullish()
const point = z.object({
  id: z.string().nullish(),
  type: z.string().nullish(),
  name: z.string().nullish(),
  disassembledName: z.string().nullish(),
  parent: z.object({ id: z.string().nullish(), name: z.string().nullish(), disassembledName: z.string().nullish(), parent: z.object({ name: z.string().nullish() }).nullish() }).nullish(),
  properties: z.object({ platformName: z.string().nullish(), platform: z.string().nullish() }).nullish(),
  departureTimePlanned: time,
  departureTimeEstimated: time,
  arrivalTimePlanned: time,
  arrivalTimeEstimated: time,
})

const efaLeg = z.object({
  origin: point,
  destination: point,
  transportation: z.object({ number: z.string().nullish(), name: z.string().nullish(), product: z.object({ class: z.number().int() }), destination: z.object({ name: z.string() }).nullish() }),
  distance: z.number().nullish(),
  coords: z.array(z.tuple([z.number(), z.number()])).nullish(),
  stopSequence: z.array(z.unknown()).nullish(),
})

const efaJourney = z.object({
  interchanges: z.number().int().nullish(),
  legs: z.array(efaLeg).min(1),
  fare: z.object({ tickets: z.array(z.object({ name: z.string().nullish(), person: z.string().nullish(), priceBrutto: z.number().nullish() })).nullish() }).nullish(),
})

const tripAnswer = z.object({ journeys: z.array(z.unknown()).optional() })

const HOME_TOWNS = ['Ulm']

// A platform is named after its stop, "Theater", with the town in front outside Ulm; an address after itself.
const nameOf = (where: z.infer<typeof point>) => {
  const stop = where.parent?.disassembledName ?? where.parent?.name
  if (where.type !== 'platform' && where.type !== 'stop') return where.disassembledName ?? where.name ?? ''
  const town = where.parent?.parent?.name
  const name = stop ?? where.name ?? ''
  // "Wendlingen (N)" lies in "Wendlingen (Neckar)": the town is in the name already.
  return town && !HOME_TOWNS.includes(town) && !name.startsWith(town.replace(/\s*\(.*$/, '')) ? `${town}, ${name}` : name
}

const stopover = (where: z.infer<typeof point>, planned: string, expected: string | null | undefined): Stopover => ({
  name: nameOf(where),
  platform: (where.properties?.platformName ?? where.properties?.platform)?.replace(/^Bstg\.\s*/, '') ?? null,
  planned,
  expected: expected ?? null,
})

// A stop a vehicle passes and when it is there: its arrival, or its departure
// where DING gives no arrival. Nothing for a stop without a time.
const passed = (item: unknown) => {
  const where = point.safeParse(item)
  const planned = where.data?.arrivalTimePlanned ?? where.data?.departureTimePlanned
  return where.success && planned ? { where: where.data, planned, expected: where.data.arrivalTimeEstimated ?? where.data.departureTimeEstimated } : undefined
}

const journeyOf = (item: unknown): Journey | undefined => {
  const parsed = efaJourney.safeParse(item)
  if (!parsed.success) return undefined
  const legs: Leg[] = []
  for (const leg of parsed.data.legs) {
    const productClass = leg.transportation.product.class
    const walking = WALK_CLASSES.includes(productClass)
    if (!walking && productClass >= FIRST_PSEUDO_CLASS) continue
    const leaves = leg.origin.departureTimePlanned
    const arrives = leg.destination.arrivalTimePlanned
    // A leg without its times cannot be shown; the journey is then not trustworthy either.
    if (!leaves || !arrives) return undefined
    const from = stopover(leg.origin, leaves, leg.origin.departureTimeEstimated)
    const to = stopover(leg.destination, arrives, leg.destination.arrivalTimeEstimated)
    if (walking) {
      legs.push({ kind: 'walk', from, to, metres: Math.round(leg.distance ?? 0), path: leg.coords ?? [] })
      continue
    }
    const mode = modeOf(productClass)
    const line = lineOf(leg.transportation.number ?? '', leg.transportation.name ?? '', mode)
    if (!line) return undefined
    // The sequence starts where the ride is boarded and ends where it is left.
    const calls = (leg.stopSequence ?? []).slice(1, -1).flatMap((stop) => {
      const call = passed(stop)
      return call ? [stopover(call.where, call.planned, call.expected)] : []
    })
    legs.push({ kind: 'ride', from, to, line, mode, destination: leg.transportation.destination?.name ?? '', stopsBetween: Math.max(0, (leg.stopSequence?.length ?? 2) - 2), calls })
  }
  if (!legs.length) return undefined
  const singles = (parsed.data.fare?.tickets ?? []).filter((ticket) => ticket.person === 'ADULT' && ticket.name?.startsWith('Einzelfahrschein') && typeof ticket.priceBrutto === 'number')
  return {
    legs,
    changes: parsed.data.interchanges ?? Math.max(0, legs.filter((leg) => leg.kind === 'ride').length - 1),
    fare: singles.length ? Math.min(...singles.map((ticket) => ticket.priceBrutto!)) : null,
  }
}

// A stop is asked for by its id, anything else by its position, longitude first.
const endpoint = (role: 'origin' | 'destination', place: Pick<Place, 'stop' | 'lat' | 'lon'>) =>
  place.stop ? `type_${role}=any&name_${role}=${encodeURIComponent(place.stop)}` : `type_${role}=coord&name_${role}=${encodeURIComponent(`${place.lon.toFixed(5)}:${place.lat.toFixed(5)}:WGS84[dd.ddddd]`)}`

export type TripQuery = { from: Pick<Place, 'stop' | 'lat' | 'lon'>; to: Pick<Place, 'stop' | 'lat' | 'lon'>; mode: 'depart' | 'arrive'; at: Date }

// Journeys as the planner returns them: more than asked for, in no useful order, some of them unusable.
export const efaJourneys = async (getJson: GetJson, base: string, { from, to, mode, at }: TripQuery): Promise<Journey[]> => {
  const clock = berlinClock(at)
  const url = `${base}/XML_TRIP_REQUEST2?${COMMON}&${endpoint('origin', from)}&${endpoint('destination', to)}&itdDate=${clock.date}&itdTime=${clock.time}&itdTripDateTimeDepArr=${mode === 'depart' ? 'dep' : 'arr'}&useRealtime=1&calcNumberOfTrips=4&calcOneDirection=1`
  const { journeys = [] } = tripAnswer.parse(await getJson(url))
  return journeys.flatMap((item) => journeyOf(item) ?? [])
}

// --- Runs -------------------------------------------------------------------

// A departure as DING lists it, with every stop it calls at afterwards. `dhid` is the stop's id at DING.
export type RunEvent = { platformId: string | null; line: string; planned: string; stops: (Stopover & { dhid: string | null })[] }

const call = (where: z.infer<typeof point>, planned: string, expected: string | null | undefined) => ({ ...stopover(where, planned, expected), dhid: (where.type === 'stop' ? where.id : where.parent?.id) ?? null })

const runEvent = z.object({
  departureTimePlanned: z.iso.datetime(),
  departureTimeEstimated: z.iso.datetime().nullish(),
  location: point,
  transportation: z.object({ number: z.string().nullish(), name: z.string().nullish(), product: z.object({ class: z.number().int() }) }),
  onwardLocations: z.array(z.unknown()).nullish(),
})

// The departures of a stop from a moment on, SWU's lines included, each with
// its further stops. The answer is large (about 500 KB for 30 departures), so
// it is asked for only when someone opens a departure.
export const efaRuns = async (getJson: GetJson, base: string, dhid: string, from: Date): Promise<RunEvent[]> => {
  const clock = berlinClock(from)
  const url = `${base}/XML_DM_REQUEST?${COMMON}&type_dm=any&name_dm=${encodeURIComponent(dhid)}&mode=direct&useRealtime=1&depType=stopEvents&limit=30&includeCompleteStopSeq=1&itdDate=${clock.date}&itdTime=${clock.time}`
  const { stopEvents = [] } = monitor.parse(await getJson(url))
  return stopEvents.flatMap((item): RunEvent[] => {
    const parsed = runEvent.safeParse(item)
    if (!parsed.success) return []
    const { transportation, location, departureTimePlanned, departureTimeEstimated, onwardLocations } = parsed.data
    const onward = (onwardLocations ?? []).flatMap((next): RunEvent['stops'] => {
      const stop = passed(next)
      return stop ? [call(stop.where, stop.planned, stop.expected)] : []
    })
    return [
      {
        platformId: location.id ?? null,
        line: lineOf(transportation.number ?? '', transportation.name ?? '', modeOf(transportation.product.class)),
        planned: departureTimePlanned,
        stops: [call(location, departureTimePlanned, departureTimeEstimated), ...onward],
      },
    ]
  })
}

// --- Alerts -------------------------------------------------------------------

const when = z.iso.datetime().nullish()
const efaAlert = z.object({
  id: z.string().min(1),
  timestamps: z.object({ creation: when, lastModification: when, validity: z.array(z.object({ from: when, to: when })).nullish() }).nullish(),
  affected: z.object({
    lines: z.array(z.object({ number: z.string().nullish(), operator: z.object({ name: z.string().nullish() }).nullish() })).nullish(),
    stops: z.array(z.object({ id: z.string() })).nullish(),
  }),
  infoLinks: z.array(z.object({ urlText: z.string().nullish(), subtitle: z.string().nullish(), content: z.string().nullish() })).min(1),
})

const alertAnswer = z.object({ infos: z.object({ current: z.array(z.unknown()).optional() }) })

// The notices that concern SWU's lines. The answer covers the whole state
// and every operator, so nearly all of it is dropped here.
export const efaAlerts = async (getJson: GetJson, base: string): Promise<Alert[]> => {
  const { infos } = alertAnswer.parse(await getJson(`${base}/XML_ADDINFO_REQUEST?${COMMON}&filterPublished=1`))
  return (infos.current ?? []).flatMap((item): Alert[] => {
    const parsed = efaAlert.safeParse(item)
    if (!parsed.success) return []
    const { id, timestamps, affected, infoLinks } = parsed.data
    // Lines in the order of the network map: numbers first, lettered lines next, night lines last.
    const rank = (line: string) => (line.startsWith('N') ? 2_000 : /^\d+$/.test(line) ? 0 : 1_000) + (Number(line.replace(/\D/g, '')) || 0)
    const lines = [...new Set((affected.lines ?? []).filter((line) => line.operator?.name === 'SWU' && line.number).map((line) => line.number!))].sort((a, b) => rank(a) - rank(b))
    const [notice] = infoLinks
    const title = tidy(notice!.urlText ?? notice!.subtitle ?? '')
    if (!lines.length || !title) return []
    const validity = timestamps?.validity?.[0]
    return [
      {
        id,
        title,
        text: paragraphs(notice!.content ?? ''),
        lines,
        stops: [...new Set((affected.stops ?? []).map((stop) => stop.id))],
        from: validity?.from ?? null,
        to: validity?.to ?? null,
        published: timestamps?.lastModification ?? timestamps?.creation ?? null,
      },
    ]
  })
}
