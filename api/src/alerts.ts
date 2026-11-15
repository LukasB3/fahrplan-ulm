import { cached } from './cache.js'
import { efaAlerts } from './efa.js'
import type { Alerts } from './types.js'
import type { GetJson } from './upstream.js'

const MINUTE = 60_000

// Current notices for SWU's lines. DING's answer is large and changes
// rarely: it is asked for at most every five minutes, and when DING fails
// the last answer serves for six hours.
export const alertBoard = ({ getJson, efaBase }: { getJson: GetJson; efaBase: string }) => {
  const notices = cached(() => efaAlerts(getJson, efaBase), { freshMs: 5 * MINUTE, staleMs: 6 * 60 * MINUTE, max: 1 })
  return async (now = Date.now()): Promise<Alerts> => {
    const { value } = await notices('all', now)
    const started = (from: string | null) => from === null || Date.parse(from) <= now
    return {
      now: new Date(now).toISOString(),
      alerts: value
        // What is over is not shown.
        .filter((alert) => alert.to === null || Date.parse(alert.to) > now)
        // What applies now comes first, then what is to come; in each, the newest notice first.
        .sort((a, b) => Number(started(b.from)) - Number(started(a.from)) || Date.parse(b.published ?? '1970-01-01') - Date.parse(a.published ?? '1970-01-01')),
    }
  }
}

export type AlertBoard = ReturnType<typeof alertBoard>
