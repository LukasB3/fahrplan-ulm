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
const vehicles = vehicleBoard({ getJson, stops })
const app = await buildServer({ cfg, departures, planner, ask, alerts, vehicles })

// SWU renames stops and lines rarely; once a day is plenty. A failure keeps the last lists.
const refreshStops = () => stops.refresh().catch((problem: unknown) => console.error('loading the stop and line lists failed', problem))
// Loaded before the first request, so the first boards are complete and the first sentence knows the stops.
await refreshStops()
setInterval(() => void refreshStops(), 24 * 3_600_000).unref()

await app.listen({ host: cfg.HOST, port: cfg.PORT })

// A free Supabase project is paused after a week without requests, and
// logging in on the website would stop with it. One read an hour keeps it awake.
const keepAccountsAwake = () =>
  fetch(`${cfg.SUPABASE_URL}/rest/v1/heartbeat?select=id`, { headers: { apikey: cfg.SUPABASE_KEY }, signal: AbortSignal.timeout(8_000) })
    .then((res) => res.ok || console.error(`the accounts' heartbeat answered ${res.status}`))
    .catch((problem: unknown) => console.error("the accounts' heartbeat failed", problem))
void keepAccountsAwake()
setInterval(() => void keepAccountsAwake(), 3_600_000).unref()

// The first sentence after a start would wait for the model to prepare its
// answer format. One sentence now spares a visitor that wait.
if (read) void read('zum hauptbahnhof').catch(() => {})

process.on('SIGTERM', () => void app.close().then(() => process.exit(0)))
