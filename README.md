# fahrplan-ulm

Bus and tram timetables for Ulm and Neu-Ulm at [fahrplan-ulm.de](https://fahrplan-ulm.de): route planner, live departures, live map and service alerts, built for the phone.

Not an offer of SWU or DING. Data: SWU Verkehr (CC-0), DING.

## Layout

- `web/` — Next.js site, deployed to Vercel
- `api/` — Fastify service behind Caddy at `api.fahrplan-ulm.de`
- `infra/` — server setup and deploy scripts

## Development

```sh
cd api && npm ci && npm run dev    # http://localhost:8787
cd web && npm ci && npm run dev    # http://localhost:3000
```
