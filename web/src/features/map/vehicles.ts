import type { Vehicles } from '@api/types'
import { getJson } from '@/lib/api'

let first: Promise<Vehicles> | undefined

// Asks for the vehicles the moment the map tab is opened, while the map
// library is still on its way: the map's first question is then answered already.
export const askAhead = () => {
  first = getJson<Vehicles>('/api/vehicles')
  // The map hears of a failure when it takes the answer.
  first.catch(() => {})
}

export const vehiclesNow = () => {
  const ahead = first
  first = undefined
  return ahead ?? getJson<Vehicles>('/api/vehicles')
}
