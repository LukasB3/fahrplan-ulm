import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import linesJson from '../../data/lines.json'
import metaJson from '../../data/meta.json'
import stopsJson from '../../data/stops.json'
import { contrast, shaded } from './colour'
import type { Line, LineStyle, Meta, Stop, TimetableTable } from './data-types'
import { metresBetween } from './geo'

// The snapshot in web/data. Pages are built from it, so this module runs at
// build time only and must stay out of client components.
export const stops = stopsJson as Stop[]
export const lines = linesJson as Line[]
export const meta = metaJson as Meta

const bySlug = new Map(stops.map((stop) => [stop.slug, stop]))
const byCode = new Map(stops.map((stop) => [stop.code, stop]))
const linesById = new Map(lines.map((line) => [line.id, line]))

export const stopBySlug = (slug: string) => bySlug.get(slug)
export const stopByCode = (code: string) => byCode.get(code)
export const lineById = (id: string) => linesById.get(id)
// Line ids are written in lower case in addresses: /linie/n1.
export const lineBySlug = (slug: string) => lines.find((line) => line.id.toLowerCase() === slug)

export const timetableOf = async (stop: Stop) => JSON.parse(await readFile(join(process.cwd(), 'data', 'timetable', `${stop.code}.json`), 'utf8')) as TimetableTable[]

export const busiestStops = (count: number) => [...stops].sort((a, b) => b.weight - a.weight).slice(0, count)

export const nearestStops = (to: Stop, count: number) =>
  stops
    .filter((stop) => stop.code !== to.code)
    .map((stop) => ({ stop, metres: Math.round(metresBetween(to, stop) / 10) * 10 }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, count)

// SWU prints white numbers on every line colour, and on the lighter ones they
// are too faint to read at the size of a badge. A colour that is nearly dark
// enough is darkened as far as white needs; a light one stays as it is and
// gets black numbers.
const READABLE = 4.5
const NEARLY = 3.5

const readable = (color: string) => {
  const white = contrast('#ffffff', color)
  if (white < NEARLY) return { color, textColor: '#000000' }
  let shade = color
  for (let factor = 0.99; contrast('#ffffff', shade) < READABLE; factor -= 0.01) shade = shaded(color, factor)
  return { color: shade, textColor: '#ffffff' }
}

// What each line's badge is drawn with. A line SWU colours white (the E line)
// would vanish on a white card, so it gets the neutral badge instead.
export const lineStyles: Record<string, LineStyle> = Object.fromEntries(lines.filter((line) => line.color !== '#ffffff').map((line) => [line.id, { ...readable(line.color), tram: line.kind === 'tram' }]))
