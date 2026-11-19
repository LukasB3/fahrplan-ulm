import { cached } from './cache.js'
import type { StopDirectory } from './stops.js'
import { type Sighting, swuVehicles, swuVehicleTrip } from './swu.js'
import type { Vehicles, VehicleTrip } from './types.js'
import type { GetJson } from './upstream.js'

// SWU renews the positions every 15 seconds. While a map is open somewhere, SWU is asked
// this often on the server's own clock, so that no map waits for SWU's answer.
const ASK_EVERY_MS = 10_000
// For this long after the last map asked.
const WATCHED_MS = 45_000
// SWU's list takes up to ten seconds at times.
const SWU_TIMEOUT_MS = 15_000
// A list whose newest report is older than this has stalled: SWU has had no news from its vehicles ...
const STALLED_MS = 60_000
// ... and for this long a vehicle then stays where it was last reported. SWU itself lists a vehicle
// as parked after two minutes without a report, which emptied the map whenever the reports stalled.
// On 2026-11-19 they came five minutes apart for a whole evening: this bridges that.
const KEEP_MS = 7 * 60_000
// Who opens a map after a pause waits this long for SWU before getting what is known from before.
const PATIENCE_MS = 3_000

type Deps = { getJson: GetJson; stops: Pick<StopDirectory, 'lineOf'>; log?: (problem: unknown) => void }

// Where SWU's vehicles are.
export const vehicleBoard = ({ getJson, stops, log = () => {} }: Deps) => {
  const known = new Map<number, Sighting>()
  // When SWU last answered, and what went wrong since.
  let answered = 0
  let problem: unknown
  let asking: Promise<void> | undefined
  // The request that ends a pause.
  let waking: Promise<void> | undefined
  let watchedUntil = 0
  let timer: NodeJS.Timeout | undefined

  const take = (sightings: Sighting[]) => {
    const now = Date.now()
    // A list with news in it is the truth: a vehicle it leaves out has ended its trip.
    // A list without news says nothing about the vehicles it has dropped.
    if (sightings.some((one) => now - one.seen < STALLED_MS)) known.clear()
    for (const one of sightings) known.set(one.vehicle.id, one)
    answered = now
    problem = undefined
  }

  // Callers arriving together share one request.
  const ask = () =>
    (asking ??= swuVehicles(getJson, stops.lineOf, SWU_TIMEOUT_MS)
      .then(take, (failure: unknown) => {
        // The first failure after an answer is worth a line in the log; the following ones are the same story.
        if (problem === undefined) log(failure)
        problem = failure
      })
      .finally(() => {
        asking = undefined
      }))

  // What is known of a vehicle is worth nothing once it is this old.
  const forget = () => {
    const now = Date.now()
    for (const [id, one] of known) if (now - one.seen > KEEP_MS) known.delete(id)
  }

  const watch = () => {
    watchedUntil = Date.now() + WATCHED_MS
    timer ??= setInterval(() => {
      if (Date.now() < watchedUntil) return void ask()
      clearInterval(timer)
      timer = undefined
    }, ASK_EVERY_MS).unref()
  }

  // While its reports stall SWU knows no trip for a vehicle either: its last one is shown as long as the vehicle is.
  const trips = cached((vehicle) => swuVehicleTrip(getJson, Number(vehicle)), { freshMs: 10_000, staleMs: KEEP_MS, max: 300 })

  return {
    all: async (): Promise<Vehicles> => {
      // While maps are open the answer in memory is seconds old and goes out at once. After a
      // pause it is not: whoever comes then waits for SWU, but not for long when there is something to show.
      if (timer === undefined && Date.now() - answered > ASK_EVERY_MS) {
        waking = ask().finally(() => {
          waking = undefined
        })
      }
      watch()
      forget()
      if (waking) await (known.size ? Promise.race([waking, new Promise((done) => setTimeout(done, PATIENCE_MS))]) : waking)
      const now = Date.now()
      if (now - answered > KEEP_MS) throw problem ?? new Error('SWU has not answered')
      forget()
      const sightings = [...known.values()]
      return {
        now: new Date(now).toISOString(),
        asOf: sightings.length ? new Date(Math.max(...sightings.map((one) => one.seen))).toISOString() : null,
        vehicles: sightings.map((one) => one.vehicle),
      }
    },
    trip: async (vehicle: number): Promise<VehicleTrip> => (await trips(String(vehicle))).value,
  }
}

export type VehicleBoard = ReturnType<typeof vehicleBoard>
