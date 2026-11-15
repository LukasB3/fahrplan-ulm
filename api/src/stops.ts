import { swuStops, type SwuStop } from './swu.js'
import type { Place } from './types.js'
import type { GetJson } from './upstream.js'

// The stops SWU serves, kept in memory: which stop is which at DING, and
// what the stops are called, for the sentence request.
export const stopDirectory = (getJson: GetJson) => {
  let byNumber = new Map<number, SwuStop>()
  let byName = new Map<string, SwuStop>()
  let names: string[] = []

  return {
    // A failure leaves the last list in place.
    refresh: async () => {
      const stops = await swuStops(getJson)
      byNumber = new Map(stops.map((stop) => [stop.number, stop]))
      byName = new Map(stops.map((stop) => [stop.name.toLowerCase(), stop]))
      // Sorted, so the list reads the same every time it is put into a prompt.
      names = stops.map((stop) => stop.name).sort((a, b) => a.localeCompare(b, 'de'))
    },
    dhidOf: (number: number) => byNumber.get(number)?.dhid,
    names: () => names,
    place: (name: string): Place | undefined => {
      const stop = byName.get(name.trim().toLowerCase())
      return stop && { kind: 'stop', stop: stop.dhid, name: stop.name, town: null, lat: stop.lat, lon: stop.lon }
    },
  }
}

export type StopDirectory = ReturnType<typeof stopDirectory>
