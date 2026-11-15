import { swuRouteNames, swuStops, type SwuStop } from './swu.js'
import type { Place } from './types.js'
import type { GetJson } from './upstream.js'

// What SWU's stops and lines are called, kept in memory: which stop is which
// at DING, the stop names for the sentence request, and the name of each
// route number for the vehicles on the map.
export const stopDirectory = (getJson: GetJson) => {
  let byNumber = new Map<number, SwuStop>()
  let byName = new Map<string, SwuStop>()
  let byDhid = new Map<string, SwuStop>()
  let names: string[] = []
  let lines = new Map<number, string>()

  return {
    // A failure leaves the last list in place.
    refresh: async () => {
      const [stops, routes] = await Promise.all([swuStops(getJson), swuRouteNames(getJson)])
      lines = routes
      byNumber = new Map(stops.map((stop) => [stop.number, stop]))
      byName = new Map(stops.map((stop) => [stop.name.toLowerCase(), stop]))
      byDhid = new Map(stops.map((stop) => [stop.dhid, stop]))
      // Sorted, so the list reads the same every time it is put into a prompt.
      names = stops.map((stop) => stop.name).sort((a, b) => a.localeCompare(b, 'de'))
    },
    dhidOf: (number: number) => byNumber.get(number)?.dhid,
    // What SWU calls the stop that has this id at DING.
    nameAt: (dhid: string) => byDhid.get(dhid)?.name,
    names: () => names,
    lineOf: (route: number) => lines.get(route),
    place: (name: string): Place | undefined => {
      const stop = byName.get(name.trim().toLowerCase())
      return stop && { kind: 'stop', stop: stop.dhid, name: stop.name, town: null, lat: stop.lat, lon: stop.lon }
    },
  }
}

export type StopDirectory = ReturnType<typeof stopDirectory>
