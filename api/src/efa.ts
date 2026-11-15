import { z } from 'zod'
import type { Departure, Mode } from './types.js'
import type { GetJson } from './upstream.js'

// DING's journey planner (EFA). It is the public backend of ding.eu, not a
// documented open API: ask sparingly and expect it to change.
const COMMON = 'outputFormat=rapidJSON&coordOutputFormat=WGS84%5Bdd.ddddd%5D'

// EFA's product classes: 4 is tram, 5 city bus, 6 regional bus; trains are 0 and 13 to 16.
const TRAM_CLASS = 4
const TRAIN_CLASSES = [0, 1, 2, 13, 14, 15, 16]
const modeOf = (productClass: number): Mode => (productClass === TRAM_CLASS ? 'tram' : TRAIN_CLASSES.includes(productClass) ? 'train' : 'bus')

const stopEvent = z.object({
  departureTimePlanned: z.iso.datetime(),
  departureTimeEstimated: z.iso.datetime().nullish(),
  location: z.object({ properties: z.object({ platformName: z.string().nullish(), platform: z.string().nullish() }).nullish() }),
  transportation: z.object({
    number: z.string().nullish(),
    name: z.string().nullish(),
    product: z.object({ class: z.number().int() }),
    destination: z.object({ name: z.string() }),
    operator: z.object({ name: z.string().nullish() }).nullish(),
  }),
})

const monitor = z.object({ stopEvents: z.array(z.unknown()).optional() })

// Regional trains carry their name in `number` ("RE 5", "RS7"); long-distance
// trains only a bare number there and the name in front of it ("ICE 515 InterCityExpress").
const lineOf = (number: string, name: string, mode: Mode) => (mode === 'train' && /^\d+$/.test(number) ? name.split(' ').slice(0, 2).join(' ') : number.replace(/\s+/g, ''))

// Departures of everything but SWU's own lines, which SWU reports better itself.
export const efaDeparturesOfOthers = async (getJson: GetJson, base: string, dhid: string): Promise<Departure[]> => {
  const url = `${base}/XML_DM_REQUEST?${COMMON}&type_dm=any&name_dm=${encodeURIComponent(dhid)}&mode=direct&useRealtime=1&depType=stopEvents&limit=40`
  const { stopEvents = [] } = monitor.parse(await getJson(url))
  return stopEvents.flatMap((item): Departure[] => {
    const parsed = stopEvent.safeParse(item)
    if (!parsed.success) return []
    const { transportation, location, departureTimePlanned, departureTimeEstimated } = parsed.data
    if (transportation.operator?.name === 'SWU') return []
    const mode = modeOf(transportation.product.class)
    const line = lineOf(transportation.number ?? '', transportation.name ?? '', mode)
    if (!line) return []
    return [
      {
        line,
        mode,
        destination: transportation.destination.name,
        platform: (location.properties?.platformName ?? location.properties?.platform)?.replace(/^Bstg\.\s*/, '') ?? null,
        planned: departureTimePlanned,
        expected: departureTimeEstimated ?? null,
        vehicle: null,
      },
    ]
  })
}
