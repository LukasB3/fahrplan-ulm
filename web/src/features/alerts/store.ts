'use client'

import type { Alert, Alerts } from '@api/types'
import { useEffect, useSyncExternalStore } from 'react'
import { getJson } from '@/lib/api'

// The current alerts, fetched once and shared by everything on the page that
// shows them: the list, the notices on stop and line pages, the tab's badge.
const REFRESH_MS = 5 * 60_000

let alerts: Alert[] | undefined
let fetchedAt = 0
let fetching = false
const listeners = new Set<() => void>()

const refresh = () => {
  if (fetching || Date.now() - fetchedAt < REFRESH_MS) return
  fetching = true
  getJson<Alerts>('/api/alerts')
    .then((answer) => {
      alerts = answer.alerts
      fetchedAt = Date.now()
      for (const listener of listeners) listener()
    })
    // Without an answer whatever is there stays: the page's own list, or nothing.
    .catch(() => {})
    .finally(() => {
      fetching = false
    })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// `wanted: false` spares the request where nothing would be shown anyway.
export const useAlerts = (wanted = true) => {
  const current = useSyncExternalStore(subscribe, () => alerts, () => undefined)
  useEffect(() => {
    if (wanted) refresh()
  }, [wanted])
  return current
}

// An alert that names stops concerns exactly those. One about a whole line
// concerns every stop the line serves.
export const concerns = (alert: Alert, stop: { dhid: string | null; lines: string[] }) => (alert.stops.length ? stop.dhid !== null && alert.stops.includes(stop.dhid) : alert.lines.some((line) => stop.lines.includes(line)))
