import { cached } from './cache.js'
import { efaDepartures, efaRuns, type RunEvent } from './efa.js'
import type { StopDirectory } from './stops.js'
import { swuDepartures } from './swu.js'
import type { Departure, Departures, Run } from './types.js'
import { UnknownStop, type GetJson } from './upstream.js'

const SWU_LIMIT = 40
// A board keeps a departure for a minute after it left, and a late one is listed under its planned time.
const RUNS_FROM_MS = -3 * 60_000

// Which departure of a board is meant: the board's own line, planned time and platform.
export type RunQuery = Pick<Departure, 'line' | 'planned' | 'platformId'>

const minute = (time: string) => Math.floor(Date.parse(time) / 60_000)

// The same departure among DING's: planned in the same minute, at the same
// platform where DING knows it, then by line. SWU and DING write some lines
// differently, so a departure alone at its platform and minute is taken as it is.
export const pickRun = (events: RunEvent[], wanted: RunQuery): RunEvent | undefined => {
  const then = events.filter((event) => minute(event.planned) === minute(wanted.planned))
  const there = then.filter((event) => wanted.platformId !== null && event.platformId === wanted.platformId)
  const candidates = there.length ? there : then
  return candidates.find((event) => event.line === wanted.line) ?? (candidates.length === 1 ? candidates[0] : undefined)
}

type Deps = { getJson: GetJson; efaBase: string; stops: Pick<StopDirectory, 'dhidOf' | 'nameAt'>; log: (problem: unknown) => void }

// The departure board of a stop: SWU's own lines from SWU, which knows the
// vehicle and the platform, and everything else (regional buses, trains) from DING.
// SWU lists its lines only about 45 minutes ahead, so a quiet stop, at night
// for one, would show nothing although a bus comes later. After the last
// departure SWU lists, SWU's lines are therefore taken from DING, which looks
// 24 hours ahead. Within SWU's time both list the same departures.
export const departureBoard = ({ getJson, efaBase, stops, log }: Deps) => {
  const swu = cached((stop) => swuDepartures(getJson, Number(stop), SWU_LIMIT), { freshMs: 10_000, staleMs: 120_000 })
  const efa = cached((dhid) => efaDepartures(getJson, efaBase, dhid), { freshMs: 30_000, staleMs: 120_000 })
  const runs = cached((dhid) => efaRuns(getJson, efaBase, dhid, new Date(Date.now() + RUNS_FROM_MS)), { freshMs: 20_000, staleMs: 60_000, max: 100 })

  return {
    board: async (stop: number, limit: number): Promise<Departures> => {
      // A stop the directory does not know yet is shown with SWU's lines only.
      const dhid = stops.dhidOf(stop)
      const [own, ding] = await Promise.all([
        swu(String(stop)),
        dhid === undefined
          ? undefined
          : efa(dhid).catch((problem: unknown) => {
              log(problem)
              return undefined
            }),
      ])
      // A trip has the same planned minute in both; what SWU lists up to its last minute is SWU's word.
      const swuUntil = Math.max(...own.value.map((departure) => minute(departure.planned)))
      const later = (ding?.value.swu ?? []).filter((departure) => minute(departure.planned) > swuUntil)

      const now = Date.now()
      const leavesAt = (departure: Departure) => Date.parse(departure.expected ?? departure.planned)
      return {
        now: new Date(now).toISOString(),
        stale: own.stale,
        departures: [...own.value, ...later, ...(ding?.value.others ?? [])]
          .filter((departure) => leavesAt(departure) > now - 60_000)
          .sort((a, b) => leavesAt(a) - leavesAt(b))
          .slice(0, limit),
      }
    },

    // The stops a departure of this board calls at from here on; nothing when DING does not list the departure.
    run: async (stop: number, wanted: RunQuery): Promise<Run | undefined> => {
      const dhid = stops.dhidOf(stop)
      if (dhid === undefined) throw new UnknownStop(`no stop ${stop} at DING`)
      const event = pickRun((await runs(dhid)).value, wanted)
      // A stop of SWU's network is called what it is called everywhere else on the site.
      return event && { stops: event.stops.map(({ dhid: at, ...stop }) => ({ ...stop, name: (at && stops.nameAt(at)) ?? stop.name })) }
    },
  }
}

export type DepartureBoard = ReturnType<typeof departureBoard>
