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

// Somewhere a journey can start or end.
export type Place = {
  kind: 'stop' | 'address' | 'poi' | 'position'
  // The stop's id at DING. Every other place is found by its position.
  stop: string | null
  name: string
  // The municipality, as in "Neu-Ulm".
  town: string | null
  lat: number
  lon: number
}

export type Places = { places: Place[] }

// One end of a leg: where, and when by the timetable and by live data.
export type Stopover = { name: string; platform: string | null; planned: Iso; expected: Iso | null }

export type Walk = {
  kind: 'walk'
  from: Stopover
  to: Stopover
  metres: number
  // The way to walk, as positions in order.
  path: [lat: number, lon: number][]
}

export type Ride = {
  kind: 'ride'
  from: Stopover
  to: Stopover
  line: string
  mode: Mode
  destination: string
  // Stops passed between getting on and getting off.
  stopsBetween: number
}

export type Leg = Walk | Ride

export type Journey = {
  legs: Leg[]
  changes: number
  // The cheapest single ticket for an adult, in euros, where DING names one.
  fare: number | null
}

export type TripRequest = {
  from: Place
  to: Place
  // `at: null` means now.
  time: { mode: 'depart' | 'arrive'; at: Iso | null }
}

export type Trips = {
  now: Iso
  journeys: Journey[]
  // 'too_late': nothing arrives by the time asked for; these are the next ones to leave.
  note: 'ok' | 'too_late'
}

// A request in plain words: "in 30 Minuten zum Hauptbahnhof".
export type AskRequest = {
  text: string
  // Where the phone is, if the person has allowed that before. Never sent to the language model.
  position: { lat: number; lon: number } | null
  // The person's own places, so "von zuhause" can be filled in. Never sent to the language model.
  saved: { home: Place | null; work: Place | null }
}

// Something the sentence left open, for the person to settle.
export type AskNeed = {
  slot: 'from' | 'to'
  // 'position': "here" was meant but the phone's position is not known.
  // 'home' / 'work': that place is not saved yet. 'unknown': nothing by that name.
  // 'ambiguous': several places by that name. 'missing': no destination was said.
  why: 'position' | 'home' | 'work' | 'unknown' | 'ambiguous' | 'missing'
  // The place as the person said it.
  said: string | null
  candidates: Place[]
}

export type AskResult =
  | {
      status: 'ok'
      from: Place | null
      to: Place | null
      time: TripRequest['time']
      // True when the sentence gave a time without saying whether to leave or to arrive then.
      timeAssumed: boolean
      needs: AskNeed[]
    }
  // 'other': not a request for a journey. 'limit': this visitor has used up the day.
  // 'unavailable': the language model is switched off, over budget or down; the form still works.
  | { status: 'other' | 'limit' | 'unavailable' }

export type ApiError = { error: string }
