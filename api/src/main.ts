import { loadConfig } from './config.js'
import { buildServer } from './server.js'

const cfg = loadConfig()
const app = await buildServer({ cfg })

await app.listen({ host: cfg.HOST, port: cfg.PORT })

process.on('SIGTERM', () => void app.close().then(() => process.exit(0)))
