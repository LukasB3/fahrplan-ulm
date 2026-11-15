'use client'

import type { Place } from '@api/types'
import { useSyncExternalStore } from 'react'

// Things the app remembers live on the device, in the browser's storage.
// Each value is one entry there; every component showing it follows changes,
// also those made in another tab.
export const remembered = <T>(key: string, empty: T, tidy: (stored: unknown) => T) => {
  let cache: { raw: string | null; value: T } = { raw: null, value: empty }
  const listeners = new Set<() => void>()

  const read = (): T => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(key)
    } catch {
      // Storage can be switched off; the app then simply remembers nothing.
    }
    if (raw !== cache.raw) {
      let value = empty
      try {
        value = raw ? tidy(JSON.parse(raw)) : empty
      } catch {
        // Something else wrote there; start over.
      }
      cache = { raw, value }
    }
    return cache.value
  }

  const write = (next: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    window.addEventListener('storage', listener)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', listener)
    }
  }

  // For an entry something else writes: tells those showing it to look again.
  const touch = () => {
    for (const listener of listeners) listener()
  }

  // Empty while the page is rendered on the server and until the browser has taken over.
  return { read, write, touch, use: () => useSyncExternalStore(subscribe, read, () => empty) }
}

// Favourite stops, newest first. Besides the stop's code each carries its id
// at DING and its lines, which is what service alerts are matched by.
export type Favourite = { code: string; dhid: string | null; lines: string[] }

export const asFavourites = (stored: unknown) =>
  (Array.isArray(stored) ? stored : []).flatMap((entry: unknown): Favourite[] => {
    // The first version stored bare codes.
    if (typeof entry === 'string') return [{ code: entry, dhid: null, lines: [] }]
    const favourite = entry as Partial<Favourite> | null
    if (typeof favourite?.code !== 'string') return []
    return [{ code: favourite.code, dhid: typeof favourite.dhid === 'string' ? favourite.dhid : null, lines: Array.isArray(favourite.lines) ? favourite.lines.filter((line) => typeof line === 'string') : [] }]
  })

export const favourites = remembered<Favourite[]>('fahrplan-ulm:favourites', [], asFavourites)

export const useFavourites = favourites.use

export const toggleFavourite = (stop: Favourite) => {
  const current = favourites.read()
  const had = current.some((other) => other.code === stop.code)
  favourites.write(had ? current.filter((other) => other.code !== stop.code) : [stop, ...current])
  note(had ? { kind: 'unfavourite', code: stop.code, at: Date.now() } : { kind: 'favourite', stop, at: Date.now() })
}

// Alerts the person has had on screen, by id. Old ids fall off the end.
const SEEN = 300
const seenAlerts = remembered<string[]>('fahrplan-ulm:seen-alerts', [], (stored) => (Array.isArray(stored) ? stored.filter((id) => typeof id === 'string').slice(0, SEEN) : []))

export const useSeenAlerts = seenAlerts.use

export const markAlertsSeen = (ids: string[]) => {
  const seen = seenAlerts.read()
  const fresh = ids.filter((id) => !seen.includes(id))
  if (fresh.length) seenAlerts.write([...fresh, ...seen].slice(0, SEEN))
}

// Home, work and the places chosen last in the planner.
export type SavedPlaces = { home?: Place; work?: Place; recent: Place[] }
const RECENT = 5

export const isPlace = (value: unknown): value is Place => {
  const place = value as Partial<Place> | null
  return typeof place === 'object' && place !== null && typeof place.name === 'string' && typeof place.lat === 'number' && typeof place.lon === 'number' && typeof place.kind === 'string'
}

export const places = remembered<SavedPlaces>('fahrplan-ulm:places', { recent: [] }, (stored) => {
  const saved = (typeof stored === 'object' && stored !== null ? stored : {}) as Partial<Record<keyof SavedPlaces, unknown>>
  return { home: isPlace(saved.home) ? saved.home : undefined, work: isPlace(saved.work) ? saved.work : undefined, recent: Array.isArray(saved.recent) ? saved.recent.filter(isPlace).slice(0, RECENT) : [] }
})

export const useSavedPlaces = places.use

const samePlace = (a: Place, b: Place) => (a.stop && b.stop ? a.stop === b.stop : a.name === b.name && a.town === b.town)

export const savePlace = (as: 'home' | 'work', place: Place) => {
  places.write({ ...places.read(), [as]: place })
  note({ kind: 'place', as, place, at: Date.now() })
}

// A position is where someone was, not a place to come back to.
export const rememberPlace = (place: Place) => {
  if (place.kind === 'position') return
  const saved = places.read()
  places.write({ ...saved, recent: [place, ...saved.recent.filter((other) => !samePlace(other, place))].slice(0, RECENT) })
}

// With a login, favourites, home and work are the same on every device
// (features/account/sync.ts). `mirrored` names the account this device has
// been merged with. From then on each change made here is also kept in
// `unsent`, oldest first, until the account has it: that way a change made
// without a connection is not lost.
export type Change = { at: number } & ({ kind: 'favourite'; stop: Favourite } | { kind: 'unfavourite'; code: string } | { kind: 'place'; as: 'home' | 'work'; place: Place })
const UNSENT = 500

const isChange = (value: unknown): value is Change => {
  const change = value as { at?: unknown; kind?: unknown; stop?: { code?: unknown } | null; code?: unknown; as?: unknown; place?: unknown } | null
  if (typeof change !== 'object' || change === null || typeof change.at !== 'number') return false
  if (change.kind === 'favourite') return typeof change.stop?.code === 'string'
  if (change.kind === 'unfavourite') return typeof change.code === 'string'
  return change.kind === 'place' && (change.as === 'home' || change.as === 'work') && isPlace(change.place)
}

export const mirrored = remembered<string | null>('fahrplan-ulm:account', null, (stored) => (typeof stored === 'string' ? stored : null))
export const unsent = remembered<Change[]>('fahrplan-ulm:unsent', [], (stored) => (Array.isArray(stored) ? stored.filter(isChange) : []))

const note = (change: Change) => {
  if (mirrored.read()) unsent.write([...unsent.read(), change].slice(-UNSENT))
}
