// The shape of the snapshot in web/data, written by scripts/build-data.ts.

export type Stop = {
  // SWU's stop number: what live departures are asked for.
  id: number
  // SWU's stop code: also the name of the stop's timetable file.
  code: string
  slug: string
  name: string
  // The municipality, as in "Neu-Ulm".
  town: string
  // The stop's id at DING.
  dhid: string
  lat: number
  lon: number
  lines: string[]
  // Scheduled departures per week, to rank stops by how busy they are.
  weight: number
}

export type LineKind = 'tram' | 'bus' | 'night'

export type Line = {
  // What is written on the vehicle: "1", "E", "N1".
  id: string
  kind: LineKind
  color: string
  textColor: string
  // The two ends, as in "Söflingen – Böfingen".
  name: string
  // One entry per destination with a regular service; stops are stop codes in running order.
  directions: { headsign: string; stops: string[] }[]
}

// The departures of one day type, as on the printed timetable: per hour, the minutes.
// Hours run past 24 for trips after midnight, so they stay in running order.
export type Grid = [hour: number, minutes: number[]][]

export type DayType = 'mofr' | 'moth' | 'fr' | 'sa' | 'su'

export type TimetableTable = { line: string; headsign: string; days: Partial<Record<DayType, Grid>> }

export type Meta = { feedVersion: string; validFrom: string; validUntil: string }
