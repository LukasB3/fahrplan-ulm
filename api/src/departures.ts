import { cached } from './cache.js'
import { efaDeparturesOfOthers } from './efa.js'
import type { StopDirectory } from './stops.js'
import { swuDepartures } from './swu.js'
import type { Departure, Departures } from './types.js'
import type { GetJson } from './upstream.js'

const SWU_LIMIT = 40
const HOUR = 3_600_000

type Deps = { getJson: GetJson; efaBase: string; stops: Pick<StopDirectory, 'dhidOf'>; log: (problem: unknown) => void }

// The departure board of a stop: SWU's own lines from SWU, which knows the
// vehicle and the platform, and everything else (regional buses, trains) from DING.
export const departureBoard = ({ getJson, efaBase, stops, log }: Deps) => {
  const swu = cached((stop) => swuDepartures(getJson, Number(stop), SWU_LIMIT), { freshMs: 10_000, staleMs: 120_000 })
  const efa = cached((dhid) => efaDeparturesOfOthers(getJson, efaBase, dhid), { freshMs: 30_000, staleMs: 120_000 })
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
  }
}

export type DepartureBoard = ReturnType<typeof departureBoard>
