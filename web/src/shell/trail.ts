import { useSyncExternalStore } from 'react'

// How the page on screen was reached. The record is kept on the browser's
// history entry, so going back or forward finds every page as it was left:
// with the page it was opened from, and in the tab the walk started in.
export type Trail = {
  path: string
  // What a back link to this page says.
  label: string
  // The address the walk started at: a tab's main page, or the page someone landed on.
  root: string
  // The page this one was opened from. It is the history entry before this one.
  back: { path: string; label: string } | null
}

let shown: Trail | null = null
// Set while the browser moves through its history, until the page that arrives has been counted.
let byHistory = false
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  // In the capture phase: the router answers the same event, and React renders the page right after the router's listener.
  window.addEventListener('popstate', () => (byHistory = true), { capture: true })
  // A tap starts a new step. A move through history that brought no new page must not be taken for it.
  window.addEventListener('click', () => (byHistory = false), { capture: true })
}

const same = (a: Trail, b: Trail) => a.path === b.path && a.label === b.label && a.root === b.root && a.back?.path === b.back?.path && a.back?.label === b.back?.label

// Every page calls this once it is on screen. `root` marks a tab's main page.
export const visit = (page: { path: string; label: string; root: boolean }) => {
  const state = window.history.state as { trail?: Trail } | null
  const stored = state?.trail?.path === page.path ? state.trail : undefined
  const travelled = byHistory
  byHistory = false

  const next: Trail =
    // Back or forward onto an entry that knows its way. Not after a reload: the page the server sent shows a direct landing.
    shown && stored
      ? stored
      : // A walk starts on a tab's main page, and on any page not opened by a link from the one before.
        page.root || !shown || travelled
        ? { path: page.path, label: page.label, root: page.path, back: null }
        : { path: page.path, label: page.label, root: shown.root, back: { path: shown.path, label: shown.label } }

  // The router keeps this on back and forward. Its own writes drop it, and the entry then counts as a direct landing.
  if (next !== stored) window.history.replaceState({ ...state, trail: next }, '')
  if (shown && same(shown, next)) return
  shown = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

// Nothing while the page is rendered on the server and until the page has been counted.
export const useTrail = () =>
  useSyncExternalStore(
    subscribe,
    () => shown,
    () => null,
  )
