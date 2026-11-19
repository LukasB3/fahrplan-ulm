import { cached } from './cache.js'
import { efaJourneys, efaPlaces, type TripQuery } from './efa.js'
import type { Journey, Place, TripRequest, Trips } from './types.js'
import type { GetJson } from './upstream.js'

const MINUTE = 60_000
const SHOWN = 5

export const leavesAt = (journey: Journey) => Date.parse(journey.legs[0]!.from.expected ?? journey.legs[0]!.from.planned)
export const arrivesAt = (journey: Journey) => Date.parse(journey.legs.at(-1)!.to.expected ?? journey.legs.at(-1)!.to.planned)

// The planner returns the same journey more than once, and journeys that no
// one would take: leaving earlier and arriving later than another one with no
// fewer changes.
const worthShowing = (journeys: Journey[]) => {
  const seen = new Set<string>()
  const unique = journeys.filter((journey) => {
    const key = `${leavesAt(journey)} ${arrivesAt(journey)} ${journey.legs.map((leg) => (leg.kind === 'ride' ? leg.line : 'walk')).join('>')}`
    return !seen.has(key) && seen.add(key)
  })
  const beats = (a: Journey, b: Journey) =>
    leavesAt(a) >= leavesAt(b) && arrivesAt(a) <= arrivesAt(b) && a.changes <= b.changes && (leavesAt(a) > leavesAt(b) || arrivesAt(a) < arrivesAt(b) || a.changes < b.changes)
  return unique.filter((journey) => !unique.some((other) => beats(other, journey)))
}

// Walking all the way is the answer only when it gets there first. Otherwise
// it goes to the end of the list: someone asking a timetable wants a ride.
const walkLast = (ordered: Journey[]) => {
  const onFoot = (journey: Journey) => journey.legs.every((leg) => leg.kind === 'walk')
  const rides = ordered.filter((journey) => !onFoot(journey))
  const walks = ordered.filter(onFoot)
  const firstRideIn = Math.min(...rides.map(arrivesAt))
  return [...walks.filter((walk) => arrivesAt(walk) < firstRideIn), ...rides, ...walks.filter((walk) => arrivesAt(walk) >= firstRideIn)]
}

const reference = ({ stop, lat, lon }: Place) => ({ stop, lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) })

type Deps = { getJson: GetJson; efaBase: string }

export const tripPlanner = ({ getJson, efaBase }: Deps) => {
  const journeys = cached(
    (key) => {
      const query = JSON.parse(key) as Omit<TripQuery, 'at'> & { at: number }
      return efaJourneys(getJson, efaBase, { ...query, at: new Date(query.at) })
    },
    { freshMs: 20_000, staleMs: MINUTE, max: 500 },
  )
  // Requests within the same minute for the same journey share one answer.
  const ask = (request: TripRequest, mode: TripQuery['mode'], at: number) =>
    journeys(JSON.stringify({ from: reference(request.from), to: reference(request.to), mode, at: Math.floor(at / MINUTE) * MINUTE })).then((answer) => worthShowing(answer.value))

  const places = cached((query) => efaPlaces(getJson, efaBase, query), { freshMs: 24 * 60 * MINUTE, staleMs: 7 * 24 * 60 * MINUTE })

  return {
    matches: async (query: string) => (await places(query.trim().toLowerCase().replace(/\s+/g, ' '))).value,

    trips: async (request: TripRequest, now = Date.now()): Promise<Trips> => {
      const at = request.time.at ? Date.parse(request.time.at) : now
      // What has left is of no use, unless it was asked for: the journeys before the ones on screen.
      const upcoming = (found: Journey[]) => (request.past ? found : found.filter((journey) => leavesAt(journey) >= now - MINUTE))
      const leaving = (found: Journey[], from: number) =>
        walkLast(
          upcoming(found)
            .filter((journey) => leavesAt(journey) >= from - MINUTE)
            .sort((a, b) => leavesAt(a) - leavesAt(b) || arrivesAt(a) - arrivesAt(b)),
        ).slice(0, SHOWN)

      if (request.time.mode === 'depart') return { now: new Date(now).toISOString(), journeys: leaving(await ask(request, 'depart', at), at), note: 'ok' }

      // Arriving by a time: the journey to leave latest comes first.
      const inTime = walkLast(
        upcoming(await ask(request, 'arrive', at))
          .filter((journey) => arrivesAt(journey) <= at + MINUTE)
          .sort((a, b) => leavesAt(b) - leavesAt(a) || arrivesAt(a) - arrivesAt(b)),
      ).slice(0, SHOWN)
      if (inTime.length) return { now: new Date(now).toISOString(), journeys: inTime, note: 'ok' }
      // Nothing gets there in time any more: show what leaves next and say so.
      return { now: new Date(now).toISOString(), journeys: leaving(await ask(request, 'depart', now), now), note: 'too_late' }
    },
  }
}

export type TripPlanner = ReturnType<typeof tripPlanner>
