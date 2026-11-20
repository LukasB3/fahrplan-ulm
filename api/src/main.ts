import { alertBoard } from './alerts.js'
import { asker, askLimits, claudeReader } from './ask.js'
import { loadConfig } from './config.js'
import { departureBoard } from './departures.js'
import { buildServer } from './server.js'
import { stopDirectory } from './stops.js'
import { tripPlanner } from './trips.js'
import { getJson } from './upstream.js'
import { vehicleBoard } from './vehicles.js'

const cfg = loadConfig()
const stops = stopDirectory(getJson)
const departures = departureBoard({ getJson, efaBase: cfg.EFA_BASE, stops, log: (problem) => console.error('DING departures failed', problem) })
const planner = tripPlanner({ getJson, efaBase: cfg.EFA_BASE })

const read = cfg.ANTHROPIC_API_KEY && cfg.ASK === 'on' ? claudeReader({ apiKey: cfg.ANTHROPIC_API_KEY, model: cfg.ASK_MODEL, stopNames: stops.names }) : undefined
const ask = asker({
  read,
  stops,
  matches: planner.matches,
  limits: askLimits({ perVisitorPerDay: cfg.ASK_PER_VISITOR_PER_DAY, dailyBudgetUsd: cfg.ASK_DAILY_BUDGET_USD }),
  // The error's kind and status say enough; its message could quote the sentence.
  log: (problem) => console.error('reading a sentence failed:', problem instanceof Error ? `${problem.name} ${(problem as { status?: number }).status ?? ''}` : typeof problem),
})
const alerts = alertBoard({ getJson, efaBase: cfg.EFA_BASE })

// SWU renames stops and lines rarely; once a day is plenty. A failure keeps the last lists and is
// followed by another try a minute later: without the lists no vehicle has a line and no stop its id at DING.
const DAY_MS = 24 * 3_600_000
const refreshStops = async (): Promise<void> => {
  const loaded = await stops.refresh().then(
    () => true,
    (problem: unknown) => {
      console.error('loading the stop and line lists failed', problem)
      return false
    },
  )
  setTimeout(() => void refreshStops(), loaded ? DAY_MS : 60_000).unref()
}
// Loaded before the first request, so the first boards are complete and the first sentence knows
// the stops, and before the vehicles are asked for, which get their lines from these lists.
await refreshStops()

const vehicles = vehicleBoard({ getJson, stops, log: (problem) => console.error('SWU vehicles failed', problem), note: (line) => console.log(line) })
const app = await buildServer({ cfg, departures, planner, ask, alerts, vehicles })

await app.listen({ host: cfg.HOST, port: cfg.PORT })

// The first sentence after a start would wait for the model to prepare its
// answer format. One sentence now spares a visitor that wait.
if (read) void read('zum hauptbahnhof').catch(() => {})

process.on('SIGTERM', () => void app.close().then(() => process.exit(0)))
