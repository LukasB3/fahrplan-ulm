'use client'

import type { Place, TripRequest } from '@api/types'
import { useSyncExternalStore } from 'react'

// What is chosen in the planner. It lives outside the page so it is still
// there after a visit to another tab.
export type PlannerState = { from: Place | null; to: Place | null; time: TripRequest['time'] }

const EMPTY: PlannerState = { from: null, to: null, time: { mode: 'depart', at: null } }

let state = EMPTY
const listeners = new Set<() => void>()

export const setPlanner = (change: Partial<PlannerState>) => {
  state = { ...state, ...change }
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const usePlanner = () => useSyncExternalStore(subscribe, () => state, () => EMPTY)
