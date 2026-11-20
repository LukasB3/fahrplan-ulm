import { cached } from './cache.js'
import type { StopDirectory } from './stops.js'
import { type Sighting, swuVehicles, swuVehicleTrip } from './swu.js'
import type { Vehicles, VehicleTrip } from './types.js'
import type { GetJson } from './upstream.js'

// SWU renews the positions every 15 seconds, by its own account, and is asked that often around
// the clock, whether a map is open or not. A map is answered from memory at once, and what was
// seen last is there to bridge the minutes in which SWU lists no vehicle at all (see KEEP_MS).
const ASK_EVERY_MS = 15_000
// SWU's list takes 5 to 20 seconds at times. After an answer SWU is left alone for at least this long.
const REST_MS = 5_000
const SWU_TIMEOUT_MS = 30_000
// A list whose newest report is older than this has stalled: SWU has had no news from its vehicles ...
const STALLED_MS = 60_000
// ... and for this long a vehicle then stays where it was last reported. SWU itself lists a vehicle
// as parked after two minutes without a report, and at times hands out new positions only every
// five minutes (2026-11-19, 2026-11-20): for three minutes of the five its list is empty. This bridges that.
const KEEP_MS = 7 * 60_000
const HOUR_MS = 3_600_000

type Deps = {
  getJson: GetJson
  stops: Pick<StopDirectory, 'lineOf'>
  log?: (problem: unknown) => void
  // Gets a line an hour on what SWU's list did.
  note?: (line: string) => void
}

// One line an hour on SWU's list: how slow it was, how often it failed and how long its vehicles
// went without a single new position. Read it in the journal when the map is in doubt: it tells
// SWU's silences from faults of our own.
const feedJournal = (note: (line: string) => void) => {
  const begin = (now: number) => ({ began: now, asked: 0, failed: 0, slowestMs: 0, most: 0, quietMs: 0 })
  let hour = begin(Date.now())
  // The newest report seen so far.
  let newest = Date.now()
  const seconds = (ms: number) => Math.round(ms / 1_000)

  return (tookMs: number, list?: Sighting[]) => {
    const now = Date.now()
    hour.asked++
    hour.slowestMs = Math.max(hour.slowestMs, tookMs)
    if (!list) hour.failed++
    else hour.most = Math.max(hour.most, list.length)
    const report = Math.max(0, ...(list ?? []).map((one) => one.seen))
    // The same report is a second older or younger from list to list, by the rounding of SWU's clock.
    if (report > newest + 2_000) {
      hour.quietMs = Math.max(hour.quietMs, report - newest)
      newest = report
    }
    if (now - hour.began < HOUR_MS) return
    const quiet = seconds(Math.max(hour.quietMs, now - newest))
    note(`SWU's vehicle list in the last hour: asked ${hour.asked} times, ${hour.failed} failed, slowest answer ${seconds(hour.slowestMs)} s, up to ${hour.most} vehicles, longest without a new position ${quiet} s`)
    hour = begin(now)
  }
}

// Where SWU's vehicles are. Asks SWU from the moment it exists, so the stop directory has to know the lines by then.
export const vehicleBoard = ({ getJson, stops, log = () => {}, note = () => {} }: Deps) => {
  const known = new Map<number, Sighting>()
  // When SWU last answered, and what went wrong since.
  let answered = 0
  let problem: unknown
  const journal = feedJournal(note)

  const take = (sightings: Sighting[]) => {
    const now = Date.now()
    // A list with news in it is the truth: a vehicle it leaves out has ended its trip.
    // A list without news says nothing about the vehicles it has dropped.
    if (sightings.some((one) => now - one.seen < STALLED_MS)) known.clear()
    for (const one of sightings) known.set(one.vehicle.id, one)
    answered = now
    problem = undefined
  }

  const ask = async () => {
    const began = Date.now()
    const sightings = await swuVehicles(getJson, stops.lineOf, SWU_TIMEOUT_MS).catch((failure: unknown) => {
      // The first failure after an answer is worth a line in the log; the following ones are the same story.
      if (problem === undefined) log(failure)
      problem = failure
      return undefined
    })
    if (sightings) take(sightings)
    journal(Date.now() - began, sightings)
  }

  // One question at a time, around the clock. Until SWU's first answer there is one on its way to wait for.
  let first: Promise<void> | undefined
  const keepAsking = () => {
    const began = Date.now()
    const asking = ask().then(() => {
      first = undefined
      setTimeout(keepAsking, Math.max(REST_MS, ASK_EVERY_MS - (Date.now() - began))).unref()
    })
    if (!answered) first = asking
  }
  keepAsking()

  // What is known of a vehicle is worth nothing once it is this old.
  const forget = () => {
    const now = Date.now()
    for (const [id, one] of known) if (now - one.seen > KEEP_MS) known.delete(id)
  }

  // While its reports stall SWU knows no trip for a vehicle either: its last one is shown as long as the vehicle is.
  const trips = cached((vehicle) => swuVehicleTrip(getJson, Number(vehicle)), { freshMs: 10_000, staleMs: KEEP_MS, max: 300 })

  return {
    // Always from memory. Only a map opened right after a start of the server waits, for SWU's first answer.
    all: async (): Promise<Vehicles> => {
      await first
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
