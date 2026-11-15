// The response contract of the API. The website imports these types and
// nothing else from here, so this file must not import anything.

// A point in time as an ISO string in UTC. The website shows it in Europe/Berlin.
export type Iso = string

export type Health = { status: 'ok'; now: Iso }
