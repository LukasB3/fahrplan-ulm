import type { Alerts } from '@api/types'
import { API_ORIGIN } from './api'

// For pages that carry live content in their HTML: asked while the page is
// built, and again at most every ten minutes after that. If the API cannot be
// reached the page is built without, and the browser fetches for itself.
export const fetchAlerts = async (): Promise<Alerts> => {
  try {
    const res = await fetch(`${API_ORIGIN}/api/alerts`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8_000) })
    if (!res.ok) throw new Error(`alerts answered ${res.status}`)
    return (await res.json()) as Alerts
  } catch {
    return { now: new Date().toISOString(), alerts: [] }
  }
}
