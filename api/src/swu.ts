import { z } from 'zod'
import type { Departure, Vehicle, VehicleTrip } from './types.js'
import { UnknownStop, UnknownVehicle, type GetJson } from './upstream.js'

const BASE = 'https://api.swu.de/mobility/v1'
const TRAM = 1

// SWU leaves fields out or sends null while a trip has no vehicle yet, so
// only what a departure cannot do without is required.
const departure = z.object({
  RouteName: z.string().min(1),
  DepartureTimeScheduled: z.iso.datetime({ offset: true }),
  DepartureTimeActual: z.iso.datetime({ offset: true }).nullish(),
  DepartureDirectionText: z.string().nullish(),
  PlatformName: z.string().nullish(),
  StopPointCode: z.string().nullish(),
  VehicleNumber: z.number().int().nullish(),
  VehicleCategory: z.number().int().nullish(),
})

// SWU answers errors with status 200 and says what happened in `State`.
const passage = z.object({ StopPassage: z.object({ State: z.string(), DepartureData: z.array(z.unknown()).optional() }) })

const stopList = z.object({ StopAttributes: z.object({ StopData: z.array(z.unknown()) }) })

const listedStop = z.object({
  StopNumber: z.number().int(),
  StopName: z.string().min(1),
  StopCoordinates: z.object({ Latitude: z.number(), Longitude: z.number() }),
  StopPoints: z.array(z.object({ StopPointCode: z.string().nullish() })).nullish(),
})

const iso = (time: string) => new Date(time).toISOString()

export const swuDepartures = async (getJson: GetJson, stop: number, limit: number): Promise<Departure[]> => {
  const { StopPassage: answer } = passage.parse(await getJson(`${BASE}/stop/passage/Departures?StopNumber=${stop}&Limit=${limit}`))
  if (answer.State === 'no stop found') throw new UnknownStop(`SWU has no stop ${stop}`)
  // A stop where nothing leaves in the next hours, at night for one: an empty board, not a failure.
  if (answer.State === 'no departures found') return []
  if (answer.State !== 'ok') throw new Error(`SWU answered "${answer.State}"`)
  // One entry SWU got wrong must not cost the whole board.
  return (answer.DepartureData ?? []).flatMap((item): Departure[] => {
    const parsed = departure.safeParse(item)
    if (!parsed.success) return []
    const entry = parsed.data
    return [
      {
        line: entry.RouteName,
        mode: entry.VehicleCategory === TRAM || (entry.VehicleCategory == null && ['1', '2'].includes(entry.RouteName)) ? 'tram' : 'bus',
        destination: entry.DepartureDirectionText ?? '',
        platform: entry.PlatformName ?? null,
        planned: iso(entry.DepartureTimeScheduled),
        expected: entry.DepartureTimeActual ? iso(entry.DepartureTimeActual) : null,
        vehicle: entry.VehicleNumber ?? null,
        platformId: entry.StopPointCode ?? null,
      },
    ]
  })
}

// "de:08421:1008:1:2" is a platform; its first three parts are the stop at DING.
const dhidOf = (platform: string) => /^(de:\d+:\d+)(?::|$)/.exec(platform)?.[1]

export type SwuStop = { number: number; name: string; dhid: string; lat: number; lon: number }

// The stops passengers use, each with its id at DING. SWU's and DING's stop
// numbers differ for some stops, so the id is read from the platforms and
// never built from the number. Stops without such an id are left out.
export const swuStops = async (getJson: GetJson): Promise<SwuStop[]> => {
  const { StopAttributes } = stopList.parse(await getJson(`${BASE}/stop/attributes/BaseData?ContentScope=extended`))
  return StopAttributes.StopData.flatMap((item): SwuStop[] => {
    const parsed = listedStop.safeParse(item)
    if (!parsed.success) return []
    const stop = parsed.data
    const dhid = (stop.StopPoints ?? []).map((point) => dhidOf(point.StopPointCode ?? '')).find((id) => id !== undefined)
    return dhid ? [{ number: stop.StopNumber, name: stop.StopName, dhid, lat: stop.StopCoordinates.Latitude, lon: stop.StopCoordinates.Longitude }] : []
  })
}

// --- Lines ------------------------------------------------------------------------

const routeList = z.object({ RouteAttributes: z.object({ RouteData: z.array(z.unknown()) }) })
const listedRoute = z.object({ RouteNumber: z.number().int(), RouteName: z.string() })

// What SWU's route numbers are called on the vehicle: 5 is "5", 901 is "N1".
// Routes without a real name, which are depot and special trips, are left out.
export const swuRouteNames = async (getJson: GetJson): Promise<Map<number, string>> => {
  const { RouteAttributes } = routeList.parse(await getJson(`${BASE}/route/attributes/BaseData`))
  return new Map(
    RouteAttributes.RouteData.flatMap((item): [number, string][] => {
      const parsed = listedRoute.safeParse(item)
      return parsed.success && /[A-Za-z0-9]/.test(parsed.data.RouteName) ? [[parsed.data.RouteNumber, parsed.data.RouteName]] : []
    }),
  )
}

// --- Vehicles ----------------------------------------------------------------------

const moment = z.iso.datetime({ offset: true })
const vehicleList = z.object({ VehicleTrip: z.object({ CurrentTimestamp: moment.nullish().catch(undefined), TripData: z.array(z.unknown()).optional() }) })

// A vehicle between trips is listed without position or route; only what is on a trip is shown.
// SWU also lists a vehicle that way once its last report is two minutes old.
const movingVehicle = z.object({
  VehicleNumber: z.number().int(),
  VehicleCategory: z.number().int().nullish(),
  IsActive: z.literal(true),
  PositionData: z.object({ Latitude: z.number(), Longitude: z.number(), Bearing: z.number().nullish() }),
  TimeData: z.object({ Deviation: z.number().nullish(), ReferenceTime: moment.nullish().catch(undefined) }).nullish(),
  JourneyData: z.object({ RouteNumber: z.number().int(), DepartureDirectionText: z.string().nullish() }),
})

// A vehicle and when it last reported where it is, by this server's clock.
export type Sighting = { vehicle: Vehicle; seen: number }

export const swuVehicles = async (getJson: GetJson, lineOf: (route: number) => string | undefined, timeoutMs?: number): Promise<Sighting[]> => {
  const { VehicleTrip: answer } = vehicleList.parse(await getJson(`${BASE}/vehicle/trip/Trip`, timeoutMs))
  const now = Date.now()
  // SWU says how old a report is by its own clock; that age is what counts here.
  const asked = answer.CurrentTimestamp ? Date.parse(answer.CurrentTimestamp) : now
  return (answer.TripData ?? []).flatMap((item): Sighting[] => {
    const parsed = movingVehicle.safeParse(item)
    if (!parsed.success) return []
    const vehicle = parsed.data
    const line = lineOf(vehicle.JourneyData.RouteNumber)
    if (!line) return []
    const reported = vehicle.TimeData?.ReferenceTime ? Date.parse(vehicle.TimeData.ReferenceTime) : asked
    return [
      {
        seen: now - Math.max(0, asked - reported),
        vehicle: {
          id: vehicle.VehicleNumber,
          line,
          mode: vehicle.VehicleCategory === TRAM ? 'tram' : 'bus',
          lat: vehicle.PositionData.Latitude,
          lon: vehicle.PositionData.Longitude,
          bearing: vehicle.PositionData.Bearing ?? 0,
          // SWU counts the other way round: its deviation is negative for a vehicle behind the
          // timetable (checked against the times of the stops ahead, 2026-11-19).
          delaySeconds: -(vehicle.TimeData?.Deviation ?? 0) || 0,
          destination: vehicle.JourneyData.DepartureDirectionText ?? '',
        },
      },
    ]
  })
}

const passageAnswer = z.object({
  VehiclePassage: z.object({ State: z.string(), VehicleCategory: z.number().int().nullish(), RouteName: z.string().nullish(), PassageData: z.array(z.unknown()).optional() }),
})

const call = z.object({
  StopName: z.string(),
  StopCode: z.string(),
  ArrivalTimeScheduled: z.iso.datetime({ offset: true }),
  ArrivalTimeActual: z.iso.datetime({ offset: true }).nullish(),
  ArrivalCountdown: z.number().nullish(),
})

const patternAnswer = z.object({ VehiclePattern: z.object({ PatternData: z.object({ TrackPoints: z.array(z.object({ Latitude: z.number(), Longitude: z.number() })).nullish() }).nullish() }) })

// The stops a vehicle still has ahead on this trip, and the way it takes.
export const swuVehicleTrip = async (getJson: GetJson, vehicle: number): Promise<VehicleTrip> => {
  const [passage, pattern] = await Promise.all([
    getJson(`${BASE}/vehicle/trip/Passage?VehicleNumber=${vehicle}`).then((answer) => passageAnswer.parse(answer).VehiclePassage),
    // The way is a nicety: the stops are shown without it too.
    getJson(`${BASE}/vehicle/trip/Pattern?VehicleNumber=${vehicle}&ContentScope=Track`)
      .then((answer) => patternAnswer.parse(answer).VehiclePattern.PatternData?.TrackPoints ?? [])
      .catch(() => []),
  ])
  if (passage.State !== 'ok' || !passage.RouteName) throw new UnknownVehicle(`SWU has no trip for vehicle ${vehicle}`)
  const calls = (passage.PassageData ?? []).flatMap((item) => {
    const parsed = call.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
  return {
    id: vehicle,
    line: passage.RouteName,
    mode: passage.VehicleCategory === TRAM ? 'tram' : 'bus',
    destination: calls.at(-1)?.StopName ?? '',
    stops: calls
      .filter((stop) => (stop.ArrivalCountdown ?? 0) >= 0)
      .map((stop) => ({ name: stop.StopName, code: stop.StopCode, planned: iso(stop.ArrivalTimeScheduled), expected: stop.ArrivalTimeActual ? iso(stop.ArrivalTimeActual) : null })),
    track: pattern.map((point) => [point.Latitude, point.Longitude]),
  }
}
