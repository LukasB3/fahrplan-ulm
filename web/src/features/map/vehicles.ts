import type { Vehicles } from '@api/types'
import { getJson } from '@/lib/api'

// An answer asked for ahead is the newest there is only for a moment.
const AHEAD_MS = 3_000

let ahead: { at: number; answer: Promise<Vehicles> } | undefined
let asked = 0

const ask = () => {
  asked = Date.now()
  return getJson<Vehicles>('/api/vehicles')
}

// Asks for the vehicles the moment the map tab is opened, while the map library is still on its
// way: the map's first question is then answered already. Where the library is there already,
// the map has asked first and this does nothing.
export const askAhead = () => {
  if (Date.now() - asked < AHEAD_MS) return
  ahead = { at: Date.now(), answer: ask() }
  // The map hears of a failure when it takes the answer.
  ahead.answer.catch(() => {})
}

export const vehiclesNow = () => {
  const waiting = ahead
  ahead = undefined
  return waiting && Date.now() - waiting.at < AHEAD_MS ? waiting.answer : ask()
}
