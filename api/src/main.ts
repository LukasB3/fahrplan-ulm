import { loadConfig } from './config.js'
import { departureBoard } from './departures.js'
import { buildServer } from './server.js'
import { getJson } from './upstream.js'

const cfg = loadConfig()
const departures = departureBoard({ getJson, efaBase: cfg.EFA_BASE, log: (problem) => console.error('DING departures failed', problem) })
const app = await buildServer({ cfg, departures })

// SWU renumbers stops rarely; once a day is plenty. A failure keeps the last list.
const refreshStops = () => departures.refreshStops().catch((problem: unknown) => console.error('loading the stop list failed', problem))
// Loaded before the first request, so the first boards are complete too.
await refreshStops()
setInterval(() => void refreshStops(), 24 * 3_600_000).unref()

await app.listen({ host: cfg.HOST, port: cfg.PORT })

process.on('SIGTERM', () => void app.close().then(() => process.exit(0)))
