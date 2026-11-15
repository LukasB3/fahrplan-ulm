import { cached } from './cache.js'
import { efaDeparturesOfOthers, efaRuns, type RunEvent } from './efa.js'
import type { StopDirectory } from './stops.js'
import { swuDepartures } from './swu.js'
import type { Departure, Departures, Run } from './types.js'
import { UnknownStop, type GetJson } from './upstream.js'

const SWU_LIMIT = 40
const HOUR = 3_600_000
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
export const departureBoard = ({ getJson, efaBase, stops, log }: Deps) => {
  const swu = cached((stop) => swuDepartures(getJson, Number(stop), SWU_LIMIT), { freshMs: 10_000, staleMs: 120_000 })
  const efa = cached((dhid) => efaDeparturesOfOthers(getJson, efaBase, dhid), { freshMs: 30_000, staleMs: 120_000 })
  const runs = cached((dhid) => efaRuns(getJson, efaBase, dhid, new Date(Date.now() + RUNS_FROM_MS)), { freshMs: 20_000, staleMs: 60_000, max: 100 })
  // Most stops have SWU lines only. DING is not asked again for hours once it has said so.
  const swuOnlyUntil = new Map<string, number>()

  return {
    board: async (stop: number, limit: number): Promise<Departures> => {
      // A stop the directory does not know yet is shown with SWU's lines only.
      const dhid = stops.dhidOf(stop)
      const askDing = dhid !== undefined && (swuOnlyUntil.get(dhid) ?? 0) < Date.now()
      const [own, others] = await Promise.all([
        swu(String(stop)),
        askDing
          ? efa(dhid).catch((problem: unknown) => {
              log(problem)
              return undefined
            })
          : undefined,
      ])
      if (dhid && others?.value.length === 0) swuOnlyUntil.set(dhid, Date.now() + 6 * HOUR)

      const now = Date.now()
      const leavesAt = (departure: Departure) => Date.parse(departure.expected ?? departure.planned)
      return {
        now: new Date(now).toISOString(),
        stale: own.stale,
        departures: [...own.value, ...(others?.value ?? [])]
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
