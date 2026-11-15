import { z } from 'zod'
import type { Departure } from './types.js'
import { UnknownStop, type GetJson } from './upstream.js'

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
