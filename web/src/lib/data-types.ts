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
  // One entry per destination with a regular service.
  directions: {
    headsign: string
    // Stop codes in running order.
    stops: string[]
    days: Partial<Record<DayType, LineService>>
    // The usual gap between departures on a weekday around midday.
    everyMinutes: number | null
  }[]
}

export type DayType = 'mofr' | 'moth' | 'fr' | 'sa' | 'su'

// First and last departure at the first stop on one day type, and how many trips run.
export type LineService = { first: string; last: string; trips: number }

// The departures of one day type, as on the printed timetable: per hour, the minutes.
// Hours run past 24 for trips after midnight, so they stay in running order.
export type Grid = [hour: number, minutes: number[]][]

export type TimetableTable = { line: string; headsign: string; days: Partial<Record<DayType, Grid>> }

export type Meta = { feedVersion: string; validFrom: string; validUntil: string }

// What a line's badge is drawn with. Lines of other operators have none.
export type LineStyle = { color: string; textColor: string; tram: boolean }
