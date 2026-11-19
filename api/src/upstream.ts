// How the transport operators' servers are asked. They see who is asking.
// They answer within `timeoutMs` or the request counts as failed.
export type GetJson = (url: string, timeoutMs?: number) => Promise<unknown>

const USER_AGENT = 'fahrplan-ulm.de (+https://fahrplan-ulm.de)'

export const getJson: GetJson = async (url, timeoutMs = 8_000) => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}

// The stop that was asked for does not exist at the operator.
export class UnknownStop extends Error {}

// No vehicle with that number is on a trip.
export class UnknownVehicle extends Error {}
