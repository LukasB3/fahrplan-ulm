import { cached } from './cache.js'
import { efaDeparturesOfOthers } from './efa.js'
import { swuDepartures, swuStopIds } from './swu.js'
import type { Departure, Departures } from './types.js'
import type { GetJson } from './upstream.js'

const SWU_LIMIT = 40
const HOUR = 3_600_000

type Deps = { getJson: GetJson; efaBase: string; log: (problem: unknown) => void }

// The departure board of a stop: SWU's own lines from SWU, which knows the
// vehicle and the platform, and everything else (regional buses, trains) from DING.
export const departureBoard = ({ getJson, efaBase, log }: Deps) => {
  const swu = cached((stop) => swuDepartures(getJson, Number(stop), SWU_LIMIT), { freshMs: 10_000, staleMs: 120_000 })
  const efa = cached((dhid) => efaDeparturesOfOthers(getJson, efaBase, dhid), { freshMs: 30_000, staleMs: 120_000 })
  let dhids = new Map<number, string>()
  // Most stops have SWU lines only. DING is not asked again for hours once it has said so.
  const swuOnlyUntil = new Map<string, number>()

  return {
    // Loads which SWU stop is which stop at DING. Until it has, boards show SWU lines only.
    refreshStops: async () => {
      dhids = await swuStopIds(getJson)
    },

    board: async (stop: number, limit: number): Promise<Departures> => {
      const dhid = dhids.get(stop)
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
