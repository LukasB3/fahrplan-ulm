// The response contract of the API. The website imports these types and
// nothing else from here, so this file must not import anything.

// A point in time as an ISO string in UTC. The website shows it in Europe/Berlin.
export type Iso = string

export type Health = { status: 'ok'; now: Iso }

export type Mode = 'tram' | 'bus' | 'train'

export type Departure = {
  // What is written on the vehicle: "1", "N3", "RE5", "ICE 515".
  line: string
  mode: Mode
  destination: string
  // "B" at a city stop, "7 Nord" at the station.
  platform: string | null
  planned: Iso
  // When it really leaves, by live data. Missing where the operator sends none.
  expected: Iso | null
  // SWU's number of the vehicle on this trip, once one is assigned.
  vehicle: number | null
}

export type Departures = {
  // The server's clock, so a phone with a wrong clock still counts down right.
  now: Iso
  // True when the transport operator did not answer and this is its last answer.
  stale: boolean
  departures: Departure[]
}

export type ApiError = { error: string }
