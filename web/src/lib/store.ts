'use client'

import { useSyncExternalStore } from 'react'

// Favourite stops live on the device, as a list of stop codes, newest first.
const KEY = 'fahrplan-ulm:favourites'
const NONE: string[] = []

let cache: { raw: string | null; value: string[] } = { raw: null, value: NONE }
const listeners = new Set<() => void>()

const read = (): string[] => {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // Storage can be switched off; the app then simply has no favourites.
  }
  if (raw !== cache.raw) {
    let value: unknown
    try {
      value = raw ? JSON.parse(raw) : NONE
    } catch {
      value = NONE
    }
    cache = { raw, value: Array.isArray(value) ? value.filter((code) => typeof code === 'string') : NONE }
  }
  return cache.value
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  // Another tab changed the favourites.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export const toggleFavourite = (code: string) => {
  const current = read()
  const next = current.includes(code) ? current.filter((other) => other !== code) : [code, ...current]
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  }
  for (const listener of listeners) listener()
}

// Empty while the page is rendered on the server and until the browser has taken over.
export const useFavourites = () => useSyncExternalStore(subscribe, read, () => NONE)
